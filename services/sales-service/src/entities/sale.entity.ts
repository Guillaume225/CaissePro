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
  DeleteDateColumn,
} from 'typeorm';
import { SaleStatus } from './enums';
import { Client } from './client.entity';
import { SaleItem } from './sale-item.entity';
import { Payment } from './payment.entity';
import { Receivable } from './receivable.entity';

@Entity('sales')
@Index(['reference'], { unique: true })
@Index(['status'])
@Index(['clientId'])
@Index(['date'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  reference!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId!: string;

  @ManyToOne(() => Client, (c) => c.sales)
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'simple-enum', enum: SaleStatus, default: SaleStatus.DRAFT })
  status!: SaleStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'subtotal_ht', default: 0 })
  subtotalHt!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'discount_amount', default: 0 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_vat', default: 0 })
  totalVat!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_ttc', default: 0 })
  totalTtc!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'amount_paid', default: 0 })
  amountPaid!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'global_discount_pct', default: 0 })
  globalDiscountPct!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById!: string;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate!: string | null;

  @OneToMany(() => SaleItem, (i) => i.sale, { cascade: true })
  items!: SaleItem[];

  @OneToMany(() => Payment, (p) => p.sale)
  payments!: Payment[];

  @OneToMany(() => Receivable, (r) => r.sale)
  receivables!: Receivable[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetimeoffset', nullable: true })
  deletedAt!: Date | null;
}
