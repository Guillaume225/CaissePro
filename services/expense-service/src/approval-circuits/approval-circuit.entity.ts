import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApprovalCircuitStep } from './approval-circuit-step.entity';

@Entity('approval_circuits')
export class ApprovalCircuit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'min_amount', default: 0 })
  minAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'max_amount', nullable: true })
  maxAmount!: number | null;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;

  @OneToMany(() => ApprovalCircuitStep, (step) => step.circuit)
  steps!: ApprovalCircuitStep[];
}
