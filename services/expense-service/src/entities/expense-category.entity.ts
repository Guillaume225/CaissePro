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
import { CategoryDirection } from './enums';

@Entity('expense_categories')
@Index(['code'], { unique: true })
export class ExpenseCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => ExpenseCategory, (cat) => cat.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: ExpenseCategory | null;

  @OneToMany(() => ExpenseCategory, (cat) => cat.parent)
  children!: ExpenseCategory[];

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'budget_limit', nullable: true })
  budgetLimit!: number | null;

  @Column({ type: 'varchar', length: 10, default: CategoryDirection.EXIT })
  direction!: CategoryDirection;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 20, name: 'accounting_debit_account', nullable: true })
  accountingDebitAccount!: string | null;

  @Column({ type: 'varchar', length: 20, name: 'accounting_credit_account', nullable: true })
  accountingCreditAccount!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
