import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { CashMovementType, CashMovementCategory } from './enums';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';
import { CashDay } from './cash-day.entity';

@Entity('cash_movements')
@Index(['tenantId'])
@Index(['cashDayId'])
@Index(['type'])
@Index(['category'])
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'uuid', name: 'cash_day_id' })
  cashDayId!: string;

  @ManyToOne(() => CashDay, (d) => d.movements)
  @JoinColumn({ name: 'cash_day_id' })
  cashDay!: CashDay;

  @Column({ type: 'simple-enum', enum: CashMovementType })
  type!: CashMovementType;

  @Column({ type: 'simple-enum', enum: CashMovementCategory })
  category!: CashMovementCategory;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  reference!: string | null;

  @Column({ type: 'nvarchar', length: 500 })
  description!: string;

  @Column({ type: 'varchar', length: 20, name: 'payment_method', nullable: true })
  paymentMethod!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
