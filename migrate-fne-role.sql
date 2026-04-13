IF NOT EXISTS (SELECT 1 FROM roles WHERE id = '10000000-0000-4000-a000-000000000006')
INSERT INTO roles (id, name, permissions, is_system, tenant_id) VALUES (
  '10000000-0000-4000-a000-000000000006',
  'FACTURIER_FNE',
  '["fne.create","fne.read","fne.update","fne.credit_note","client.create","client.read","client.update","product.read","dashboard.read","report.read","report.export","company.read"]',
  0,
  '00000000-0000-4000-a000-000000000001'
);
SELECT id, name, permissions FROM roles WHERE name = 'FACTURIER_FNE';
