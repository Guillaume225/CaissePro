import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

/**
 * Stores report design configurations per tenant.
 * The `configJson` column holds the full ReportConfig object
 * matching the frontend store structure (fields, kpis, sections, header, footer, table, page).
 */
@Entity('report_configs')
@Index(['tenantId'])
@Index(['tenantId', 'reportId'], { unique: true })
export class ReportConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  /** Report identifier (e.g. 'journal-caisse', 'grand-livre') */
  @Column({ type: 'varchar', length: 50, name: 'report_id' })
  reportId!: string;

  /** Report display name */
  @Column({ type: 'varchar', length: 200, name: 'report_name' })
  reportName!: string;

  /** Full config JSON — stores the complete report design configuration */
  @Column({ type: 'nvarchar', length: 'max', name: 'config_json' })
  configJson!: string;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
