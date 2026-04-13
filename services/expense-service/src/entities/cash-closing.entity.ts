import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CashClosingStatus } from './enums';

@Entity('cash_closings')
@Index(['reference'], { unique: true })
@Index(['status'])
@Index(['openedAt'])
@Index(['openedById'])
export class CashClosing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  reference!: string;

  @Column({ type: 'simple-enum', enum: CashClosingStatus, default: CashClosingStatus.OPEN })
  status!: CashClosingStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'opening_balance' })
  openingBalance!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_entries', default: 0 })
  totalEntries!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_exits', default: 0 })
  totalExits!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'theoretical_balance', default: 0 })
  theoreticalBalance!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'actual_balance', nullable: true })
  actualBalance!: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  variance!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'uuid', name: 'opened_by' })
  openedById!: string;

  @Column({ type: 'uuid', name: 'closed_by', nullable: true })
  closedById!: string | null;

  @Column({ type: 'datetimeoffset', name: 'opened_at' })
  openedAt!: Date;

  @Column({ type: 'datetimeoffset', name: 'closed_at', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
