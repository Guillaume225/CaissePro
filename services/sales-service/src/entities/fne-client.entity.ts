import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fne_clients')
@Index(['phone'])
@Index(['email'])
@Index(['ncc'])
export class FneClient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, name: 'company_name' })
  companyName!: string;

  @Column({ type: 'varchar', length: 50 })
  phone!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  /** NCC client (required for B2B) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  ncc!: string | null;

  /** Seller name */
  @Column({ type: 'varchar', length: 255, name: 'seller_name', nullable: true })
  sellerName!: string | null;

  /** Compte comptable client */
  @Column({ type: 'varchar', length: 20, name: 'account_code', nullable: true })
  accountCode!: string | null;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
