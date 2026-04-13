import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdvanceStatus } from './enums';

@Entity('advances')
@Index(['employeeId'])
@Index(['status'])
export class Advance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'justified_amount', default: 0 })
  justifiedAmount!: number;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'simple-enum', enum: AdvanceStatus, default: AdvanceStatus.PENDING })
  status!: AdvanceStatus;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'date', name: 'justification_deadline', nullable: true })
  justificationDeadline!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
