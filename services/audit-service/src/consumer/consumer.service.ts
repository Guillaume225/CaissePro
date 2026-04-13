import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as amqplib from 'amqplib';
import * as crypto from 'crypto';
import { AuditLog } from '@/entities/audit-log.entity';

/**
 * Maps routing keys to { action, entityType }.
 * Unknown events are still stored with the raw routing key info.
 */
const EVENT_MAP: Record<string, { action: string; entityType: string }> = {
  // Expense events
  'expense.created': { action: 'CREATE', entityType: 'expense' },
  'expense.submitted': { action: 'SUBMIT', entityType: 'expense' },
  'expense.approved': { action: 'APPROVE', entityType: 'expense' },
  'expense.rejected': { action: 'REJECT', entityType: 'expense' },
  'expense.paid': { action: 'PAY', entityType: 'expense' },
  'expense.cancelled': { action: 'CANCEL', entityType: 'expense' },
  'budget.alert': { action: 'ALERT', entityType: 'budget' },
  // Sales events
  'sale.created': { action: 'CREATE', entityType: 'sale' },
  'sale.confirmed': { action: 'CONFIRM', entityType: 'sale' },
  'payment.received': { action: 'RECEIVE', entityType: 'payment' },
  'receivable.overdue': { action: 'OVERDUE', entityType: 'receivable' },
};

const EXCHANGES = ['expense.events', 'sales.events'];
const QUEUE_NAME = 'audit-service.events';

@Injectable()
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private hmacSecret!: string;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.hmacSecret = this.configService.get<string>('audit.hmacSecret', 'change-me-in-production');
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /* ------------------------------------------------------------------ */
  /*  Connection & queue setup                                          */
  /* ------------------------------------------------------------------ */

  async connect(): Promise<void> {
    try {
      const url = this.configService.get<string>('rabbitmq.url', 'amqp://localhost:5672');
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();
      const channel = this.channel;
      const connection = this.connection;

      // Prefetch for back-pressure control
      await channel.prefetch(10);

      // Assert the durable queue
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      // Bind to ALL routing keys (#) on each exchange
      for (const exchange of EXCHANGES) {
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.bindQueue(QUEUE_NAME, exchange, '#');
      }

      this.logger.log(`Connected to RabbitMQ — consuming from queue "${QUEUE_NAME}"`);

      // Start consuming
      await channel.consume(QUEUE_NAME, (msg) => this.handleMessage(msg), { noAck: false });

      // Handle connection errors
      connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err);
      });

      connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — will attempt reconnect in 5s');
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
      // Ignore close errors during shutdown
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Message handling                                                   */
  /* ------------------------------------------------------------------ */

  async handleMessage(msg: amqplib.ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const routingKey = msg.fields.routingKey;
      const exchange = msg.fields.exchange;
      const content = JSON.parse(msg.content.toString());

      const auditEntry = this.buildAuditEntry(exchange, routingKey, content);
      auditEntry.signature = this.computeSignature(auditEntry);

      await this.auditLogRepo.save(auditEntry);

      this.channel?.ack(msg);
      this.logger.debug(`Audit logged: ${routingKey} from ${exchange}`);
    } catch (error) {
      this.logger.error(
        `Error processing message: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Nack without requeue to avoid infinite loops on malformed messages
      this.channel?.nack(msg, false, false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  buildAuditEntry(
    exchange: string,
    routingKey: string,
    content: Record<string, unknown>,
  ): AuditLog {
    const mapping = EVENT_MAP[routingKey];

    // Derive sourceService from exchange name (e.g. "expense.events" → "expense-service")
    const sourceService = exchange.replace('.events', '-service');

    const entry = new AuditLog();
    entry.sourceService = sourceService;
    entry.eventType = routingKey;
    entry.action = mapping?.action ?? routingKey.split('.').pop()?.toUpperCase() ?? 'UNKNOWN';
    entry.entityType = mapping?.entityType ?? routingKey.split('.').shift() ?? 'unknown';
    entry.userId = (content.userId as string) || (content.user_id as string) || null;
    entry.entityId = (content.id as string) || (content.entityId as string) || null;
    entry.ipAddress = (content.ipAddress as string) || (content.ip_address as string) || null;
    entry.payload = content;

    return entry;
  }

  computeSignature(entry: Partial<AuditLog>): string {
    const canonical = JSON.stringify({
      sourceService: entry.sourceService,
      eventType: entry.eventType,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: entry.payload,
    });

    return crypto.createHmac('sha256', this.hmacSecret).update(canonical).digest('hex');
  }
}
