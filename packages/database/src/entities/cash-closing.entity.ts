import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { CashClosingModule, CashClosingStatus } from './enums';
import { User } from './user.entity';

@Entity('cash_closings')
@Index(['date', 'module'])
export class CashClosing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'enum', enum: CashClosingModule })
  module!: CashClosingModule;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'opening_balance' })
  openingBalance!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_in' })
  totalIn!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_out' })
  totalOut!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'closing_balance' })
  closingBalance!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'expected_balance' })
  expectedBalance!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  variance!: number;

  @Column({ type: 'enum', enum: CashClosingStatus, default: CashClosingStatus.OPEN })
  status!: CashClosingStatus;

  @Column({ type: 'uuid', name: 'closed_by', nullable: true })
  closedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedBy!: User | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
