import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';

export const DA_EXCHANGE = 'demande_achat.events';

export enum DemandeAchatEvent {
  SUBMITTED = 'da.submitted',
  TO_PRICE = 'da.to_price',
  PRICED = 'da.priced',
  TO_VALIDATE = 'da.to_validate',
  RETURNED = 'da.returned',
  APPROVED = 'da.approved',
  REJECTED = 'da.rejected',
  VALIDATED_TRANSMITTED = 'da.validated_transmitted',
  TAKEN_OVER = 'da.taken_over',
  PROCESSING = 'da.processing',
  PROCESSED = 'da.processed',
  CLOSED = 'da.closed',
  CANCELLED = 'da.cancelled',
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
        setup: async (ch: Channel) => {
          await ch.assertExchange(DA_EXCHANGE, 'topic', { durable: true });
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

  async publish(routingKey: DemandeAchatEvent, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`Event ${routingKey} not published — no RabbitMQ channel`);
      return;
    }
    try {
      const publishPromise = this.channel.publish(
        DA_EXCHANGE,
        routingKey,
        Buffer.from(
          JSON.stringify({ event: routingKey, data: payload, timestamp: new Date().toISOString() }),
        ),
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
