import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import * as Handlebars from 'handlebars';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationChannel } from '@/common/enums';
import { ROUTING_RULES, RoutingRule } from './routing-rules';

const EXCHANGES = ['expense.events', 'sales.events'];
const QUEUE_NAME = 'notification-service.events';

@Injectable()
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /* ------------------------------------------------------------------ */
  /*  Connection                                                        */
  /* ------------------------------------------------------------------ */

  async connect(): Promise<void> {
    try {
      const url = this.configService.get<string>('rabbitmq.url', 'amqp://localhost:5672');
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();
      const channel = this.channel;
      const connection = this.connection;

      await channel.prefetch(10);
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      for (const exchange of EXCHANGES) {
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.bindQueue(QUEUE_NAME, exchange, '#');
      }

      this.logger.log(`Connected to RabbitMQ — consuming from queue "${QUEUE_NAME}"`);

      await channel.consume(QUEUE_NAME, (msg) => this.handleMessage(msg), { noAck: false });

      connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err);
      });

      connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — reconnecting in 5s');
        setTimeout(() => this.connect(), 5000);
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ — retrying in 5s', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
    } catch {
      // Ignore close errors
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Message handling                                                  */
  /* ------------------------------------------------------------------ */

  async handleMessage(msg: amqplib.ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const routingKey = msg.fields.routingKey;
      const payload = JSON.parse(msg.content.toString()) as Record<string, unknown>;

      const rule = ROUTING_RULES[routingKey];
      if (!rule) {
        this.logger.debug(`No routing rule for ${routingKey} — skipping`);
        this.channel?.ack(msg);
        return;
      }

      await this.dispatch(rule, payload);
      this.channel?.ack(msg);
      this.logger.debug(`Dispatched notification for ${routingKey}`);
    } catch (error) {
      this.logger.error(
        `Error processing ${msg.fields.routingKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      this.channel?.nack(msg, false, false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Dispatch                                                          */
  /* ------------------------------------------------------------------ */

  async dispatch(rule: RoutingRule, payload: Record<string, unknown>): Promise<void> {
    const recipientIds = rule.getRecipients(payload);
    if (recipientIds.length === 0) {
      this.logger.warn(`No recipients for ${rule.type} — skipping`);
      return;
    }

    const title = this.renderTemplate(rule.title, payload);
    const message = this.renderTemplate(rule.message, payload);
    const entityId = rule.getEntityId(payload);

    for (const recipientId of recipientIds) {
      const channels = rule.channels;

      // Create in-app notification (always stored in DB)
      const notification = await this.notificationsService.create({
        recipientId,
        type: rule.type,
        title,
        message,
        channels,
        entityType: rule.entityType,
        entityId,
        metadata: payload,
      });

      // Deliver to each channel
      if (channels.includes(NotificationChannel.IN_APP)) {
        await this.notificationsService.pushToWebSocket(recipientId, notification);
      }

      if (channels.includes(NotificationChannel.EMAIL)) {
        const email = (payload.recipientEmail as string) || (payload.email as string) || null;
        if (email) {
          await this.notificationsService.sendEmail(email, rule.type, title, message, payload);
        }
      }

      if (channels.includes(NotificationChannel.SMS)) {
        const phone = (payload.recipientPhone as string) || (payload.phone as string) || null;
        if (phone) {
          await this.notificationsService.sendSms(phone, message);
        }
      }
    }
  }

  renderTemplate(template: string, data: Record<string, unknown>): string {
    try {
      const compiled = Handlebars.compile(template);
      return compiled(data);
    } catch {
      return template;
    }
  }
}
