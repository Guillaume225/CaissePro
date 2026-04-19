UPDATE roles 
SET permissions = '["fne.create","fne.read","fne.update","fne.credit_note","client.create","client.read","client.update","product.read","dashboard.read","report.read","report.export","company.read"]'
WHERE name = 'FACTURIER_FNE';

SELECT name, LEFT(CAST(permissions AS VARCHAR(100)), 100) AS perms_start FROM roles ORDER BY name;
