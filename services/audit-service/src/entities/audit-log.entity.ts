import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * Centralized audit log entity — append-only (no UPDATE/DELETE).
 * Each entry is HMAC-SHA256 signed for tamper detection.
 */
@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId', 'timestamp'])
@Index(['sourceService', 'timestamp'])
@Index(['action', 'timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Service d'origine : auth-service, expense-service, sales-service, etc. */
  @Column({ type: 'varchar', length: 50, name: 'source_service' })
  sourceService!: string;

  /** Routing key de l'événement original (ex: sale.created, expense.approved) */
  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType!: string;

  /** UUID de l'utilisateur ayant déclenché l'action */
  @Column({ type: 'varchar', length: 100, name: 'user_id', nullable: true })
  userId!: string | null;

  /** Action métier : CREATE, UPDATE, DELETE, APPROVE, REJECT, etc. */
  @Column({ type: 'varchar', length: 50 })
  action!: string;

  /** Type d'entité : expense, sale, payment, user, etc. */
  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType!: string;

  /** UUID de l'entité concernée */
  @Column({ type: 'varchar', length: 100, name: 'entity_id', nullable: true })
  entityId!: string | null;

  /** Payload complet du message RabbitMQ */
  @Column({ type: 'simple-json', nullable: true })
  payload!: Record<string, unknown> | null;

  /** Adresse IP (si disponible dans le payload) */
  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  /** Signature HMAC-SHA256 de l'entrée pour détecter les altérations */
  @Column({ type: 'varchar', length: 64 })
  signature!: string;

  @CreateDateColumn({ type: 'datetimeoffset' })
  timestamp!: Date;
}
