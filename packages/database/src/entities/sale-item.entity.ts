import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from './product.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'sale_id' })
  saleId!: string;

  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'unit_price' })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'discount_percent', default: 0 })
  discountPercent!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'discount_amount', default: 0 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'tax_rate', default: 0 })
  taxRate!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal!: number;
}
