import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanCode } from '../plans/plans.config';

@Entity({ schema: 'dbo', name: 'tenants' })
@Index(['externalTenantId'], { unique: true })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, name: 'external_tenant_id', unique: true })
  externalTenantId!: string;

  @Column({ type: 'varchar', length: 50, name: 'plan_code', default: 'STARTER' })
  planCode!: PlanCode;

  @Column({ type: 'varchar', length: 255, name: 'admin_email' })
  adminEmail!: string;

  @Column({ type: 'varchar', length: 255, name: 'name', default: '' })
  name!: string;

  @Column({ type: 'varchar', length: 255, name: 'slug', unique: true, default: '' })
  slug!: string;

  @Column({ type: 'varchar', length: 20, name: 'schema_id', nullable: true })
  schemaId!: string | null;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
