import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CONFIRM = 'CONFIRM',
  PAYMENT = 'PAYMENT',
  AGING_UPDATE = 'AGING_UPDATE',
  CASH_CLOSING_OPEN = 'CASH_CLOSING_OPEN',
  CASH_CLOSING_CLOSE = 'CASH_CLOSING_CLOSE',
}

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId', 'timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'simple-enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId!: string | null;

  @Column({ type: 'simple-json', name: 'old_value', nullable: true })
  oldValue!: Record<string, unknown> | null;

  @Column({ type: 'simple-json', name: 'new_value', nullable: true })
  newValue!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'datetimeoffset' })
  timestamp!: Date;
}
