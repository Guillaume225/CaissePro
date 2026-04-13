import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TenantPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

@Entity('tenants')
@Index(['slug'], { unique: true })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain!: string | null;

  @Column({ type: 'simple-enum', enum: TenantPlan, default: TenantPlan.FREE })
  plan!: TenantPlan;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  settings!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
