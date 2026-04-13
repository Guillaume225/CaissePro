import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CashDayStatus, CashType } from './enums';
import { CashMovement } from './cash-movement.entity';

@Entity('cash_days')
@Index(['reference'], { unique: true })
@Index(['status'])
@Index(['openedAt'])
@Index(['cashType'])
export class CashDay {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 10, name: 'cash_type' })
  cashType!: CashType;

  @Column({ type: 'varchar', length: 20, unique: true })
  reference!: string;

  @Column({ type: 'simple-enum', enum: CashDayStatus, default: CashDayStatus.OPEN })
  status!: CashDayStatus;

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

  @Column({ type: 'bit', name: 'accounting_processed', default: false })
  accountingProcessed!: boolean;

  @Column({ type: 'datetimeoffset', name: 'accounting_processed_at', nullable: true })
  accountingProcessedAt!: Date | null;

  @Column({ type: 'uuid', name: 'accounting_processed_by', nullable: true })
  accountingProcessedBy!: string | null;

  @OneToMany(() => CashMovement, (m) => m.cashDay)
  movements!: CashMovement[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
