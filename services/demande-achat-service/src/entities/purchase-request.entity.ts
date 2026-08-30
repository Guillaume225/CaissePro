import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { PurchaseRequestPriority, PurchaseRequestStatus } from './enums';

@Entity('purchase_requests')
@Index(['status'])
@Index(['createdById'])
@Index(['requesterId'])
@Index(['number'], { unique: true })
export class PurchaseRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  number!: string | null;

  @Column({ type: 'uuid', name: 'requester_id' })
  requesterId!: string;

  @Column({ type: 'varchar', length: 255 })
  service!: string;

  @Column({ type: 'varchar', length: 255 })
  department!: string;

  @Column({ type: 'varchar', length: 500 })
  subject!: string;

  @Column({ type: 'text' })
  justification!: string;

  @Column({ type: 'date', name: 'desired_date' })
  desiredDate!: string;

  @Column({ type: 'simple-enum', enum: PurchaseRequestPriority, default: PurchaseRequestPriority.NORMAL })
  priority!: PurchaseRequestPriority;

  @Column({ type: 'text', name: 'urgency_reason', nullable: true })
  urgencyReason!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  project!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'cost_center', nullable: true })
  costCenter!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  budget!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  site!: string | null;

  @Column({ type: 'text', name: 'general_comment', nullable: true })
  generalComment!: string | null;

  @Column({ type: 'simple-enum', enum: PurchaseRequestStatus, default: PurchaseRequestStatus.DRAFT })
  status!: PurchaseRequestStatus;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'total_estimated_amount', default: 0 })
  totalEstimatedAmount!: number;

  @Column({ type: 'int', name: 'current_approval_level', nullable: true })
  currentApprovalLevel!: number | null;

  @Column({ type: 'int', default: 1 })
  cycle!: number;

  @Column({ type: 'datetimeoffset', name: 'submitted_at', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'datetimeoffset', name: 'validated_at', nullable: true })
  validatedAt!: Date | null;

  @Column({ type: 'datetimeoffset', name: 'transmitted_at', nullable: true })
  transmittedAt!: Date | null;

  @Column({ type: 'datetimeoffset', name: 'taken_over_at', nullable: true })
  takenOverAt!: Date | null;

  @Column({ type: 'uuid', name: 'taken_over_by_id', nullable: true })
  takenOverById!: string | null;

  @Column({ type: 'text', name: 'processing_comment', nullable: true })
  processingComment!: string | null;

  @Column({ type: 'text', name: 'additional_info', nullable: true })
  additionalInfo!: string | null;

  @Column({ type: 'date', name: 'expected_processing_date', nullable: true })
  expectedProcessingDate!: string | null;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  @Column({ type: 'datetimeoffset', name: 'processed_at', nullable: true })
  processedAt!: Date | null;

  /** Fournisseur choisi par l'acheteur à l'étape "Proposition d'achat" — figé sur la demande, pas de lecture-jointure vers suppliers. */
  @Column({ type: 'uuid', name: 'supplier_id', nullable: true })
  supplierId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'supplier_name', nullable: true })
  supplierName!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'supplier_code', nullable: true })
  supplierCode!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'supplier_tax_number', nullable: true })
  supplierTaxNumber!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'supplier_rccm', nullable: true })
  supplierRccm!: string | null;

  /** Envoi automatique du bon de commande vers Sage à la génération (voir SagePurchaseOrderService). */
  @Column({ type: 'bit', name: 'sage_posted', default: false })
  sagePosted!: boolean;

  @Column({ type: 'datetimeoffset', name: 'sage_posted_at', nullable: true })
  sagePostedAt!: Date | null;

  @Column({ type: 'text', name: 'sage_error', nullable: true })
  sageError!: string | null;

  @Column({ type: 'datetimeoffset', name: 'closed_at', nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'text', name: 'close_comment', nullable: true })
  closeComment!: string | null;

  @Column({ type: 'datetimeoffset', name: 'cancelled_at', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'text', name: 'cancel_reason', nullable: true })
  cancelReason!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetimeoffset', nullable: true })
  deletedAt!: Date | null;
}
