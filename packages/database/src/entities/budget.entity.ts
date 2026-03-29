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
import { ExpenseCategory } from './expense-category.entity';
import { Department } from './department.entity';

@Entity('budgets')
@Index(['categoryId', 'departmentId', 'periodStart', 'periodEnd'], { unique: true })
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => ExpenseCategory)
  @JoinColumn({ name: 'category_id' })
  category!: ExpenseCategory;

  @Column({ type: 'uuid', name: 'department_id' })
  departmentId!: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @Column({ type: 'date', name: 'period_start' })
  periodStart!: string;

  @Column({ type: 'date', name: 'period_end' })
  periodEnd!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'allocated_amount' })
  allocatedAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'consumed_amount', default: 0 })
  consumedAmount!: number;

  @Column({
    type: 'jsonb',
    name: 'alert_thresholds',
    default: JSON.stringify([50, 75, 90, 100]),
  })
  alertThresholds!: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
