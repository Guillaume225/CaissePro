import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { ApprovalStatus } from './enums';
import { Expense } from './expense.entity';

@Entity('expense_approvals')
@Index(['expenseId', 'level'], { unique: true })
export class ExpenseApproval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'expense_id' })
  expenseId!: string;

  @ManyToOne(() => Expense, (exp) => exp.approvals)
  @JoinColumn({ name: 'expense_id' })
  expense!: Expense;

  @Column({ type: 'uuid', name: 'approver_id' })
  approverId!: string;

  @Column({ type: 'smallint' })
  level!: number;

  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  status!: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'timestamptz', name: 'approved_at', nullable: true })
  approvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
