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
import { CashDayStatus, CashType } from './enums';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';
import { CashMovement } from './cash-movement.entity';

@Entity('cash_days')
@Index(['tenantId'])
@Index(['status'])
@Index(['openedAt'])
@Index(['cashType'])
export class CashDay {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

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

  @ManyToOne(() => User)
  @JoinColumn({ name: 'opened_by' })
  openedBy!: User;

  @Column({ type: 'uuid', name: 'closed_by', nullable: true })
  closedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedBy!: User | null;

  @Column({ type: 'datetimeoffset', name: 'opened_at' })
  openedAt!: Date;

  @Column({ type: 'datetimeoffset', name: 'closed_at', nullable: true })
  closedAt!: Date | null;

  @OneToMany(() => CashMovement, (m) => m.cashDay)
  movements!: CashMovement[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
