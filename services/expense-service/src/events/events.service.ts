import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';

export const EXPENSE_EXCHANGE = 'expense.events';

export enum ExpenseEvent {
  CREATED = 'expense.created',
  SUBMITTED = 'expense.submitted',
  APPROVED = 'expense.approved',
  REJECTED = 'expense.rejected',
  PAID = 'expense.paid',
  CANCELLED = 'expense.cancelled',
  BUDGET_ALERT = 'budget.alert',
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
      const publishPromise = this.channel.publish(
        EXPENSE_EXCHANGE,
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
