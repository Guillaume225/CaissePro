import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Fournisseur — alimenté automatiquement quand un acheteur génère un bon de
 * commande (voir PurchaseRequestsService.process), pour être resélectionnable
 * sur une future demande sans ressaisir ses informations.
 */
@Entity('suppliers')
@Index(['code'], { unique: true })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  /** Numéro CC (compte contribuable) */
  @Column({ type: 'varchar', length: 100, name: 'tax_number' })
  taxNumber!: string;

  /** RCCM (registre du commerce et du crédit mobilier) */
  @Column({ type: 'varchar', length: 100 })
  rccm!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
