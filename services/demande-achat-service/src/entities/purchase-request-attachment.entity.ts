import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseRequestDocumentType } from './enums';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('purchase_request_attachments')
export class PurchaseRequestAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'purchase_request_id' })
  purchaseRequestId!: string;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest!: PurchaseRequest;

  @Column({ type: 'varchar', length: 255, name: 'file_id' })
  fileId!: string;

  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName!: string;

  @Column({
    type: 'simple-enum',
    enum: PurchaseRequestDocumentType,
    name: 'document_type',
    default: PurchaseRequestDocumentType.AUTRE,
  })
  documentType!: PurchaseRequestDocumentType;

  @Column({ type: 'uuid', name: 'uploaded_by_id' })
  uploadedById!: string;

  @Column({ type: 'datetimeoffset', name: 'uploaded_at' })
  uploadedAt!: Date;
}
