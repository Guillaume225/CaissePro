import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { NotificationType, NotificationChannel } from '@/common/enums';

/**
 * Preference per-user, per-notification-type.
 * If no preference row exists, the default routing rules apply.
 */
@Entity('notification_preferences')
@Index(['userId', 'type'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, name: 'user_id' })
  userId!: string;

  @Column({ type: 'simple-enum', enum: NotificationType })
  type!: NotificationType;

  /** Which channels the user wants for this type */
  @Column({ type: 'simple-array' })
  channels!: NotificationChannel[];

  /** User can mute a type entirely */
  @Column({ type: 'bit', default: false })
  muted!: boolean;

  @CreateDateColumn({ type: 'datetimeoffset', name: 'created_at' })
  createdAt!: Date;
}
