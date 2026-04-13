import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fne_settings')
@Index(['companyId'], { unique: true })
export class FneSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'varchar', length: 500, name: 'api_url', default: 'http://54.247.95.108/ws' })
  apiUrl!: string;

  @Column({ type: 'varchar', length: 500, name: 'api_key' })
  apiKey!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nif!: string | null;

  @Column({ type: 'int', name: 'max_retries', default: 3 })
  maxRetries!: number;

  @Column({ type: 'varchar', length: 10, name: 'journal_sales', default: 'VF' })
  journalSales!: string;

  @Column({ type: 'varchar', length: 10, name: 'journal_cash', default: 'CA' })
  journalCash!: string;

  @Column({ type: 'varchar', length: 100, name: 'regime_imposition', nullable: true })
  regimeImposition!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'centre_impots', nullable: true })
  centreImpots!: string | null;

  @Column({ type: 'varchar', length: 500, name: 'bank_ref', nullable: true })
  bankRef!: string | null;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
