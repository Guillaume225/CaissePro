import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fne_products')
@Index(['reference'])
export class FneProduct {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'unit_price' })
  unitPrice!: number;

  @Column({ type: 'varchar', length: 50, name: 'measurement_unit', nullable: true })
  measurementUnit!: string | null;

  /** Default taxes codes, e.g. ['TVA'] */
  @Column({ type: 'simple-json', name: 'default_taxes', default: '["TVA"]' })
  defaultTaxes!: string[];

  /** Compte comptable produit */
  @Column({ type: 'varchar', length: 20, name: 'account_code', nullable: true })
  accountCode!: string | null;

  /** Compte comptable TVA (si TVA != 0%) */
  @Column({ type: 'varchar', length: 20, name: 'vat_account_code', nullable: true })
  vatAccountCode!: string | null;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
