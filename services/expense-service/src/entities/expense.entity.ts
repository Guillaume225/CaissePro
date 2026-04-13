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
  DeleteDateColumn,
} from 'typeorm';
import { ExpenseStatus, PaymentMethod } from './enums';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseApproval } from './expense-approval.entity';
import { ExpenseAttachment } from './expense-attachment.entity';
import { CashDay } from './cash-day.entity';
import { User } from './user.entity';

@Entity('expenses')
@Index(['status'])
@Index(['createdById'])
@Index(['date'])
@Index(['reference'], { unique: true })
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  reference!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  beneficiary!: string | null;

  @Column({ type: 'simple-enum', enum: PaymentMethod, name: 'payment_method' })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'simple-enum', enum: ExpenseStatus, default: ExpenseStatus.DRAFT })
  status!: ExpenseStatus;

  @Column({ type: 'text', nullable: true })
  observations!: string | null;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => ExpenseCategory)
  @JoinColumn({ name: 'category_id' })
  category!: ExpenseCategory;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @Column({ type: 'uuid', name: 'cost_center_id', nullable: true })
  costCenterId!: string | null;

  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  projectId!: string | null;

  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  departmentId!: string | null;

  @Column({ type: 'uuid', name: 'cash_day_id', nullable: true })
  cashDayId!: string | null;

  @ManyToOne(() => CashDay)
  @JoinColumn({ name: 'cash_day_id' })
  cashDay!: CashDay | null;

  @Column({ type: 'uuid', name: 'disbursement_request_id', nullable: true })
  disbursementRequestId!: string | null;

  @OneToMany(() => ExpenseApproval, (a) => a.expense, { cascade: true })
  approvals!: ExpenseApproval[];

  @OneToMany(() => ExpenseAttachment, (a) => a.expense, { cascade: true })
  attachments!: ExpenseAttachment[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetimeoffset', nullable: true })
  deletedAt!: Date | null;
}
