import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from './product.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'sale_id' })
  saleId!: string;

  @ManyToOne(() => Sale, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'unit_price' })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'vat_rate', default: 18 })
  vatRate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'discount_pct', default: 0 })
  discountPct!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'line_total_ht', default: 0 })
  lineTotalHt!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'line_vat', default: 0 })
  lineVat!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'line_total_ttc', default: 0 })
  lineTotalTtc!: number;
}
