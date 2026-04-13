import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApprovalCircuitStepRole } from './enums';
import { ApprovalCircuit } from './approval-circuit.entity';
import { User } from './user.entity';

@Entity('approval_circuit_steps')
@Index(['circuitId', 'level'], { unique: true })
export class ApprovalCircuitStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'circuit_id' })
  circuitId!: string;

  @ManyToOne(() => ApprovalCircuit, (c) => c.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'circuit_id' })
  circuit!: ApprovalCircuit;

  @Column({ type: 'smallint' })
  level!: number;

  @Column({ type: 'simple-enum', enum: ApprovalCircuitStepRole })
  role!: ApprovalCircuitStepRole;

  @Column({ type: 'uuid', name: 'approver_id' })
  approverId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approver_id' })
  approver!: User;
}
