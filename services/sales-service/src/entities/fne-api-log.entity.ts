import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('fne_api_logs')
@Index(['invoiceId'])
@Index(['createdAt'])
export class FneApiLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'invoice_id', nullable: true })
  invoiceId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  method!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'simple-json', name: 'request_body', nullable: true })
  requestBody!: Record<string, unknown> | null;

  @Column({ type: 'int', name: 'response_status', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'simple-json', name: 'response_body', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 1000, name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', name: 'attempt_number', default: 1 })
  attemptNumber!: number;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
