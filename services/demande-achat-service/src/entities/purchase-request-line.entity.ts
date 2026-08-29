import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('purchase_request_lines')
export class PurchaseRequestLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'purchase_request_id' })
  purchaseRequestId!: string;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest!: PurchaseRequest;

  @Column({ type: 'varchar', length: 100, name: 'article_reference', nullable: true })
  articleReference!: string | null;

  @Column({ type: 'varchar', length: 500 })
  designation!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'bit', name: 'is_off_catalog', default: false })
  isOffCatalog!: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 3 })
  quantity!: number;

  @Column({ type: 'varchar', length: 50 })
  unit!: string;

  // Rempli par le demandeur : jamais. Rempli par le service achats lors du
  // chiffrage (cf. PurchaseRequestsService.updateLinePricing), avant que la
  // demande n'entre dans le circuit de validation.
  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'estimated_unit_price', default: 0 })
  estimatedUnitPrice!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'estimated_amount', default: 0 })
  estimatedAmount!: number;

  @Column({ type: 'date', name: 'desired_date', nullable: true })
  desiredDate!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
