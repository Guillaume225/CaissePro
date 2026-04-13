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
import { Expense } from './expense.entity';
import { Tenant } from './tenant.entity';

@Entity('expense_categories')
@Index(['code'], { unique: true })
@Index(['tenantId'])
export class ExpenseCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

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

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 20, name: 'accounting_debit_account', nullable: true })
  accountingDebitAccount!: string | null;

  @Column({ type: 'varchar', length: 20, name: 'accounting_credit_account', nullable: true })
  accountingCreditAccount!: string | null;

  @OneToMany(() => Expense, (exp) => exp.category)
  expenses!: Expense[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
