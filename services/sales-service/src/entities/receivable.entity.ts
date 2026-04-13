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
import { AgingBucket } from './enums';
import { Sale } from './sale.entity';
import { Client } from './client.entity';

@Entity('receivables')
@Index(['clientId'])
@Index(['agingBucket'])
@Index(['saleId'], { unique: true })
export class Receivable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'sale_id', unique: true })
  saleId!: string;

  @ManyToOne(() => Sale, (s) => s.receivables)
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_amount' })
  totalAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'paid_amount', default: 0 })
  paidAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'outstanding_amount' })
  outstandingAmount!: number;

  @Column({ type: 'date', name: 'due_date' })
  dueDate!: string;

  @Column({ type: 'simple-enum', enum: AgingBucket, name: 'aging_bucket', default: AgingBucket.CURRENT })
  agingBucket!: AgingBucket;

  @Column({ type: 'bit', name: 'is_settled', default: false })
  isSettled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
