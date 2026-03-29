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
import { AdvanceStatus } from './enums';
import { User } from './user.entity';

@Entity('advances')
@Index(['employeeId'])
@Index(['status'])
export class Advance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employee_id' })
  employee!: User;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'justified_amount', default: 0 })
  justifiedAmount!: number;

  @Column({ type: 'enum', enum: AdvanceStatus, default: AdvanceStatus.PENDING })
  status!: AdvanceStatus;

  @Column({ type: 'date', name: 'due_date' })
  dueDate!: string;

  @Column({ type: 'date', name: 'justification_deadline', nullable: true })
  justificationDeadline!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
