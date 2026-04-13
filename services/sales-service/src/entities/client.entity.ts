import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Payment } from './payment.entity';

@Entity('clients')
@Index(['email'], { unique: true, where: '"email" IS NOT NULL' })
@Index(['phone'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'credit_limit', default: 0 })
  creditLimit!: number;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => Sale, (s) => s.client)
  sales!: Sale[];

  @OneToMany(() => Payment, (p) => p.client)
  payments!: Payment[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetimeoffset', nullable: true })
  deletedAt!: Date | null;
}
