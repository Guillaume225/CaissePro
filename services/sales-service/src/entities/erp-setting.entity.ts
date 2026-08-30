import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('erp_settings')
@Index(['companyId'], { unique: true })
export class ErpSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  /** ERP system name (sage, odoo, etc.) */
  @Column({ type: 'varchar', length: 50, name: 'erp_name', default: 'sage' })
  erpName!: string;

  /** Base API URL (e.g. https://dcp-sage.fr:8084) */
  @Column({ type: 'varchar', length: 1000, name: 'api_url' })
  apiUrl!: string;

  /** Access token for the ERP API */
  @Column({ type: 'varchar', length: 4000, name: 'access_token' })
  accessToken!: string;

  /** Queue name (default: QTask) */
  @Column({ type: 'varchar', length: 100, name: 'queue_name', default: 'QTask' })
  queueName!: string;

  /** Processus class name */
  @Column({ type: 'varchar', length: 255, name: 'processus_class', default: 'TProcessusImportEcritureFA' })
  processusClass!: string;

  /** Processus method name */
  @Column({ type: 'varchar', length: 255, name: 'processus_method', default: 'ExecuterAutomate' })
  processusMethod!: string;

  /** Parameters class name */
  @Column({ type: 'varchar', length: 255, name: 'parameters_class', default: 'TParametreImportEcriture' })
  parametersClass!: string;

  /** Parameters code */
  @Column({ type: 'varchar', length: 255, name: 'parameters_code', default: 'GenerationAPI_Tresorerie' })
  parametersCode!: string;

  /** Default journal code for accounting entries */
  @Column({ type: 'varchar', length: 10, name: 'default_journal_code', default: 'VF' })
  defaultJournalCode!: string;

  /** Default piece type (FA = Facture) */
  @Column({ type: 'varchar', length: 50, name: 'default_piece_type', default: 'FA' })
  defaultPieceType!: string;

  /** Auto-post entries to ERP when invoice is certified */
  @Column({ type: 'bit', name: 'auto_post_on_certify', default: false })
  autoPostOnCertify!: boolean;

  /** Auto-post entries to ERP when cash closing is done */
  @Column({ type: 'bit', name: 'auto_post_on_closing', default: false })
  autoPostOnClosing!: boolean;

  /** Certify invoice after accounting entries are generated (instead of before) */
  @Column({ type: 'bit', name: 'certify_after_accounting', default: false })
  certifyAfterAccounting!: boolean;

  @Column({ type: 'bit', name: 'is_active', default: true })
  isActive!: boolean;

  /**
   * Paramètres du processus Sage dédié aux bons de commande (e-DA), distinct
   * du processus factures/écritures ci-dessus (className/parameters différents
   * côté Sage — TProcessusImportContrat / TParametreImportContrat). L'hôte
   * (apiUrl) et le jeton (accessToken) restent partagés avec la config FNE.
   */
  @Column({ type: 'varchar', length: 100, name: 'po_queue_name', default: 'QTask' })
  poQueueName!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_processus_class', default: 'TProcessusImportContrat' })
  poProcessusClass!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_processus_method', default: 'ExecuterAutomate' })
  poProcessusMethod!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_parameters_class', default: 'TParametreImportContrat' })
  poParametersClass!: string;

  @Column({ type: 'varchar', length: 255, name: 'po_parameters_code', default: 'GenerationAPI_CommandeAchat' })
  poParametersCode!: string;

  /** Envoie le bon de commande vers Sage dès sa génération (étape "Proposition d'achat"). */
  @Column({ type: 'bit', name: 'auto_post_purchase_orders', default: true })
  autoPostPurchaseOrders!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetimeoffset' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetimeoffset' })
  updatedAt!: Date;
}
