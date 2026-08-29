import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Lightweight User entity for read-only joins.
 * The canonical User entity (and its full column set) lives in auth-service.
 *
 * `synchronize: false` here is required, not optional: this entity maps the
 * shared `users` table, and TypeORM's schema synchronizer would otherwise try
 * to reconcile the ENTIRE table to match this partial definition — i.e. drop
 * every column not declared below (email, password_hash, role_id, service_id,
 * etc.). Excluding it from synchronize keeps this DataSource able to query
 * the table without ever attempting to alter it.
 */
@Entity({ name: 'users', synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;
}
