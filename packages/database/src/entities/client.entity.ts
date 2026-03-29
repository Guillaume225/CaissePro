import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientType, RiskClass } from './enums';

@Entity('clients')
@Index(['name'])
@Index(['email'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'enum', enum: ClientType })
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

  @Column({ type: 'enum', enum: RiskClass, name: 'risk_class', default: RiskClass.B })
  riskClass!: RiskClass;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
