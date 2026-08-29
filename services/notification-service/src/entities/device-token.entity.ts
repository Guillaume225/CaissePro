import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Lightweight read-only mapping of the shared `device_tokens` table.
 * The table is owned/written by expense-service's notifications module
 * (register/unregister endpoints) — this service only reads it to know
 * where to send push notifications.
 *
 * `synchronize: false` here is required, not optional: this DataSource
 * synchronizes in non-production environments (see app.module.ts), and
 * without this override TypeORM would try to reconcile the shared table
 * to match this partial definition.
 */
@Entity({ name: 'device_tokens', synchronize: false })
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 10 })
  platform!: 'android' | 'ios';

  @Column({ type: 'nvarchar', length: 500 })
  token!: string;
}
