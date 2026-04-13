import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum FileModule {
  EXPENSES = 'expenses',
  SALES = 'sales',
  USERS = 'users',
  REPORTS = 'reports',
  GENERAL = 'general',
}

export enum FileStatus {
  UPLOADING = 'UPLOADING',
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'nvarchar', length: 255, name: 'original_name' })
  originalName!: string;

  @Column({ type: 'nvarchar', length: 500, name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'nvarchar', length: 500, name: 'thumbnail_key', nullable: true })
  thumbnailKey!: string | null;

  @Column({ type: 'nvarchar', length: 100, name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'nvarchar', length: 10 })
  extension!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column({
    type: 'simple-enum',
    enum: FileModule,
    default: FileModule.GENERAL,
  })
  module!: FileModule;

  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId!: string | null;

  @Column({
    type: 'simple-enum',
    enum: FileStatus,
    default: FileStatus.ACTIVE,
  })
  status!: FileStatus;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedBy!: string;

  @Column({ type: 'nvarchar', length: 64, name: 'checksum', nullable: true })
  checksum!: string | null;

  @CreateDateColumn({ type: 'datetimeoffset', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetimeoffset', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetimeoffset', name: 'deleted_at' })
  deletedAt!: Date | null;
}
