-- Migration: Add accounting account columns to expense_categories
-- Date: 2026-04-01

IF NOT EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('expense_categories') AND name = 'accounting_debit_account'
)
BEGIN
  ALTER TABLE expense_categories ADD accounting_debit_account NVARCHAR(20) NULL;
  ALTER TABLE expense_categories ADD accounting_credit_account NVARCHAR(20) NULL;
  PRINT 'Columns added successfully';
END
ELSE
BEGIN
  PRINT 'Columns already exist';
END
GO

-- Seed default OHADA accounting accounts for existing categories
UPDATE expense_categories SET accounting_debit_account = '601000', accounting_credit_account = '512000'
WHERE code = 'FOUR' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '601100', accounting_credit_account = '512000'
WHERE code = 'FOUR-BUR' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '601200', accounting_credit_account = '512000'
WHERE code = 'FOUR-INF' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '613000', accounting_credit_account = '512000'
WHERE code = 'LOYER' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '641000', accounting_credit_account = '421000'
WHERE code = 'SAL' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '641100', accounting_credit_account = '421000'
WHERE code = 'SAL-PERM' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '622000', accounting_credit_account = '401000'
WHERE code = 'SAL-CONS' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '625000', accounting_credit_account = '512000'
WHERE code = 'TRANS' AND accounting_debit_account IS NULL;

UPDATE expense_categories SET accounting_debit_account = '623000', accounting_credit_account = '512000'
WHERE code = 'MKT' AND accounting_debit_account IS NULL;

PRINT 'Accounting accounts seeded';
GO

-- Verify
SELECT code, name, accounting_debit_account, accounting_credit_account FROM expense_categories;
GO
