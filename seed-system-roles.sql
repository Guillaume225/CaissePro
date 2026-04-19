-- Seed system roles for CaisseFlow
-- Based on ROLE_PERMISSIONS in auth-service/src/common/permissions.ts

DECLARE @tid UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';

-- 1. Update ADMIN: ensure is_system=1 and has ALL 48 permissions
UPDATE roles SET 
  is_system = 1,
  permissions = '["expense.create","expense.read","expense.update","expense.delete","expense.approve_l1","expense.approve_l2","expense.pay","expense.cancel","expense.export","sale.create","sale.read","sale.update","sale.delete","sale.export","payment.create","payment.read","client.create","client.read","client.update","client.delete","product.create","product.read","product.update","product.delete","budget.create","budget.read","budget.update","user.create","user.read","user.update","user.delete","role.create","role.read","role.update","audit.read","report.read","report.export","dashboard.read","cash_closing.create","cash_closing.read","cash_closing.validate","company.create","company.read","company.update","fne.create","fne.read","fne.update","fne.credit_note"]',
  updated_at = SYSDATETIMEOFFSET()
WHERE name = 'ADMIN';
PRINT 'ADMIN updated';

-- 2. Update FACTURIER_FNE: set is_system=1, ensure 12 correct permissions
UPDATE roles SET 
  is_system = 1,
  permissions = '["fne.create","fne.read","fne.update","fne.credit_note","client.create","client.read","client.update","product.read","dashboard.read","report.read","report.export","company.read"]',
  updated_at = SYSDATETIMEOFFSET()
WHERE name = 'FACTURIER_FNE';
PRINT 'FACTURIER_FNE updated';

-- 3. ACCOUNTANT (COMPTABLE) - 13 permissions - system role
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'ACCOUNTANT')
  INSERT INTO roles (id, tenant_id, name, permissions, is_system, created_at, updated_at)
  VALUES (
    NEWID(), @tid, 'ACCOUNTANT',
    '["expense.read","expense.export","sale.read","sale.export","payment.read","client.read","budget.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read","cash_closing.validate"]',
    1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
  );
ELSE
  UPDATE roles SET 
    is_system = 1,
    permissions = '["expense.read","expense.export","sale.read","sale.export","payment.read","client.read","budget.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read","cash_closing.validate"]',
    updated_at = SYSDATETIMEOFFSET()
  WHERE name = 'ACCOUNTANT';
PRINT 'ACCOUNTANT done';

-- 4. AUDITOR (AUDITEUR) - 14 permissions - system role
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'AUDITOR')
  INSERT INTO roles (id, tenant_id, name, permissions, is_system, created_at, updated_at)
  VALUES (
    NEWID(), @tid, 'AUDITOR',
    '["expense.read","expense.export","sale.read","sale.export","payment.read","client.read","product.read","budget.read","user.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read"]',
    1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
  );
ELSE
  UPDATE roles SET 
    is_system = 1,
    permissions = '["expense.read","expense.export","sale.read","sale.export","payment.read","client.read","product.read","budget.read","user.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read"]',
    updated_at = SYSDATETIMEOFFSET()
  WHERE name = 'AUDITOR';
PRINT 'AUDITOR done';

-- 5. CASHIER (combined CAISSIER_DEPENSES + CAISSIER_VENTE) - 19 permissions - system role
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CASHIER')
  INSERT INTO roles (id, tenant_id, name, permissions, is_system, created_at, updated_at)
  VALUES (
    NEWID(), @tid, 'CASHIER',
    '["expense.create","expense.read","expense.update","expense.approve_l1","expense.pay","expense.cancel","sale.create","sale.read","sale.update","payment.create","payment.read","client.create","client.read","client.update","product.read","budget.read","dashboard.read","cash_closing.create","cash_closing.read"]',
    1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
  );
ELSE
  UPDATE roles SET 
    is_system = 1,
    permissions = '["expense.create","expense.read","expense.update","expense.approve_l1","expense.pay","expense.cancel","sale.create","sale.read","sale.update","payment.create","payment.read","client.create","client.read","client.update","product.read","budget.read","dashboard.read","cash_closing.create","cash_closing.read"]',
    updated_at = SYSDATETIMEOFFSET()
  WHERE name = 'CASHIER';
PRINT 'CASHIER done';

-- 6. MANAGER (DAF) - 20 permissions - system role
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'MANAGER')
  INSERT INTO roles (id, tenant_id, name, permissions, is_system, created_at, updated_at)
  VALUES (
    NEWID(), @tid, 'MANAGER',
    '["expense.read","expense.approve_l2","expense.pay","expense.cancel","expense.export","sale.read","sale.export","payment.read","client.read","product.read","budget.create","budget.read","budget.update","user.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read","cash_closing.validate"]',
    1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
  );
ELSE
  UPDATE roles SET 
    is_system = 1,
    permissions = '["expense.read","expense.approve_l2","expense.pay","expense.cancel","expense.export","sale.read","sale.export","payment.read","client.read","product.read","budget.create","budget.read","budget.update","user.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read","cash_closing.validate"]',
    updated_at = SYSDATETIMEOFFSET()
  WHERE name = 'MANAGER';
PRINT 'MANAGER done';

-- Verify
SELECT name, is_system,
  (SELECT COUNT(*) FROM OPENJSON(permissions)) as perm_count
FROM roles ORDER BY name;
