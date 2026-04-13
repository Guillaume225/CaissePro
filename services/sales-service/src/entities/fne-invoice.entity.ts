import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FneInvoiceStatus, FneTemplate, FnePaymentMethod, FneInvoiceType } from './enums';
import { FneInvoiceItem } from './fne-invoice-item.entity';

@Entity('fne_invoices')
@Index(['reference'], { unique: true, where: 'reference IS NOT NULL' })
@Index(['fneReference'])
@Index(['status'])
@Index(['clientPhone'])
export class FneInvoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Internal reference: FNE-YYYY-NNNNN */
  @Column({ type: 'varchar', length: 30, nullable: true, unique: true })
  reference!: string | null;

  /** FNE NCC returned by API */
  @Column({ type: 'varchar', length: 100, name: 'fne_ncc', nullable: true })
  fneNcc!: string | null;

  /** FNE reference returned by API */
  @Column({ type: 'varchar', length: 100, name: 'fne_reference', nullable: true })
  fneReference!: string | null;

  /** QR code verification URL */
  @Column({ type: 'varchar', length: 500, name: 'fne_token', nullable: true })
  fneToken!: string | null;

  /** Full API response stored for audit */
  @Column({ type: 'simple-json', name: 'fne_response', nullable: true })
  fneResponse!: Record<string, unknown> | null;

  /** FNE remote invoice ID (used for refund) */
  @Column({ type: 'varchar', length: 100, name: 'fne_invoice_id', nullable: true })
  fneInvoiceId!: string | null;

  @Column({ type: 'simple-enum', enum: FneInvoiceStatus, default: FneInvoiceStatus.DRAFT })
  status!: FneInvoiceStatus;

  @Column({ type: 'simple-enum', enum: FneTemplate })
  template!: FneTemplate;

  @Column({ type: 'simple-enum', enum: FneInvoiceType, name: 'invoice_type', default: FneInvoiceType.SALE })
  invoiceType!: FneInvoiceType;

  @Column({ type: 'simple-enum', enum: FnePaymentMethod, name: 'payment_method' })
  paymentMethod!: FnePaymentMethod;

  /* ── Client info ── */
  @Column({ type: 'varchar', length: 255, name: 'client_company_name' })
  clientCompanyName!: string;

  @Column({ type: 'varchar', length: 50, name: 'client_phone' })
  clientPhone!: string;

  @Column({ type: 'varchar', length: 255, name: 'client_email' })
  clientEmail!: string;

  @Column({ type: 'varchar', length: 100, name: 'client_ncc', nullable: true })
  clientNcc!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'client_seller_name', nullable: true })
  clientSellerName!: string | null;

  /* ── Establishment ── */
  @Column({ type: 'varchar', length: 255, name: 'point_of_sale' })
  pointOfSale!: string;

  @Column({ type: 'varchar', length: 255 })
  establishment!: string;

  @Column({ type: 'varchar', length: 500, name: 'commercial_message', nullable: true })
  commercialMessage!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  footer!: string | null;

  /* ── RNE ── */
  @Column({ type: 'bit', name: 'is_rne', default: false })
  isRne!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rne!: string | null;

  /* ── Currency ── */
  @Column({ type: 'varchar', length: 5, name: 'foreign_currency', nullable: true })
  foreignCurrency!: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'foreign_currency_rate', default: 0 })
  foreignCurrencyRate!: number;

  /* ── Totals ── */
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'subtotal_ht', default: 0 })
  subtotalHt!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_vat', default: 0 })
  totalVat!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_ttc', default: 0 })
  totalTtc!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'discount_pct', default: 0 })
  discountPct!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'discount_amount', default: 0 })
  discountAmount!: number;

  /** Sticker balance at time of certification */
  @Column({ type: 'int', name: 'balance_sticker', default: 0 })
  balanceSticker!: number;

  @Column({ type: 'bit', name: 'fne_warning', default: false })
  fneWarning!: boolean;

  /* ── Custom taxes JSON ── */
  @Column({ type: 'simple-json', name: 'custom_taxes', nullable: true })
  customTaxes!: Array<{ name: string; amount: number }> | null;

  /* ── Credit note reference ── */
  @Column({ type: 'uuid', name: 'credit_note_of', nullable: true })
  creditNoteOf!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'credit_note_reference', nullable: true })
  creditNoteReference!: string | null;

  /** Decision-maker comment for commercial team */
  @Column({ type: 'nvarchar', length: 1000, name: 'decision_comment', nullable: true })
  decisionComment!: string | null;

  /* ── Audit ── */
  @Column({ type: 'uuid', name: 'created_by' })
  createdById!: string;

  @OneToMany(() => FneInvoiceItem, (i) => i.invoice, { cascade: true, eager: true })
  items!: FneInvoiceItem[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
