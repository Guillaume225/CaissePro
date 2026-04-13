import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';

export const SALES_EXCHANGE = 'sales.events';

export enum SalesEvent {
  SALE_CREATED = 'sale.created',
  SALE_CONFIRMED = 'sale.confirmed',
  PAYMENT_RECEIVED = 'payment.received',
  RECEIVABLE_OVERDUE = 'receivable.overdue',
  CASH_CLOSING_OPENED = 'cash_closing.opened',
  CASH_CLOSING_CLOSED = 'cash_closing.closed',
  CASH_CLOSING_VARIANCE_ALERT = 'cash_closing.variance_alert',
  CASH_CLOSING_REMINDER = 'cash_closing.reminder',
}

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private connection!: amqp.AmqpConnectionManager;
  private channel!: ChannelWrapper;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('rabbitmq.url');
    if (!url) {
      this.logger.warn('RabbitMQ URL not configured — events disabled');
      return;
    }
    try {
      this.connection = amqp.connect([url]);
      this.channel = this.connection.createChannel({
        setup: async (ch: any) => {
          await ch.assertExchange(SALES_EXCHANGE, 'topic', { durable: true });
        },
      });
      this.logger.log('Connected to RabbitMQ');
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ', err);
    }
  }

  async onModuleDestroy() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  async publish(routingKey: SalesEvent, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`Event ${routingKey} not published — no RabbitMQ channel`);
      return;
    }
    try {
      const publishPromise = this.channel.publish(
        SALES_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify({ event: routingKey, data: payload, timestamp: new Date().toISOString() })),
        { deliveryMode: 2, contentType: 'application/json' },
      );
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('RabbitMQ publish timeout')), 3000),
      );
      await Promise.race([publishPromise, timeout]);
      this.logger.debug(`Published ${routingKey}`);
    } catch (err) {
      this.logger.error(`Failed to publish ${routingKey}`, err);
    }
  }
}
