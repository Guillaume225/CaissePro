import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from './department.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'uuid', name: 'department_id' })
  departmentId!: string;

  @ManyToOne(() => Department, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
