import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1711600000000 implements MigrationInterface {
  name = 'InitialMigration1711600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ----------------------------------------
     *  TABLES - Transversal
     * ---------------------------------------- */
    await queryRunner.query(`
      CREATE TABLE [roles] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [name] NVARCHAR(50) NOT NULL UNIQUE,
        [permissions] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        [is_system] BIT NOT NULL DEFAULT 0,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE [departments] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [name] NVARCHAR(100) NOT NULL UNIQUE,
        [manager_id] UNIQUEIDENTIFIER NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE [users] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [email] NVARCHAR(255) NOT NULL,
        [password_hash] NVARCHAR(255) NOT NULL,
        [first_name] NVARCHAR(100) NOT NULL,
        [last_name] NVARCHAR(100) NOT NULL,
        [role_id] UNIQUEIDENTIFIER NOT NULL,
        [department_id] UNIQUEIDENTIFIER NULL,
        [is_active] BIT NOT NULL DEFAULT 1,
        [mfa_enabled] BIT NOT NULL DEFAULT 0,
        [mfa_secret] NVARCHAR(255) NULL,
        [last_login] DATETIMEOFFSET NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_users_role] FOREIGN KEY ([role_id]) REFERENCES [roles]([id]),
        CONSTRAINT [FK_users_department] FOREIGN KEY ([department_id]) REFERENCES [departments]([id])
      );
      CREATE UNIQUE INDEX [IDX_users_email] ON [users]([email]);
    `);

    await queryRunner.query(`
      ALTER TABLE [departments]
        ADD CONSTRAINT [FK_departments_manager] FOREIGN KEY ([manager_id]) REFERENCES [users]([id]);
    `);

    await queryRunner.query(`
      CREATE TABLE [audit_logs] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [user_id] UNIQUEIDENTIFIER NULL,
        [action] NVARCHAR(50) NOT NULL CHECK ([action] IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','APPROVE','REJECT','EXPORT')),
        [entity_type] NVARCHAR(100) NOT NULL,
        [entity_id] UNIQUEIDENTIFIER NULL,
        [old_value] NVARCHAR(MAX) NULL,
        [new_value] NVARCHAR(MAX) NULL,
        [ip_address] VARCHAR(45) NULL,
        [user_agent] NVARCHAR(MAX) NULL,
        [timestamp] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );
      CREATE INDEX [IDX_audit_logs_entity] ON [audit_logs]([entity_type],[entity_id]);
      CREATE INDEX [IDX_audit_logs_user_ts] ON [audit_logs]([user_id],[timestamp]);
    `);

    await queryRunner.query(`
      CREATE TABLE [cash_closings] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [date] DATE NOT NULL,
        [module] NVARCHAR(50) NOT NULL CHECK ([module] IN ('EXPENSE','SALE')),
        [opening_balance] DECIMAL(15,2) NOT NULL,
        [total_in] DECIMAL(15,2) NOT NULL,
        [total_out] DECIMAL(15,2) NOT NULL,
        [closing_balance] DECIMAL(15,2) NOT NULL,
        [expected_balance] DECIMAL(15,2) NOT NULL,
        [variance] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [status] NVARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK ([status] IN ('OPEN','CLOSED','VALIDATED')),
        [closed_by] UNIQUEIDENTIFIER NULL,
        [notes] NVARCHAR(MAX) NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_cash_closings_closed_by] FOREIGN KEY ([closed_by]) REFERENCES [users]([id])
      );
      CREATE INDEX [IDX_cash_closings_date_module] ON [cash_closings]([date],[module]);
    `);

    await queryRunner.query(`
      CREATE TABLE [notifications] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [user_id] UNIQUEIDENTIFIER NOT NULL,
        [type] NVARCHAR(50) NOT NULL CHECK ([type] IN ('APPROVAL_REQUEST','EXPENSE_APPROVED','EXPENSE_REJECTED','BUDGET_ALERT','PAYMENT_RECEIVED','ADVANCE_OVERDUE','SYSTEM')),
        [title] NVARCHAR(255) NOT NULL,
        [body] NVARCHAR(MAX) NOT NULL,
        [is_read] BIT NOT NULL DEFAULT 0,
        [entity_type] NVARCHAR(100) NULL,
        [entity_id] UNIQUEIDENTIFIER NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_notifications_user] FOREIGN KEY ([user_id]) REFERENCES [users]([id])
      );
      CREATE INDEX [IDX_notifications_user_read] ON [notifications]([user_id],[is_read]);
    `);

    await queryRunner.query(`
      CREATE TABLE [ai_predictions] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [model_name] NVARCHAR(100) NOT NULL,
        [entity_type] NVARCHAR(100) NOT NULL,
        [entity_id] UNIQUEIDENTIFIER NULL,
        [prediction] NVARCHAR(MAX) NOT NULL,
        [confidence] DECIMAL(5,4) NOT NULL,
        [user_feedback] NVARCHAR(50) NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );
      CREATE INDEX [IDX_ai_predictions_entity] ON [ai_predictions]([entity_type],[entity_id]);
    `);

    /* ----------------------------------------
     *  TABLES - Module Depenses
     * ---------------------------------------- */
    await queryRunner.query(`
      CREATE TABLE [expense_categories] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [name] NVARCHAR(100) NOT NULL,
        [code] NVARCHAR(20) NOT NULL,
        [parent_id] UNIQUEIDENTIFIER NULL,
        [budget_limit] DECIMAL(15,2) NULL,
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_expense_categories_parent] FOREIGN KEY ([parent_id]) REFERENCES [expense_categories]([id])
      );
      CREATE UNIQUE INDEX [IDX_expense_categories_code] ON [expense_categories]([code]);
    `);

    await queryRunner.query(`CREATE SEQUENCE expense_ref_seq START WITH 1 INCREMENT BY 1;`);

    await queryRunner.query(`
      CREATE TABLE [expenses] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [reference] NVARCHAR(20) NOT NULL,
        [date] DATE NOT NULL,
        [amount] DECIMAL(15,2) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [beneficiary] NVARCHAR(255) NULL,
        [payment_method] NVARCHAR(50) NOT NULL CHECK ([payment_method] IN ('CASH','CHECK','TRANSFER','MOBILE_MONEY')),
        [status] NVARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK ([status] IN ('DRAFT','PENDING','APPROVED_L1','APPROVED_L2','PAID','REJECTED','CANCELLED')),
        [observations] NVARCHAR(MAX) NULL,
        [category_id] UNIQUEIDENTIFIER NOT NULL,
        [created_by] UNIQUEIDENTIFIER NOT NULL,
        [cost_center_id] UNIQUEIDENTIFIER NULL,
        [project_id] UNIQUEIDENTIFIER NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [deleted_at] DATETIMEOFFSET NULL,
        CONSTRAINT [FK_expenses_category] FOREIGN KEY ([category_id]) REFERENCES [expense_categories]([id]),
        CONSTRAINT [FK_expenses_created_by] FOREIGN KEY ([created_by]) REFERENCES [users]([id])
      );
      CREATE UNIQUE INDEX [IDX_expenses_reference] ON [expenses]([reference]);
      CREATE INDEX [IDX_expenses_status] ON [expenses]([status]);
      CREATE INDEX [IDX_expenses_created_by] ON [expenses]([created_by]);
      CREATE INDEX [IDX_expenses_date] ON [expenses]([date]);
    `);

    await queryRunner.query(`
      CREATE TABLE [expense_approvals] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [expense_id] UNIQUEIDENTIFIER NOT NULL,
        [approver_id] UNIQUEIDENTIFIER NOT NULL,
        [level] SMALLINT NOT NULL CHECK ([level] IN (1,2)),
        [status] NVARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK ([status] IN ('PENDING','APPROVED','REJECTED')),
        [comment] NVARCHAR(MAX) NULL,
        [approved_at] DATETIMEOFFSET NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_expense_approvals_expense] FOREIGN KEY ([expense_id]) REFERENCES [expenses]([id]),
        CONSTRAINT [FK_expense_approvals_approver] FOREIGN KEY ([approver_id]) REFERENCES [users]([id])
      );
      CREATE UNIQUE INDEX [IDX_expense_approvals_exp_level] ON [expense_approvals]([expense_id],[level]);
    `);

    await queryRunner.query(`
      CREATE TABLE [expense_attachments] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [expense_id] UNIQUEIDENTIFIER NOT NULL,
        [file_path] NVARCHAR(500) NOT NULL,
        [file_type] NVARCHAR(50) NOT NULL,
        [ocr_data] NVARCHAR(MAX) NULL,
        [original_filename] NVARCHAR(255) NOT NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_expense_attachments_expense] FOREIGN KEY ([expense_id]) REFERENCES [expenses]([id])
      );
    `);

    await queryRunner.query(`
      CREATE TABLE [advances] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [employee_id] UNIQUEIDENTIFIER NOT NULL,
        [amount] DECIMAL(15,2) NOT NULL,
        [justified_amount] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [status] NVARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK ([status] IN ('PENDING','PARTIAL','JUSTIFIED','OVERDUE')),
        [due_date] DATE NOT NULL,
        [justification_deadline] DATE NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_advances_employee] FOREIGN KEY ([employee_id]) REFERENCES [users]([id])
      );
      CREATE INDEX [IDX_advances_employee] ON [advances]([employee_id]);
      CREATE INDEX [IDX_advances_status] ON [advances]([status]);
    `);

    await queryRunner.query(`
      CREATE TABLE [budgets] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [category_id] UNIQUEIDENTIFIER NOT NULL,
        [department_id] UNIQUEIDENTIFIER NOT NULL,
        [period_start] DATE NOT NULL,
        [period_end] DATE NOT NULL,
        [allocated_amount] DECIMAL(15,2) NOT NULL,
        [consumed_amount] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [alert_thresholds] NVARCHAR(MAX) NOT NULL DEFAULT '[50,75,90,100]',
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_budgets_category] FOREIGN KEY ([category_id]) REFERENCES [expense_categories]([id]),
        CONSTRAINT [FK_budgets_department] FOREIGN KEY ([department_id]) REFERENCES [departments]([id]),
        CONSTRAINT [UQ_budgets_cat_dept_period] UNIQUE ([category_id],[department_id],[period_start],[period_end]),
        CONSTRAINT [CK_budgets_period] CHECK ([period_end] > [period_start])
      );
    `);

    /* ----------------------------------------
     *  TABLES - Module Vente
     * ---------------------------------------- */
    await queryRunner.query(`
      CREATE TABLE [clients] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [name] NVARCHAR(200) NOT NULL,
        [type] NVARCHAR(50) NOT NULL CHECK ([type] IN ('INDIVIDUAL','COMPANY')),
        [email] NVARCHAR(255) NULL,
        [phone] NVARCHAR(30) NULL,
        [address] NVARCHAR(MAX) NULL,
        [tax_id] NVARCHAR(50) NULL,
        [credit_limit] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [score] SMALLINT NOT NULL DEFAULT 50 CHECK ([score] >= 0 AND [score] <= 100),
        [risk_class] NVARCHAR(10) NOT NULL DEFAULT 'B' CHECK ([risk_class] IN ('A','B','C','D')),
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );
      CREATE INDEX [IDX_clients_name] ON [clients]([name]);
      CREATE INDEX [IDX_clients_email] ON [clients]([email]);
    `);

    await queryRunner.query(`
      CREATE TABLE [products] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [name] NVARCHAR(200) NOT NULL,
        [sku] NVARCHAR(50) NOT NULL,
        [category] NVARCHAR(100) NOT NULL,
        [unit_price] DECIMAL(15,2) NOT NULL,
        [tax_rate] DECIMAL(5,2) NOT NULL DEFAULT 0,
        [is_active] BIT NOT NULL DEFAULT 1,
        [description] NVARCHAR(MAX) NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
      );
      CREATE UNIQUE INDEX [IDX_products_sku] ON [products]([sku]);
      CREATE INDEX [IDX_products_category] ON [products]([category]);
    `);

    await queryRunner.query(`CREATE SEQUENCE sale_ref_seq START WITH 1 INCREMENT BY 1;`);

    await queryRunner.query(`
      CREATE TABLE [sales] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [reference] NVARCHAR(20) NOT NULL,
        [date] DATE NOT NULL,
        [client_id] UNIQUEIDENTIFIER NULL,
        [subtotal] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [tax_amount] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [discount_amount] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [total] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [status] NVARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK ([status] IN ('DRAFT','CONFIRMED','PARTIALLY_PAID','PAID','CANCELLED')),
        [seller_id] UNIQUEIDENTIFIER NOT NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_sales_client] FOREIGN KEY ([client_id]) REFERENCES [clients]([id]),
        CONSTRAINT [FK_sales_seller] FOREIGN KEY ([seller_id]) REFERENCES [users]([id])
      );
      CREATE UNIQUE INDEX [IDX_sales_reference] ON [sales]([reference]);
      CREATE INDEX [IDX_sales_status] ON [sales]([status]);
      CREATE INDEX [IDX_sales_date] ON [sales]([date]);
      CREATE INDEX [IDX_sales_client] ON [sales]([client_id]);
    `);

    await queryRunner.query(`
      CREATE TABLE [sale_items] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [sale_id] UNIQUEIDENTIFIER NOT NULL,
        [product_id] UNIQUEIDENTIFIER NOT NULL,
        [quantity] DECIMAL(10,2) NOT NULL,
        [unit_price] DECIMAL(15,2) NOT NULL,
        [discount_percent] DECIMAL(5,2) NOT NULL DEFAULT 0,
        [discount_amount] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [tax_rate] DECIMAL(5,2) NOT NULL DEFAULT 0,
        [subtotal] DECIMAL(15,2) NOT NULL DEFAULT 0,
        CONSTRAINT [FK_sale_items_sale] FOREIGN KEY ([sale_id]) REFERENCES [sales]([id]) ON DELETE CASCADE,
        CONSTRAINT [FK_sale_items_product] FOREIGN KEY ([product_id]) REFERENCES [products]([id])
      );
    `);

    await queryRunner.query(`
      CREATE TABLE [payments] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [sale_id] UNIQUEIDENTIFIER NOT NULL,
        [amount] DECIMAL(15,2) NOT NULL,
        [method] NVARCHAR(50) NOT NULL CHECK ([method] IN ('CASH','CHECK','TRANSFER','MOBILE_MONEY')),
        [reference] NVARCHAR(100) NULL,
        [date] DATE NOT NULL,
        [received_by] UNIQUEIDENTIFIER NOT NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_payments_sale] FOREIGN KEY ([sale_id]) REFERENCES [sales]([id]),
        CONSTRAINT [FK_payments_received_by] FOREIGN KEY ([received_by]) REFERENCES [users]([id])
      );
      CREATE INDEX [IDX_payments_sale] ON [payments]([sale_id]);
      CREATE INDEX [IDX_payments_date] ON [payments]([date]);
    `);

    await queryRunner.query(`
      CREATE TABLE [receivables] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [sale_id] UNIQUEIDENTIFIER NOT NULL,
        [client_id] UNIQUEIDENTIFIER NOT NULL,
        [amount_due] DECIMAL(15,2) NOT NULL,
        [amount_paid] DECIMAL(15,2) NOT NULL DEFAULT 0,
        [due_date] DATE NOT NULL,
        [status] NVARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK ([status] IN ('OPEN','PARTIAL','PAID','WRITTEN_OFF')),
        [aging_bucket] NVARCHAR(50) NOT NULL DEFAULT 'CURRENT' CHECK ([aging_bucket] IN ('CURRENT','30','60','90','OVERDUE')),
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_receivables_sale] FOREIGN KEY ([sale_id]) REFERENCES [sales]([id]),
        CONSTRAINT [FK_receivables_client] FOREIGN KEY ([client_id]) REFERENCES [clients]([id])
      );
      CREATE INDEX [IDX_receivables_client] ON [receivables]([client_id]);
      CREATE INDEX [IDX_receivables_status] ON [receivables]([status]);
      CREATE INDEX [IDX_receivables_due_date] ON [receivables]([due_date]);
    `);

    /* ----------------------------------------
     *  TRIGGERS - Auto-generate references
     * ---------------------------------------- */

    // Expense reference: DEP-YYYY-NNNNN
    await queryRunner.query(`
      CREATE TRIGGER [trg_expense_reference]
      ON [expenses]
      INSTEAD OF INSERT
      AS
      BEGIN
        SET NOCOUNT ON;

        -- Cursor-based approach to handle NEXT VALUE FOR per row
        DECLARE @id UNIQUEIDENTIFIER, @reference NVARCHAR(255), @date DATE,
                @amount DECIMAL(15,2), @description NVARCHAR(MAX), @beneficiary NVARCHAR(255),
                @payment_method NVARCHAR(50), @status NVARCHAR(50), @observations NVARCHAR(MAX),
                @category_id UNIQUEIDENTIFIER, @created_by UNIQUEIDENTIFIER,
                @cost_center_id NVARCHAR(255), @project_id NVARCHAR(255),
                @created_at DATETIMEOFFSET, @updated_at DATETIMEOFFSET, @deleted_at DATETIMEOFFSET;

        DECLARE ins_cursor CURSOR LOCAL FAST_FORWARD FOR
          SELECT [id],[reference],[date],[amount],[description],[beneficiary],
                 [payment_method],[status],[observations],[category_id],[created_by],
                 [cost_center_id],[project_id],[created_at],[updated_at],[deleted_at]
          FROM inserted;

        OPEN ins_cursor;
        FETCH NEXT FROM ins_cursor INTO @id, @reference, @date, @amount, @description, @beneficiary,
              @payment_method, @status, @observations, @category_id, @created_by,
              @cost_center_id, @project_id, @created_at, @updated_at, @deleted_at;

        WHILE @@FETCH_STATUS = 0
        BEGIN
          IF @reference IS NULL OR @reference = ''
            SET @reference = 'DEP-' + CAST(YEAR(ISNULL(@date, GETDATE())) AS NVARCHAR) + '-' + RIGHT('00000' + CAST(NEXT VALUE FOR expense_ref_seq AS NVARCHAR), 5);

          INSERT INTO [expenses] (
            [id],[reference],[date],[amount],[description],[beneficiary],
            [payment_method],[status],[observations],[category_id],[created_by],
            [cost_center_id],[project_id],[created_at],[updated_at],[deleted_at]
          ) VALUES (
            ISNULL(@id, NEWID()), @reference, @date, @amount, @description, @beneficiary,
            @payment_method, ISNULL(@status,'DRAFT'), @observations, @category_id, @created_by,
            @cost_center_id, @project_id,
            ISNULL(@created_at, SYSDATETIMEOFFSET()),
            ISNULL(@updated_at, SYSDATETIMEOFFSET()),
            @deleted_at
          );

          FETCH NEXT FROM ins_cursor INTO @id, @reference, @date, @amount, @description, @beneficiary,
                @payment_method, @status, @observations, @category_id, @created_by,
                @cost_center_id, @project_id, @created_at, @updated_at, @deleted_at;
        END

        CLOSE ins_cursor;
        DEALLOCATE ins_cursor;
      END;
    `);

    // Sale reference: VTE-YYYY-NNNNN
    await queryRunner.query(`
      CREATE TRIGGER [trg_sale_reference]
      ON [sales]
      INSTEAD OF INSERT
      AS
      BEGIN
        SET NOCOUNT ON;

        DECLARE @id UNIQUEIDENTIFIER, @reference NVARCHAR(255), @date DATE,
                @client_id UNIQUEIDENTIFIER, @subtotal DECIMAL(15,2), @tax_amount DECIMAL(15,2),
                @discount_amount DECIMAL(15,2), @total DECIMAL(15,2), @status NVARCHAR(50),
                @seller_id UNIQUEIDENTIFIER, @created_at DATETIMEOFFSET, @updated_at DATETIMEOFFSET;

        DECLARE ins_cursor CURSOR LOCAL FAST_FORWARD FOR
          SELECT [id],[reference],[date],[client_id],[subtotal],[tax_amount],
                 [discount_amount],[total],[status],[seller_id],[created_at],[updated_at]
          FROM inserted;

        OPEN ins_cursor;
        FETCH NEXT FROM ins_cursor INTO @id, @reference, @date, @client_id, @subtotal, @tax_amount,
              @discount_amount, @total, @status, @seller_id, @created_at, @updated_at;

        WHILE @@FETCH_STATUS = 0
        BEGIN
          IF @reference IS NULL OR @reference = ''
            SET @reference = 'VTE-' + CAST(YEAR(ISNULL(@date, GETDATE())) AS NVARCHAR) + '-' + RIGHT('00000' + CAST(NEXT VALUE FOR sale_ref_seq AS NVARCHAR), 5);

          INSERT INTO [sales] (
            [id],[reference],[date],[client_id],[subtotal],[tax_amount],
            [discount_amount],[total],[status],[seller_id],[created_at],[updated_at]
          ) VALUES (
            ISNULL(@id, NEWID()), @reference, @date, @client_id, ISNULL(@subtotal,0), ISNULL(@tax_amount,0),
            ISNULL(@discount_amount,0), ISNULL(@total,0), ISNULL(@status,'DRAFT'),
            @seller_id,
            ISNULL(@created_at, SYSDATETIMEOFFSET()),
            ISNULL(@updated_at, SYSDATETIMEOFFSET())
          );

          FETCH NEXT FROM ins_cursor INTO @id, @reference, @date, @client_id, @subtotal, @tax_amount,
                @discount_amount, @total, @status, @seller_id, @created_at, @updated_at;
        END

        CLOSE ins_cursor;
        DEALLOCATE ins_cursor;
      END;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `IF OBJECT_ID('trg_sale_reference', 'TR') IS NOT NULL DROP TRIGGER [trg_sale_reference];`,
    );
    await queryRunner.query(
      `IF OBJECT_ID('trg_expense_reference', 'TR') IS NOT NULL DROP TRIGGER [trg_expense_reference];`,
    );

    // Drop FK constraints, then tables in reverse dependency order
    const tables = [
      'receivables',
      'payments',
      'sale_items',
      'sales',
      'products',
      'clients',
      'budgets',
      'advances',
      'expense_attachments',
      'expense_approvals',
      'expenses',
      'expense_categories',
      'ai_predictions',
      'notifications',
      'cash_closings',
      'audit_logs',
      'users',
      'departments',
      'roles',
    ];

    for (const table of tables) {
      const fks = await queryRunner.query(
        `SELECT name FROM sys.foreign_keys WHERE OBJECT_NAME(parent_object_id) = '${table}'`,
      );
      for (const fk of fks) {
        await queryRunner.query(`ALTER TABLE [${table}] DROP CONSTRAINT [${fk.name}];`);
      }
    }

    for (const table of tables) {
      await queryRunner.query(`IF OBJECT_ID('${table}', 'U') IS NOT NULL DROP TABLE [${table}];`);
    }

    // Drop sequences
    await queryRunner.query(
      `IF OBJECT_ID('sale_ref_seq', 'SO') IS NOT NULL DROP SEQUENCE [sale_ref_seq];`,
    );
    await queryRunner.query(
      `IF OBJECT_ID('expense_ref_seq', 'SO') IS NOT NULL DROP SEQUENCE [expense_ref_seq];`,
    );
  }
}
