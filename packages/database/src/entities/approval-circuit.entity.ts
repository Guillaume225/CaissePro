import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { ApprovalCircuitStep } from './approval-circuit-step.entity';

@Entity('approval_circuits')
@Index(['tenantId'])
@Index(['isActive'])
export class ApprovalCircuit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'min_amount' })
  minAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'max_amount', nullable: true })
  maxAmount!: number | null;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => ApprovalCircuitStep, (s) => s.circuit, { cascade: true })
  steps!: ApprovalCircuitStep[];

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
