import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';

export const EXPENSE_EXCHANGE = 'expense.events';

export enum ExpenseEvent {
  CREATED = 'expense.created',
  APPROVED = 'expense.approved',
  PAID = 'expense.paid',
  BUDGET_ALERT = 'budget.alert',
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
          await ch.assertExchange(EXPENSE_EXCHANGE, 'topic', { durable: true });
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

  async publish(routingKey: ExpenseEvent, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`Event ${routingKey} not published — no RabbitMQ channel`);
      return;
    }
    try {
      await this.channel.publish(
        EXPENSE_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify({ event: routingKey, data: payload, timestamp: new Date().toISOString() })),
        { deliveryMode: 2, contentType: 'application/json' },
      );
      this.logger.debug(`Published ${routingKey}`);
    } catch (err) {
      this.logger.error(`Failed to publish ${routingKey}`, err);
    }
  }
}
