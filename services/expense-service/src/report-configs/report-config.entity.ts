import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../entities/user.entity';

@Entity('report_configs')
@Index(['tenantId'])
@Index(['tenantId', 'reportId'], { unique: true })
export class ReportConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50, name: 'report_id' })
  reportId!: string;

  @Column({ type: 'nvarchar', length: 200, name: 'report_name' })
  reportName!: string;

  @Column({ type: 'nvarchar', length: 'max', name: 'config_json' })
  configJson!: string;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
