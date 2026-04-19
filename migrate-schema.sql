-- CaisseFlow Schema Migration: add ALL missing columns/tables
-- Run with: sqlcmd -S localhost -U sa -P "Toi&MoiSaFait1" -d caisseflow -C -i migrate-schema.sql

-- ============ cash_days: add missing columns ============
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('cash_days') AND name='cash_type')
  ALTER TABLE cash_days ADD cash_type nvarchar(50) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('cash_days') AND name='accounting_processed')
  ALTER TABLE cash_days ADD accounting_processed bit DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('cash_days') AND name='accounting_processed_at')
  ALTER TABLE cash_days ADD accounting_processed_at datetimeoffset NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('cash_days') AND name='accounting_processed_by')
  ALTER TABLE cash_days ADD accounting_processed_by nvarchar(255) NULL;

-- ============ expenses: add missing columns ============
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('expenses') AND name='department_id')
  ALTER TABLE expenses ADD department_id uniqueidentifier NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('expenses') AND name='cash_day_id')
  ALTER TABLE expenses ADD cash_day_id uniqueidentifier NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('expenses') AND name='disbursement_request_id')
  ALTER TABLE expenses ADD disbursement_request_id uniqueidentifier NULL;

-- ============ expense_categories: add missing column ============
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('expense_categories') AND name='direction')
  ALTER TABLE expense_categories ADD direction nvarchar(50) NULL;

-- ============ advances: add missing column ============
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('advances') AND name='reason')
  ALTER TABLE advances ADD reason nvarchar(max) NULL;

-- ============ fne_invoices: add missing columns ============
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('fne_invoices') AND name='decision_comment')
  ALTER TABLE fne_invoices ADD decision_comment nvarchar(max) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('fne_invoices') AND name='created_by')
BEGIN
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('fne_invoices') AND name='created_by_id')
    EXEC sp_rename 'fne_invoices.created_by_id', 'created_by', 'COLUMN';
  ELSE
    ALTER TABLE fne_invoices ADD created_by nvarchar(255) NULL;
END

-- ============ fne_settings (new table) ============
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='fne_settings')
  CREATE TABLE fne_settings (
    id uniqueidentifier DEFAULT NEWID() PRIMARY KEY,
    company_id uniqueidentifier NULL,
    api_url nvarchar(500) NULL,
    api_key nvarchar(500) NULL,
    nif nvarchar(100) NULL,
    max_retries int DEFAULT 3,
    journal_sales nvarchar(50) NULL,
    journal_cash nvarchar(50) NULL,
    regime_imposition nvarchar(100) NULL,
    centre_impots nvarchar(200) NULL,
    bank_ref nvarchar(200) NULL,
    is_active bit DEFAULT 1,
    created_at datetimeoffset DEFAULT SYSDATETIMEOFFSET(),
    updated_at datetimeoffset DEFAULT SYSDATETIMEOFFSET()
  );

-- ============ fne_establishments (new table) ============
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='fne_establishments')
  CREATE TABLE fne_establishments (
    id uniqueidentifier DEFAULT NEWID() PRIMARY KEY,
    company_id uniqueidentifier NULL,
    name nvarchar(200) NOT NULL,
    address nvarchar(500) NULL,
    is_active bit DEFAULT 1,
    created_at datetimeoffset DEFAULT SYSDATETIMEOFFSET(),
    updated_at datetimeoffset DEFAULT SYSDATETIMEOFFSET()
  );

-- ============ fne_points_of_sale (new table) ============
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='fne_points_of_sale')
  CREATE TABLE fne_points_of_sale (
    id uniqueidentifier DEFAULT NEWID() PRIMARY KEY,
    establishment_id uniqueidentifier NULL,
    name nvarchar(200) NOT NULL,
    address nvarchar(500) NULL,
    is_active bit DEFAULT 1,
    created_at datetimeoffset DEFAULT SYSDATETIMEOFFSET(),
    updated_at datetimeoffset DEFAULT SYSDATETIMEOFFSET()
  );

-- ============ fne_accounting_entries (new table) ============
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='fne_accounting_entries')
  CREATE TABLE fne_accounting_entries (
    id uniqueidentifier DEFAULT NEWID() PRIMARY KEY,
    invoice_id uniqueidentifier NULL,
    invoice_reference nvarchar(100) NULL,
    journal_code nvarchar(50) NULL,
    entry_date datetimeoffset NULL,
    account_number nvarchar(50) NULL,
    account_label nvarchar(200) NULL,
    debit decimal(18,2) DEFAULT 0,
    credit decimal(18,2) DEFAULT 0,
    label nvarchar(500) NULL,
    operation_type nvarchar(50) NULL,
    created_by nvarchar(255) NULL,
    created_at datetimeoffset DEFAULT SYSDATETIMEOFFSET()
  );

PRINT 'Schema migration complete';
SELECT 'ALL DONE' AS result;
GO
