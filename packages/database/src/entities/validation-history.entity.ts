import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { ValidationAction, ValidationTargetType } from './enums';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

@Entity('validation_history')
@Index(['tenantId'])
@Index(['targetType', 'targetId'])
@Index(['validatorId'])
@Index(['createdAt'])
export class ValidationHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'simple-enum', enum: ValidationTargetType, name: 'target_type' })
  targetType!: ValidationTargetType;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  @Column({ type: 'varchar', length: 30, name: 'target_reference', nullable: true })
  targetReference!: string | null;

  @Column({ type: 'simple-enum', enum: ValidationAction })
  action!: ValidationAction;

  @Column({ type: 'smallint' })
  level!: number;

  @Column({ type: 'uuid', name: 'validator_id' })
  validatorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'validator_id' })
  validator!: User;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
