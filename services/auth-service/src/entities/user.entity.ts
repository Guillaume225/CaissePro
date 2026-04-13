import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { Role } from './role.entity';
import { Company } from './company.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId!: string;

  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  departmentId!: string | null;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => Company, { nullable: true, eager: false })
  @JoinColumn({ name: 'company_id' })
  company!: Company | null;

  @ManyToMany(() => Company, { eager: false })
  @JoinTable({
    name: 'user_companies',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'company_id', referencedColumnName: 'id' },
  })
  companies!: Company[];

  @Column({ type: 'nvarchar', length: 500, name: 'allowed_modules', nullable: true })
  allowedModules!: string | null;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'bit', name: 'mfa_enabled', default: false })
  mfaEnabled!: boolean;

  @Column({ type: 'varchar', length: 255, name: 'mfa_secret', nullable: true })
  mfaSecret!: string | null;

  @Column({ type: 'datetimeoffset', name: 'last_login', nullable: true })
  lastLogin!: Date | null;

  @Column({ type: 'varchar', length: 500, name: 'password_reset_token', nullable: true })
  passwordResetToken!: string | null;

  @Column({ type: 'datetimeoffset', name: 'password_reset_expires', nullable: true })
  passwordResetExpires!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetimeoffset', nullable: true })
  deletedAt!: Date | null;
}
