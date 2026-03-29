import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Expense } from './expense.entity';

@Entity('expense_attachments')
export class ExpenseAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'expense_id' })
  expenseId!: string;

  @ManyToOne(() => Expense, (exp) => exp.attachments)
  @JoinColumn({ name: 'expense_id' })
  expense!: Expense;

  @Column({ type: 'varchar', length: 500, name: 'file_path' })
  filePath!: string;

  @Column({ type: 'varchar', length: 50, name: 'file_type' })
  fileType!: string;

  @Column({ type: 'jsonb', name: 'ocr_data', nullable: true })
  ocrData!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 255, name: 'original_filename' })
  originalFilename!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
