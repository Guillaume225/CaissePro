import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { PurchaseRequestApprovalStatus } from './enums';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('purchase_request_approvals')
@Index(['purchaseRequestId', 'cycle', 'level'])
export class PurchaseRequestApproval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'purchase_request_id' })
  purchaseRequestId!: string;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest!: PurchaseRequest;

  @Column({ type: 'uuid', name: 'circuit_id', nullable: true })
  circuitId!: string | null;

  @Column({ type: 'int', default: 1 })
  cycle!: number;

  @Column({ type: 'int' })
  level!: number;

  @Column({ type: 'varchar', length: 100 })
  role!: string;

  @Column({ type: 'uuid', name: 'approver_id', nullable: true })
  approverId!: string | null;

  @Column({
    type: 'simple-enum',
    enum: PurchaseRequestApprovalStatus,
    default: PurchaseRequestApprovalStatus.PENDING,
  })
  status!: PurchaseRequestApprovalStatus;

  @Column({ type: 'uuid', name: 'action_by_id', nullable: true })
  actionById!: string | null;

  @Column({ type: 'datetimeoffset', name: 'action_at', nullable: true })
  actionAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
