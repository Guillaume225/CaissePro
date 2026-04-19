import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('fne_accounting_entries')
@Index(['invoiceId'])
@Index(['journalCode'])
@Index(['entryDate'])
export class FneAccountingEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Reference to the certified invoice */
  @Column({ type: 'uuid', name: 'invoice_id' })
  invoiceId!: string;

  /** Invoice reference (FNE-YYYY-NNNNN) */
  @Column({ type: 'varchar', length: 30, name: 'invoice_reference' })
  invoiceReference!: string;

  /** Journal code: VF = Ventes facturées */
  @Column({ type: 'varchar', length: 10, name: 'journal_code' })
  journalCode!: string;

  /** Accounting date (invoice certification date) */
  @Column({ type: 'date', name: 'entry_date' })
  entryDate!: Date;

  /** OHADA account number */
  @Column({ type: 'varchar', length: 20, name: 'account_number' })
  accountNumber!: string;

  /** Account label (e.g. "Client – Acme Corp") */
  @Column({ type: 'varchar', length: 255, name: 'account_label' })
  accountLabel!: string;

  /** Debit amount */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  debit!: number;

  /** Credit amount */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit!: number;

  /** Entry label (description) */
  @Column({ type: 'varchar', length: 500 })
  label!: string;

  /** Operation type: SALE or CREDIT_NOTE */
  @Column({ type: 'varchar', length: 20, name: 'operation_type' })
  operationType!: string;

  /** Who generated this entry */
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  /** Whether entry has been posted to ERP */
  @Column({ type: 'bit', name: 'erp_posted', default: false })
  erpPosted!: boolean;

  /** When the entry was posted to ERP */
  @Column({ type: 'datetimeoffset', name: 'erp_posted_at', nullable: true })
  erpPostedAt!: Date | null;

  /** ERP response data */
  @Column({ type: 'varchar', length: 2000, name: 'erp_response', nullable: true })
  erpResponse!: string | null;

  /** ERP error message */
  @Column({ type: 'varchar', length: 2000, name: 'erp_error', nullable: true })
  erpError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
