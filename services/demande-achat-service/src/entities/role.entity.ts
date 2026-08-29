import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Lightweight Role entity for read-only joins (resolving which users hold a
 * given permission, e.g. to notify the purchasing team).
 * The canonical Role entity lives in auth-service.
 *
 * `synchronize: false` here is required, not optional — see user.entity.ts
 * for why (this maps the shared `roles` table).
 */
@Entity({ name: 'roles', synchronize: false })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({
    type: 'nvarchar',
    length: 'MAX',
    default: '[]',
    transformer: {
      to: (val: string[]) => JSON.stringify(val ?? []),
      from: (val: string) => {
        try {
          return JSON.parse(val ?? '[]');
        } catch {
          return [];
        }
      },
    },
  })
  permissions!: string[];
}
