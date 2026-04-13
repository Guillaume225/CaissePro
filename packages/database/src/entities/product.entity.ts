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
import { Tenant } from './tenant.entity';

@Entity('products')
@Index(['sku'], { unique: true })
@Index(['category'])
@Index(['tenantId'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  sku!: string;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'unit_price' })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'tax_rate', default: 0 })
  taxRate!: number;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
