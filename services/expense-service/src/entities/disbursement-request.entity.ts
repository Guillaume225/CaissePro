import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DisbursementRequestStatus } from './enums';

@Entity('disbursement_requests')
@Index(['tenantId'])
@Index(['status'])
@Index(['createdAt'])
export class DisbursementRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 20 })
  reference!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  service!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  matricule!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'nvarchar', length: 1000 })
  reason!: string;

  @Column({
    type: 'simple-enum',
    enum: DisbursementRequestStatus,
    default: DisbursementRequestStatus.PENDING,
  })
  status!: DisbursementRequestStatus;

  @Column({ type: 'uuid', name: 'processed_by', nullable: true })
  processedById!: string | null;

  @Column({ type: 'uuid', name: 'linked_expense_id', nullable: true })
  linkedExpenseId!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
