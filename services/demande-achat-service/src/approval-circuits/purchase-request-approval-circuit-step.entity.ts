import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseRequestApprovalCircuit } from './purchase-request-approval-circuit.entity';

@Entity('purchase_request_approval_circuit_steps')
export class PurchaseRequestApprovalCircuitStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'circuit_id' })
  circuitId!: string;

  @Column({ type: 'int' })
  level!: number;

  @Column({ type: 'varchar', length: 100 })
  role!: string;

  @Column({ type: 'uuid', name: 'approver_id', nullable: true })
  approverId!: string | null;

  @ManyToOne(() => PurchaseRequestApprovalCircuit, (circuit) => circuit.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'circuit_id' })
  circuit!: PurchaseRequestApprovalCircuit;
}
