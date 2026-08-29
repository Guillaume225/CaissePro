import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { PurchaseRequestHistoryAction, PurchaseRequestStatus } from './enums';
import { PurchaseRequest } from './purchase-request.entity';

/**
 * Serves BOTH the audit journal (§23) and the comment thread (§24):
 * every state transition writes a row here, and users can also post
 * standalone COMMENT rows via POST /:id/comments.
 */
@Entity('purchase_request_history')
@Index(['purchaseRequestId'])
export class PurchaseRequestHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'purchase_request_id' })
  purchaseRequestId!: string;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest!: PurchaseRequest;

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  @Column({ type: 'simple-enum', enum: PurchaseRequestHistoryAction })
  action!: PurchaseRequestHistoryAction;

  @Column({ type: 'simple-enum', enum: PurchaseRequestStatus, name: 'from_status', nullable: true })
  fromStatus!: PurchaseRequestStatus | null;

  @Column({ type: 'simple-enum', enum: PurchaseRequestStatus, name: 'to_status', nullable: true })
  toStatus!: PurchaseRequestStatus | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
