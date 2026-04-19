DECLARE @tenantId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';
DECLARE @roleId UNIQUEIDENTIFIER = NEWID();
DECLARE @userId UNIQUEIDENTIFIER = NEWID();

-- 1. Create ADMIN role with all permissions
INSERT INTO roles (id, name, permissions, is_system, tenant_id, created_at, updated_at)
VALUES (
  @roleId,
  'ADMIN',
  '["expense.create","expense.read","expense.update","expense.delete","expense.approve_l1","expense.approve_l2","expense.pay","expense.cancel","expense.export","sale.create","sale.read","sale.update","sale.delete","sale.export","payment.create","payment.read","client.create","client.read","client.update","client.delete","product.create","product.read","product.update","product.delete","budget.create","budget.read","budget.update","user.create","user.read","user.update","user.delete","role.create","role.read","role.update","audit.read","report.read","report.export","dashboard.read","cash_closing.create","cash_closing.read","cash_closing.validate","company.create","company.read","company.update","fne.create","fne.read","fne.update","fne.credit_note"]',
  1,
  @tenantId,
  SYSDATETIMEOFFSET(),
  SYSDATETIMEOFFSET()
);

-- 2. Create admin user (password: Admin@2026!)
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, tenant_id, department_id, is_active, mfa_enabled, allowed_modules, created_at, updated_at)
VALUES (
  @userId,
  'admin@caisseflow.com',
  '$2b$12$4eXE3q389ZhTmJj1293p5eR1iaIQgHH4BVS2vciIFmwof7ZwDl/.W',
  'Admin',
  'CaisseFlow',
  @roleId,
  @tenantId,
  NULL,
  1,
  0,
  '["admin","expense","sales","decision","fne","manager-caisse"]',
  SYSDATETIMEOFFSET(),
  SYSDATETIMEOFFSET()
);

PRINT 'Admin account created successfully';
SELECT u.email, u.first_name, u.last_name, r.name AS role_name, u.is_active
FROM users u JOIN roles r ON u.role_id = r.id
WHERE u.email = 'admin@caisseflow.com';
