import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FneInvoice } from './fne-invoice.entity';

@Entity('fne_invoice_items')
export class FneInvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'invoice_id' })
  invoiceId!: string;

  @ManyToOne(() => FneInvoice, (inv) => inv.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice!: FneInvoice;

  /** FNE remote item ID (returned by API, used for refund) */
  @Column({ type: 'varchar', length: 100, name: 'fne_item_id', nullable: true })
  fneItemId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'decimal', precision: 15, scale: 4 })
  quantity!: number;

  /** Unit price HT */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount!: number;

  @Column({ type: 'varchar', length: 50, name: 'measurement_unit', nullable: true })
  measurementUnit!: string | null;

  /** Tax codes e.g. ["TVA"], ["TVAB"] */
  @Column({ type: 'simple-json' })
  taxes!: string[];

  /** Per-item custom taxes */
  @Column({ type: 'simple-json', name: 'custom_taxes', nullable: true })
  customTaxes!: Array<{ name: string; amount: number }> | null;

  /* ── Computed totals ── */
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'line_total_ht', default: 0 })
  lineTotalHt!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'line_vat', default: 0 })
  lineVat!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'line_total_ttc', default: 0 })
  lineTotalTtc!: number;

  /** Quantity returned via credit note */
  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'quantity_returned', default: 0 })
  quantityReturned!: number;
}
