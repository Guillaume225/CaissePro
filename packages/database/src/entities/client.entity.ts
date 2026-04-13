import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientType, RiskClass } from './enums';
import { Tenant } from './tenant.entity';

@Entity('clients')
@Index(['name'])
@Index(['email'])
@Index(['tenantId'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'simple-enum', enum: ClientType })
  type!: ClientType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 50, name: 'tax_id', nullable: true })
  taxId!: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'credit_limit', default: 0 })
  creditLimit!: number;

  @Column({ type: 'smallint', default: 50 })
  score!: number; // 0-100

  @Column({ type: 'simple-enum', enum: RiskClass, name: 'risk_class', default: RiskClass.B })
  riskClass!: RiskClass;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
