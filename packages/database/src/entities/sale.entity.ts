import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SaleStatus } from './enums';
import { Client } from './client.entity';
import { User } from './user.entity';
import { SaleItem } from './sale-item.entity';
import { Payment } from './payment.entity';
import { Receivable } from './receivable.entity';

@Entity('sales')
@Index(['reference'], { unique: true })
@Index(['status'])
@Index(['date'])
@Index(['clientId'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  reference!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'uuid', name: 'client_id', nullable: true })
  clientId!: string | null;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client!: Client | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'tax_amount', default: 0 })
  taxAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'discount_amount', default: 0 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'enum', enum: SaleStatus, default: SaleStatus.DRAFT })
  status!: SaleStatus;

  @Column({ type: 'uuid', name: 'seller_id' })
  sellerId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items!: SaleItem[];

  @OneToMany(() => Payment, (p) => p.sale)
  payments!: Payment[];

  @OneToMany(() => Receivable, (r) => r.sale)
  receivables!: Receivable[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
