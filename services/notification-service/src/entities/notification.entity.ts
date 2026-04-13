import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationType, NotificationChannel } from '@/common/enums';

@Entity('notifications')
@Index(['recipientId', 'read', 'createdAt'])
@Index(['recipientId', 'type'])
@Index(['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** UUID of the user who should receive this notification */
  @Column({ type: 'varchar', length: 100, name: 'recipient_id' })
  recipientId!: string;

  @Column({ type: 'simple-enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  /** Channels through which this notification was delivered */
  @Column({ type: 'simple-array', name: 'channels' })
  channels!: NotificationChannel[];

  /** Whether the user has read this notification (in-app) */
  @Column({ type: 'bit', default: false })
  read!: boolean;

  @Column({ type: 'datetimeoffset', name: 'read_at', nullable: true })
  readAt!: Date | null;

  /** Related entity reference */
  @Column({ type: 'varchar', length: 100, name: 'entity_type', nullable: true })
  entityType!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'entity_id', nullable: true })
  entityId!: string | null;

  /** Extra metadata (e.g. budget percentage, amount, etc.) */
  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'datetimeoffset', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetimeoffset', name: 'updated_at' })
  updatedAt!: Date;
}
