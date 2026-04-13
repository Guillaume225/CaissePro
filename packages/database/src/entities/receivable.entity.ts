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
import { AgingBucket, ReceivableStatus } from './enums';
import { Sale } from './sale.entity';
import { Client } from './client.entity';

@Entity('receivables')
@Index(['clientId'])
@Index(['status'])
@Index(['dueDate'])
export class Receivable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'sale_id' })
  saleId!: string;

  @ManyToOne(() => Sale, (sale) => sale.receivables)
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'amount_due' })
  amountDue!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'amount_paid', default: 0 })
  amountPaid!: number;

  @Column({ type: 'date', name: 'due_date' })
  dueDate!: string;

  @Column({ type: 'simple-enum', enum: ReceivableStatus, default: ReceivableStatus.OPEN })
  status!: ReceivableStatus;

  @Column({
    type: 'simple-enum',
    enum: AgingBucket,
    name: 'aging_bucket',
    default: AgingBucket.CURRENT,
  })
  agingBucket!: AgingBucket;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
