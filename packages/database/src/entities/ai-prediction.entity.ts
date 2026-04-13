import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('ai_predictions')
@Index(['entityType', 'entityId'])
export class AIPrediction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, name: 'model_name' })
  modelName!: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId!: string | null;

  @Column({ type: 'simple-json' })
  prediction!: Record<string, unknown>;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence!: number;

  @Column({ type: 'varchar', length: 50, name: 'user_feedback', nullable: true })
  userFeedback!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;
}
