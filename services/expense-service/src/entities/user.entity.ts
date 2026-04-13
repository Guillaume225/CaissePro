import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Lightweight User entity for read-only joins.
 * The canonical User entity lives in auth-service.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;
}
