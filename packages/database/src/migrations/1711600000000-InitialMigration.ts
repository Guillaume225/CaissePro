import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1711600000000 implements MigrationInterface {
  name = 'InitialMigration1711600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ────────────────────────────────
     *  ENUM TYPES
     * ──────────────────────────────── */
    await queryRunner.query(`
      CREATE TYPE "payment_method_enum" AS ENUM ('CASH','CHECK','TRANSFER','MOBILE_MONEY');
      CREATE TYPE "expense_status_enum" AS ENUM ('DRAFT','PENDING','APPROVED_L1','APPROVED_L2','PAID','REJECTED','CANCELLED');
      CREATE TYPE "approval_status_enum" AS ENUM ('PENDING','APPROVED','REJECTED');
      CREATE TYPE "advance_status_enum" AS ENUM ('PENDING','PARTIAL','JUSTIFIED','OVERDUE');
      CREATE TYPE "sale_status_enum" AS ENUM ('DRAFT','CONFIRMED','PARTIALLY_PAID','PAID','CANCELLED');
      CREATE TYPE "client_type_enum" AS ENUM ('INDIVIDUAL','COMPANY');
      CREATE TYPE "risk_class_enum" AS ENUM ('A','B','C','D');
      CREATE TYPE "aging_bucket_enum" AS ENUM ('CURRENT','30','60','90','OVERDUE');
      CREATE TYPE "receivable_status_enum" AS ENUM ('OPEN','PARTIAL','PAID','WRITTEN_OFF');
      CREATE TYPE "audit_action_enum" AS ENUM ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','APPROVE','REJECT','EXPORT');
      CREATE TYPE "cash_closing_module_enum" AS ENUM ('EXPENSE','SALE');
      CREATE TYPE "cash_closing_status_enum" AS ENUM ('OPEN','CLOSED','VALIDATED');
      CREATE TYPE "notification_type_enum" AS ENUM ('APPROVAL_REQUEST','EXPENSE_APPROVED','EXPENSE_REJECTED','BUDGET_ALERT','PAYMENT_RECEIVED','ADVANCE_OVERDUE','SYSTEM');
    `);

    /* ────────────────────────────────
     *  TABLES — Transversal
     * ──────────────────────────────── */
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(50) NOT NULL UNIQUE,
        "permissions" jsonb NOT NULL DEFAULT '[]',
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL UNIQUE,
        "manager_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password_hash" varchar(255) NOT NULL,
        "first_name" varchar(100) NOT NULL,
        "last_name" varchar(100) NOT NULL,
        "role_id" uuid NOT NULL REFERENCES "roles"("id"),
        "department_id" uuid REFERENCES "departments"("id"),
        "is_active" boolean NOT NULL DEFAULT true,
        "mfa_enabled" boolean NOT NULL DEFAULT false,
        "mfa_secret" varchar(255),
        "last_login" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_users_email" ON "users"("email");
    `);

    // Now add FK from departments.manager_id -> users.id
    await queryRunner.query(`
      ALTER TABLE "departments"
        ADD CONSTRAINT "FK_departments_manager" FOREIGN KEY ("manager_id") REFERENCES "users"("id");
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "action" audit_action_enum NOT NULL,
        "entity_type" varchar(100) NOT NULL,
        "entity_id" uuid,
        "old_value" jsonb,
        "new_value" jsonb,
        "ip_address" inet,
        "user_agent" text,
        "timestamp" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs"("entity_type","entity_id");
      CREATE INDEX "IDX_audit_logs_user_ts" ON "audit_logs"("user_id","timestamp");
    `);

    await queryRunner.query(`
      CREATE TABLE "cash_closings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "date" date NOT NULL,
        "module" cash_closing_module_enum NOT NULL,
        "opening_balance" decimal(15,2) NOT NULL,
        "total_in" decimal(15,2) NOT NULL,
        "total_out" decimal(15,2) NOT NULL,
        "closing_balance" decimal(15,2) NOT NULL,
        "expected_balance" decimal(15,2) NOT NULL,
        "variance" decimal(15,2) NOT NULL DEFAULT 0,
        "status" cash_closing_status_enum NOT NULL DEFAULT 'OPEN',
        "closed_by" uuid REFERENCES "users"("id"),
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_cash_closings_date_module" ON "cash_closings"("date","module");
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "type" notification_type_enum NOT NULL,
        "title" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "entity_type" varchar(100),
        "entity_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_notifications_user_read" ON "notifications"("user_id","is_read");
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_predictions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "model_name" varchar(100) NOT NULL,
        "entity_type" varchar(100) NOT NULL,
        "entity_id" uuid,
        "prediction" jsonb NOT NULL,
        "confidence" decimal(5,4) NOT NULL,
        "user_feedback" varchar(50),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_ai_predictions_entity" ON "ai_predictions"("entity_type","entity_id");
    `);

    /* ────────────────────────────────
     *  TABLES — Module Dépenses
     * ──────────────────────────────── */
    await queryRunner.query(`
      CREATE TABLE "expense_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "code" varchar(20) NOT NULL UNIQUE,
        "parent_id" uuid REFERENCES "expense_categories"("id"),
        "budget_limit" decimal(15,2),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_expense_categories_code" ON "expense_categories"("code");
    `);

    // Sequence for expense references  DEP-YYYY-NNNNN
    await queryRunner.query(`
      CREATE SEQUENCE expense_ref_seq START 1;
    `);

    await queryRunner.query(`
      CREATE TABLE "expenses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "reference" varchar(20) NOT NULL UNIQUE,
        "date" date NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "description" text,
        "beneficiary" varchar(255),
        "payment_method" payment_method_enum NOT NULL,
        "status" expense_status_enum NOT NULL DEFAULT 'DRAFT',
        "observations" text,
        "category_id" uuid NOT NULL REFERENCES "expense_categories"("id"),
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "cost_center_id" uuid,
        "project_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
      CREATE UNIQUE INDEX "IDX_expenses_reference" ON "expenses"("reference");
      CREATE INDEX "IDX_expenses_status" ON "expenses"("status");
      CREATE INDEX "IDX_expenses_created_by" ON "expenses"("created_by");
      CREATE INDEX "IDX_expenses_date" ON "expenses"("date");
    `);

    await queryRunner.query(`
      CREATE TABLE "expense_approvals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "expense_id" uuid NOT NULL REFERENCES "expenses"("id"),
        "approver_id" uuid NOT NULL REFERENCES "users"("id"),
        "level" smallint NOT NULL CHECK ("level" IN (1,2)),
        "status" approval_status_enum NOT NULL DEFAULT 'PENDING',
        "comment" text,
        "approved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_expense_approvals_exp_level" ON "expense_approvals"("expense_id","level");
    `);

    await queryRunner.query(`
      CREATE TABLE "expense_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "expense_id" uuid NOT NULL REFERENCES "expenses"("id"),
        "file_path" varchar(500) NOT NULL,
        "file_type" varchar(50) NOT NULL,
        "ocr_data" jsonb,
        "original_filename" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "advances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "users"("id"),
        "amount" decimal(15,2) NOT NULL,
        "justified_amount" decimal(15,2) NOT NULL DEFAULT 0,
        "status" advance_status_enum NOT NULL DEFAULT 'PENDING',
        "due_date" date NOT NULL,
        "justification_deadline" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_advances_employee" ON "advances"("employee_id");
      CREATE INDEX "IDX_advances_status" ON "advances"("status");
    `);

    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL REFERENCES "expense_categories"("id"),
        "department_id" uuid NOT NULL REFERENCES "departments"("id"),
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "allocated_amount" decimal(15,2) NOT NULL,
        "consumed_amount" decimal(15,2) NOT NULL DEFAULT 0,
        "alert_thresholds" jsonb NOT NULL DEFAULT '[50,75,90,100]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_budgets_cat_dept_period" UNIQUE ("category_id","department_id","period_start","period_end"),
        CONSTRAINT "CK_budgets_period" CHECK ("period_end" > "period_start")
      );
    `);

    /* ────────────────────────────────
     *  TABLES — Module Vente
     * ──────────────────────────────── */
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(200) NOT NULL,
        "type" client_type_enum NOT NULL,
        "email" varchar(255),
        "phone" varchar(30),
        "address" text,
        "tax_id" varchar(50),
        "credit_limit" decimal(15,2) NOT NULL DEFAULT 0,
        "score" smallint NOT NULL DEFAULT 50 CHECK ("score" >= 0 AND "score" <= 100),
        "risk_class" risk_class_enum NOT NULL DEFAULT 'B',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_clients_name" ON "clients"("name");
      CREATE INDEX "IDX_clients_email" ON "clients"("email");
    `);

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(200) NOT NULL,
        "sku" varchar(50) NOT NULL UNIQUE,
        "category" varchar(100) NOT NULL,
        "unit_price" decimal(15,2) NOT NULL,
        "tax_rate" decimal(5,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_products_sku" ON "products"("sku");
      CREATE INDEX "IDX_products_category" ON "products"("category");
    `);

    // Sequence for sale references  VTE-YYYY-NNNNN
    await queryRunner.query(`
      CREATE SEQUENCE sale_ref_seq START 1;
    `);

    await queryRunner.query(`
      CREATE TABLE "sales" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "reference" varchar(20) NOT NULL UNIQUE,
        "date" date NOT NULL,
        "client_id" uuid REFERENCES "clients"("id"),
        "subtotal" decimal(15,2) NOT NULL DEFAULT 0,
        "tax_amount" decimal(15,2) NOT NULL DEFAULT 0,
        "discount_amount" decimal(15,2) NOT NULL DEFAULT 0,
        "total" decimal(15,2) NOT NULL DEFAULT 0,
        "status" sale_status_enum NOT NULL DEFAULT 'DRAFT',
        "seller_id" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_sales_reference" ON "sales"("reference");
      CREATE INDEX "IDX_sales_status" ON "sales"("status");
      CREATE INDEX "IDX_sales_date" ON "sales"("date");
      CREATE INDEX "IDX_sales_client" ON "sales"("client_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "sale_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_id" uuid NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "products"("id"),
        "quantity" decimal(10,2) NOT NULL,
        "unit_price" decimal(15,2) NOT NULL,
        "discount_percent" decimal(5,2) NOT NULL DEFAULT 0,
        "discount_amount" decimal(15,2) NOT NULL DEFAULT 0,
        "tax_rate" decimal(5,2) NOT NULL DEFAULT 0,
        "subtotal" decimal(15,2) NOT NULL DEFAULT 0
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_id" uuid NOT NULL REFERENCES "sales"("id"),
        "amount" decimal(15,2) NOT NULL,
        "method" payment_method_enum NOT NULL,
        "reference" varchar(100),
        "date" date NOT NULL,
        "received_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_payments_sale" ON "payments"("sale_id");
      CREATE INDEX "IDX_payments_date" ON "payments"("date");
    `);

    await queryRunner.query(`
      CREATE TABLE "receivables" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_id" uuid NOT NULL REFERENCES "sales"("id"),
        "client_id" uuid NOT NULL REFERENCES "clients"("id"),
        "amount_due" decimal(15,2) NOT NULL,
        "amount_paid" decimal(15,2) NOT NULL DEFAULT 0,
        "due_date" date NOT NULL,
        "status" receivable_status_enum NOT NULL DEFAULT 'OPEN',
        "aging_bucket" aging_bucket_enum NOT NULL DEFAULT 'CURRENT',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_receivables_client" ON "receivables"("client_id");
      CREATE INDEX "IDX_receivables_status" ON "receivables"("status");
      CREATE INDEX "IDX_receivables_due_date" ON "receivables"("due_date");
    `);

    /* ────────────────────────────────
     *  TRIGGERS — Auto-generate references
     * ──────────────────────────────── */

    // Expense reference: DEP-YYYY-NNNNN
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_expense_reference()
      RETURNS TRIGGER AS $$
      DECLARE
        seq_val INTEGER;
      BEGIN
        seq_val := nextval('expense_ref_seq');
        NEW.reference := 'DEP-' || EXTRACT(YEAR FROM COALESCE(NEW.date::date, CURRENT_DATE))::TEXT
                         || '-' || LPAD(seq_val::TEXT, 5, '0');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_expense_reference
        BEFORE INSERT ON "expenses"
        FOR EACH ROW
        WHEN (NEW.reference IS NULL OR NEW.reference = '')
        EXECUTE FUNCTION generate_expense_reference();
    `);

    // Sale reference: VTE-YYYY-NNNNN
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_sale_reference()
      RETURNS TRIGGER AS $$
      DECLARE
        seq_val INTEGER;
      BEGIN
        seq_val := nextval('sale_ref_seq');
        NEW.reference := 'VTE-' || EXTRACT(YEAR FROM COALESCE(NEW.date::date, CURRENT_DATE))::TEXT
                         || '-' || LPAD(seq_val::TEXT, 5, '0');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_sale_reference
        BEFORE INSERT ON "sales"
        FOR EACH ROW
        WHEN (NEW.reference IS NULL OR NEW.reference = '')
        EXECUTE FUNCTION generate_sale_reference();
    `);

    // Auto-update updated_at columns
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const tablesWithUpdatedAt = [
      'users', 'roles', 'departments', 'expense_categories',
      'expenses', 'advances', 'budgets', 'clients', 'products',
      'sales', 'receivables',
    ];
    for (const table of tablesWithUpdatedAt) {
      await queryRunner.query(`
        CREATE TRIGGER "trg_${table}_updated_at"
          BEFORE UPDATE ON "${table}"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    const tablesWithUpdatedAt = [
      'users', 'roles', 'departments', 'expense_categories',
      'expenses', 'advances', 'budgets', 'clients', 'products',
      'sales', 'receivables',
    ];
    for (const table of tablesWithUpdatedAt) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_${table}_updated_at" ON "${table}";`);
    }
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_sale_reference ON "sales";`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_expense_reference ON "expenses";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_sale_reference;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_expense_reference;`);

    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "receivables" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budgets" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "advances" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expense_attachments" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expense_approvals" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expense_categories" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_predictions" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_closings" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE;`);

    // Drop sequences
    await queryRunner.query(`DROP SEQUENCE IF EXISTS sale_ref_seq;`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS expense_ref_seq;`);

    // Drop enum types
    await queryRunner.query(`
      DROP TYPE IF EXISTS "notification_type_enum";
      DROP TYPE IF EXISTS "cash_closing_status_enum";
      DROP TYPE IF EXISTS "cash_closing_module_enum";
      DROP TYPE IF EXISTS "audit_action_enum";
      DROP TYPE IF EXISTS "receivable_status_enum";
      DROP TYPE IF EXISTS "aging_bucket_enum";
      DROP TYPE IF EXISTS "risk_class_enum";
      DROP TYPE IF EXISTS "client_type_enum";
      DROP TYPE IF EXISTS "sale_status_enum";
      DROP TYPE IF EXISTS "advance_status_enum";
      DROP TYPE IF EXISTS "approval_status_enum";
      DROP TYPE IF EXISTS "expense_status_enum";
      DROP TYPE IF EXISTS "payment_method_enum";
    `);
  }
}
