import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { PaymentMethod } from './enums';
import { Sale } from './sale.entity';
import { Client } from './client.entity';

@Entity('payments')
@Index(['reference'], { unique: true })
@Index(['saleId'])
@Index(['clientId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  reference!: string;

  @Column({ type: 'uuid', name: 'sale_id' })
  saleId!: string;

  @ManyToOne(() => Sale, (s) => s.payments)
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId!: string;

  @ManyToOne(() => Client, (c) => c.payments)
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'simple-enum', enum: PaymentMethod, name: 'payment_method' })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'text', nullable: true, name: 'check_number' })
  checkNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', name: 'received_by' })
  receivedById!: string;

  @Column({ type: 'date', name: 'payment_date' })
  paymentDate!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
