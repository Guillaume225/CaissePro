IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'allowed_modules')
  ALTER TABLE users ADD allowed_modules NVARCHAR(500) NULL;
GO

UPDATE users SET allowed_modules = '["admin"]'
WHERE role_id = (SELECT id FROM roles WHERE name = 'ADMIN');

UPDATE users SET allowed_modules = '["decision"]'
WHERE role_id = (SELECT id FROM roles WHERE name = 'MANAGER');

UPDATE users SET allowed_modules = '["expense","sales"]'
WHERE role_id = (SELECT id FROM roles WHERE name = 'CASHIER');

UPDATE users SET allowed_modules = '["expense"]'
WHERE role_id = (SELECT id FROM roles WHERE name = 'ACCOUNTANT');

PRINT 'Migration OK';
SELECT email, allowed_modules FROM users;
