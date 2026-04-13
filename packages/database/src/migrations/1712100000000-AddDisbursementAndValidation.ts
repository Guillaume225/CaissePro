import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisbursementAndValidation1712100000000 implements MigrationInterface {
  name = 'AddDisbursementAndValidation1712100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Approval Circuits ─────────────────────────────
    await queryRunner.query(`
      CREATE TABLE approval_circuits (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        tenant_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(100) NOT NULL,
        min_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        max_amount DECIMAL(15,2) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_approval_circuits PRIMARY KEY (id),
        CONSTRAINT FK_approval_circuits_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IDX_approval_circuits_tenant ON approval_circuits(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IDX_approval_circuits_active ON approval_circuits(is_active)`);

    // ── Approval Circuit Steps ────────────────────────
    await queryRunner.query(`
      CREATE TABLE approval_circuit_steps (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        circuit_id UNIQUEIDENTIFIER NOT NULL,
        level SMALLINT NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('CHEF_COMPTABLE', 'DAF', 'DG')),
        approver_id UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT PK_approval_circuit_steps PRIMARY KEY (id),
        CONSTRAINT FK_acs_circuit FOREIGN KEY (circuit_id) REFERENCES approval_circuits(id) ON DELETE CASCADE,
        CONSTRAINT FK_acs_approver FOREIGN KEY (approver_id) REFERENCES users(id),
        CONSTRAINT UQ_acs_circuit_level UNIQUE (circuit_id, level)
      )
    `);

    // ── Disbursement Requests ─────────────────────────
    await queryRunner.query(`
      CREATE TABLE disbursement_requests (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        tenant_id UNIQUEIDENTIFIER NOT NULL,
        reference VARCHAR(20) NOT NULL,
        last_name NVARCHAR(100) NOT NULL,
        first_name NVARCHAR(100) NOT NULL,
        position NVARCHAR(100) NULL,
        service NVARCHAR(100) NULL,
        phone VARCHAR(30) NULL,
        matricule VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        amount DECIMAL(15,2) NOT NULL,
        reason NVARCHAR(1000) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED')),
        processed_by UNIQUEIDENTIFIER NULL,
        linked_expense_id UNIQUEIDENTIFIER NULL,
        comment NVARCHAR(MAX) NULL,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_disbursement_requests PRIMARY KEY (id),
        CONSTRAINT FK_dr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT FK_dr_processed_by FOREIGN KEY (processed_by) REFERENCES users(id),
        CONSTRAINT FK_dr_linked_expense FOREIGN KEY (linked_expense_id) REFERENCES expenses(id),
        CONSTRAINT UQ_dr_reference UNIQUE (reference)
      )
    `);
    await queryRunner.query(`CREATE INDEX IDX_dr_tenant ON disbursement_requests(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IDX_dr_status ON disbursement_requests(status)`);
    await queryRunner.query(`CREATE INDEX IDX_dr_reference ON disbursement_requests(reference)`);
    await queryRunner.query(`CREATE INDEX IDX_dr_created ON disbursement_requests(created_at)`);

    // ── Sequence for disbursement request references ──
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.sequences WHERE name = 'disbursement_request_seq')
        CREATE SEQUENCE disbursement_request_seq START WITH 1 INCREMENT BY 1
    `);

    // ── Auto-reference trigger for disbursement requests
    await queryRunner.query(`
      CREATE TRIGGER trg_disbursement_request_ref
      ON disbursement_requests
      AFTER INSERT
      AS
      BEGIN
        SET NOCOUNT ON;
        UPDATE dr
        SET reference = 'DEM-' + CAST(YEAR(GETDATE()) AS VARCHAR) + '-' + RIGHT('00000' + CAST(NEXT VALUE FOR disbursement_request_seq AS VARCHAR), 5)
        FROM disbursement_requests dr
        INNER JOIN inserted i ON dr.id = i.id
        WHERE dr.reference = '' OR dr.reference IS NULL;
      END
    `);

    // ── Validation History ────────────────────────────
    await queryRunner.query(`
      CREATE TABLE validation_history (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        tenant_id UNIQUEIDENTIFIER NOT NULL,
        target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('EXPENSE', 'DISBURSEMENT_REQUEST')),
        target_id UNIQUEIDENTIFIER NOT NULL,
        target_reference VARCHAR(30) NULL,
        action VARCHAR(10) NOT NULL CHECK (action IN ('APPROVED', 'REJECTED')),
        level SMALLINT NOT NULL,
        validator_id UNIQUEIDENTIFIER NOT NULL,
        comment NVARCHAR(MAX) NULL,
        amount DECIMAL(15,2) NULL,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_validation_history PRIMARY KEY (id),
        CONSTRAINT FK_vh_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT FK_vh_validator FOREIGN KEY (validator_id) REFERENCES users(id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IDX_vh_tenant ON validation_history(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IDX_vh_target ON validation_history(target_type, target_id)`);
    await queryRunner.query(`CREATE INDEX IDX_vh_validator ON validation_history(validator_id)`);
    await queryRunner.query(`CREATE INDEX IDX_vh_created ON validation_history(created_at)`);

    // ── Add approval_circuit_id to expenses table ─────
    await queryRunner.query(`
      ALTER TABLE expenses ADD approval_circuit_id UNIQUEIDENTIFIER NULL
    `);
    await queryRunner.query(`
      ALTER TABLE expenses ADD CONSTRAINT FK_expenses_approval_circuit
        FOREIGN KEY (approval_circuit_id) REFERENCES approval_circuits(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove FK from expenses
    await queryRunner.query(`ALTER TABLE expenses DROP CONSTRAINT FK_expenses_approval_circuit`);
    await queryRunner.query(`ALTER TABLE expenses DROP COLUMN approval_circuit_id`);

    // Drop trigger + sequence
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_disbursement_request_ref`);
    await queryRunner.query(`IF EXISTS (SELECT * FROM sys.sequences WHERE name = 'disbursement_request_seq') DROP SEQUENCE disbursement_request_seq`);

    // Drop tables in dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS validation_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS disbursement_requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS approval_circuit_steps`);
    await queryRunner.query(`DROP TABLE IF EXISTS approval_circuits`);
  }
}
