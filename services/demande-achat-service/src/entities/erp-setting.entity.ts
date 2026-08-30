import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Lightweight, read-only mirror of sales-service's `erp_settings` table.
 * The canonical entity (and its full column set) lives in sales-service.
 *
 * `synchronize: false` here is required, not optional: see the identical
 * note on ./user.entity.ts — this DataSource must never attempt to alter a
 * table another service owns.
 */
@Entity({ name: 'erp_settings', synchronize: false })
export class ErpSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 1000, name: 'api_url' })
  apiUrl!: string;

  @Column({ type: 'varchar', length: 4000, name: 'access_token' })
  accessToken!: string;

  @Column({ type: 'varchar', length: 100, name: 'po_queue_name' })
  poQueueName!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_processus_class' })
  poProcessusClass!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_processus_method' })
  poProcessusMethod!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_parameters_class' })
  poParametersClass!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_parameters_code' })
  poParametersCode!: string;

  @Column({ type: 'bit', name: 'auto_post_purchase_orders' })
  autoPostPurchaseOrders!: boolean;

  @Column({ type: 'bit', name: 'is_active' })
  isActive!: boolean;
}
