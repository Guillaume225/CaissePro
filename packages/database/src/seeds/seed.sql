-- ============================================================
-- CaisseFlow Pro — Seed Data (RESET COMPLET + INSERTION)
-- Mot de passe par défaut pour tous les utilisateurs : CaisseFlow2026!
-- Adapté aux structures RÉELLES des tables (TypeORM synchronize)
-- ============================================================

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 0 : NETTOYAGE COMPLET (ordre FK inversé)         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Feuilles (aucune table ne les référence)
DELETE FROM receivables;
DELETE FROM payments;
DELETE FROM sale_items;
DELETE FROM cash_movements;
DELETE FROM cash_days;
DELETE FROM validation_history;
DELETE FROM disbursement_requests;
DELETE FROM expense_approvals;
DELETE FROM expense_attachments;
DELETE FROM notifications;
-- Niveau intermédiaire
DELETE FROM budgets;
DELETE FROM expenses;
DELETE FROM sales;
DELETE FROM approval_circuit_steps;
DELETE FROM approval_circuits;
-- Casser la dépendance circulaire departments.manager_id → users.id
UPDATE departments SET manager_id = NULL;
DELETE FROM users;
-- Parents
DELETE FROM expense_categories;
DELETE FROM products;
DELETE FROM clients;
DELETE FROM departments;
DELETE FROM roles;
DELETE FROM companies;

PRINT '>> Toutes les tables nettoyées.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 0b : TENANT (upsert)                              ║
-- ╚═══════════════════════════════════════════════════════════╝
IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-4000-a000-000000000001')
  INSERT INTO tenants (id, name, slug, [plan], is_active) VALUES
  ('00000000-0000-4000-a000-000000000001', N'Organisation par défaut', 'default', 'PROFESSIONAL', 1);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 1 : ENTREPRISE                                    ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO companies (id, tenant_id, name, code, address, phone, email, tax_id, trade_register, currency, is_active)
VALUES (
  'C0000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000001',
  'Entreprise Demo SARL', 'DEMO',
  'Rue 310, Bamako, Mali', '+223 20 22 33 44',
  'contact@entreprise-demo.ml', 'ML-NIF-2025-00123',
  'RC-BKO-2025-B-1234', 'XOF', 1
);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 2 : RÔLES                                         ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO roles (id, name, permissions, is_system, tenant_id) VALUES
('10000000-0000-4000-a000-000000000001', 'ADMIN', '["*"]', 1, '00000000-0000-4000-a000-000000000001'),
('10000000-0000-4000-a000-000000000002', 'MANAGER', '["expense.read","expense.approve_l2","expense.pay","expense.cancel","expense.export","sale.read","sale.export","payment.read","client.read","product.read","budget.create","budget.read","budget.update","user.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read","cash_closing.validate"]', 1, '00000000-0000-4000-a000-000000000001'),
('10000000-0000-4000-a000-000000000003', 'CASHIER', '["expense.create","expense.read","expense.update","expense.approve_l1","expense.pay","expense.cancel","budget.read","sale.create","sale.read","sale.update","payment.create","payment.read","client.create","client.read","client.update","product.read","dashboard.read","cash_closing.create","cash_closing.read"]', 1, '00000000-0000-4000-a000-000000000001'),
('10000000-0000-4000-a000-000000000004', 'ACCOUNTANT', '["expense.read","expense.export","sale.read","sale.export","payment.read","client.read","budget.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read","cash_closing.validate"]', 1, '00000000-0000-4000-a000-000000000001'),
('10000000-0000-4000-a000-000000000005', 'AUDITOR', '["expense.read","expense.export","sale.read","sale.export","payment.read","client.read","product.read","budget.read","user.read","audit.read","report.read","report.export","dashboard.read","cash_closing.read"]', 0, '00000000-0000-4000-a000-000000000001'),
('10000000-0000-4000-a000-000000000006', 'FACTURIER_FNE', '["fne.create","fne.read","fne.update","fne.credit_note","client.create","client.read","client.update","product.read","dashboard.read","report.read","report.export","company.read"]', 0, '00000000-0000-4000-a000-000000000001');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 3 : DÉPARTEMENTS                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO departments (id, name, tenant_id) VALUES
('20000000-0000-4000-a000-000000000001', N'Direction Générale', '00000000-0000-4000-a000-000000000001'),
('20000000-0000-4000-a000-000000000002', N'Comptabilité', '00000000-0000-4000-a000-000000000001'),
('20000000-0000-4000-a000-000000000003', N'Caisse', '00000000-0000-4000-a000-000000000001'),
('20000000-0000-4000-a000-000000000004', N'Commercial', '00000000-0000-4000-a000-000000000001');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 4 : UTILISATEURS                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Mot de passe: CaisseFlow2026!
-- Hash bcrypt: $2b$10$trPlXCyicqrn9YqJqzmP3O48Pk4z5uG09XkanEzrylpjrUtZb2C/i
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, department_id, is_active, mfa_enabled, tenant_id, company_id, allowed_modules) VALUES
('30000000-0000-4000-a000-000000000001', 'admin@caisseflow.com', '$2b$10$trPlXCyicqrn9YqJqzmP3O48Pk4z5uG09XkanEzrylpjrUtZb2C/i', 'Amadou', 'Diallo', '10000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 1, 0, '00000000-0000-4000-a000-000000000001', 'C0000000-0000-4000-a000-000000000001', '["admin","manager-caisse"]'),
('30000000-0000-4000-a000-000000000002', 'fatou@caisseflow.com', '$2b$10$trPlXCyicqrn9YqJqzmP3O48Pk4z5uG09XkanEzrylpjrUtZb2C/i', 'Fatou', 'Keita', '10000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000002', 1, 0, '00000000-0000-4000-a000-000000000001', 'C0000000-0000-4000-a000-000000000001', '["decision","manager-caisse"]'),
('30000000-0000-4000-a000-000000000003', 'moussa@caisseflow.com', '$2b$10$trPlXCyicqrn9YqJqzmP3O48Pk4z5uG09XkanEzrylpjrUtZb2C/i', 'Moussa', N'Traoré', '10000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000003', 1, 0, '00000000-0000-4000-a000-000000000001', 'C0000000-0000-4000-a000-000000000001', '["expense","sales"]'),
('30000000-0000-4000-a000-000000000004', 'awa@caisseflow.com', '$2b$10$trPlXCyicqrn9YqJqzmP3O48Pk4z5uG09XkanEzrylpjrUtZb2C/i', 'Awa', 'Coulibaly', '10000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000003', 1, 0, '00000000-0000-4000-a000-000000000001', 'C0000000-0000-4000-a000-000000000001', '["expense"]'),
('30000000-0000-4000-a000-000000000005', 'ibrahim@caisseflow.com', '$2b$10$trPlXCyicqrn9YqJqzmP3O48Pk4z5uG09XkanEzrylpjrUtZb2C/i', 'Ibrahim', 'Sanogo', '10000000-0000-4000-a000-000000000004', '20000000-0000-4000-a000-000000000002', 1, 0, '00000000-0000-4000-a000-000000000001', 'C0000000-0000-4000-a000-000000000001', '["expense"]');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 5 : CATÉGORIES DE DÉPENSES (pas de tenant_id)      ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO expense_categories (id, name, code, parent_id, budget_limit, is_active, accounting_debit_account, accounting_credit_account) VALUES
('40000000-0000-4000-a000-000000000001', 'Fournitures',              'FOUR',     NULL,                                    1200000.00, 1, '601000', '512000'),
('40000000-0000-4000-a000-000000000002', 'Fournitures bureau',       'FOUR-BUR', '40000000-0000-4000-a000-000000000001',   NULL,       1, '601100', '512000'),
('40000000-0000-4000-a000-000000000003', 'Fournitures informatiques','FOUR-INF', '40000000-0000-4000-a000-000000000001',   NULL,       1, '601200', '512000'),
('40000000-0000-4000-a000-000000000004', 'Loyer',                    'LOYER',    NULL,                                     800000.00,  1, '613000', '512000'),
('40000000-0000-4000-a000-000000000005', 'Salaires',                 'SAL',      NULL,                                    2000000.00,  1, '641000', '421000'),
('40000000-0000-4000-a000-000000000006', N'Salaires permanents',     'SAL-PERM', '40000000-0000-4000-a000-000000000005',   NULL,       1, '641100', '421000'),
('40000000-0000-4000-a000-000000000007', 'Consultants',              'SAL-CONS', '40000000-0000-4000-a000-000000000005',   NULL,       1, '622000', '401000'),
('40000000-0000-4000-a000-000000000008', 'Transport',                'TRANS',    NULL,                                     400000.00,  1, '625000', '512000'),
('40000000-0000-4000-a000-000000000009', 'Marketing',                'MKT',      NULL,                                     500000.00,  1, '623000', '512000'),
('40000000-0000-4000-a000-000000000010', 'Divers',                   'DIV',      NULL,                                     NULL,       1, NULL, NULL);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 6 : PRODUITS (code au lieu de sku, vat_rate)       ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO products (id, code, name, category, unit_price, vat_rate, is_active, tenant_id) VALUES
('50000000-0000-4000-a000-000000000001', 'CIM-50',  'Ciment CPA 50kg',         N'Matériaux',    5500.00,  18.00, 1, '00000000-0000-4000-a000-000000000001'),
('50000000-0000-4000-a000-000000000002', 'FER-10',  N'Fer à béton 10mm',       N'Matériaux',    3200.00,  18.00, 1, '00000000-0000-4000-a000-000000000001'),
('50000000-0000-4000-a000-000000000003', 'PNT-20',  'Peinture acrylique 20L',  'Peinture',     28000.00,  18.00, 1, '00000000-0000-4000-a000-000000000001'),
('50000000-0000-4000-a000-000000000004', 'TUY-110', 'Tuyau PVC 110mm',         'Plomberie',     8500.00,  18.00, 1, '00000000-0000-4000-a000-000000000001'),
('50000000-0000-4000-a000-000000000005', 'CAB-25',  N'Câble électrique 2.5mm', N'Électricité', 45000.00,  18.00, 1, '00000000-0000-4000-a000-000000000001'),
('50000000-0000-4000-a000-000000000006', 'BRK-15',  'Brique creuse 15',        N'Matériaux',     250.00,  18.00, 1, '00000000-0000-4000-a000-000000000001');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 7 : CLIENTS                                        ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO clients (id, name, type, email, phone, address, tax_id, credit_limit, score, risk_class, is_active, tenant_id) VALUES
('60000000-0000-4000-a000-000000000001', 'Ets Moussa & Fils',    'COMPANY',    'moussa.fils@email.com',   '+223 701 23 45', 'Rue 100, Bamako', 'ML-NIF-2025', 1000000.00, 85, 'A', 1, '00000000-0000-4000-a000-000000000001'),
('60000000-0000-4000-a000-000000000002', 'Sarl TechnoPlus',      'COMPANY',    'technoplus@email.com',    '+223 712 34 56', 'Rue 101, Bamako', NULL,          1500000.00, 78, 'B', 1, '00000000-0000-4000-a000-000000000001'),
('60000000-0000-4000-a000-000000000003', 'Boulangerie Kader',    'INDIVIDUAL', 'kader@email.com',         '+223 723 45 67', 'Rue 102, Bamako', 'ML-NIF-2027', 2000000.00, 72, 'B', 1, '00000000-0000-4000-a000-000000000001'),
('60000000-0000-4000-a000-000000000004', 'Pharmacie El Afia',    'COMPANY',    'elafia@email.com',        '+223 734 56 78', 'Rue 103, Bamako', NULL,          2500000.00, 90, 'C', 1, '00000000-0000-4000-a000-000000000001'),
('60000000-0000-4000-a000-000000000005', 'Garage Central',       'COMPANY',    'garagecentral@email.com', '+223 745 67 89', 'Rue 104, Bamako', 'ML-NIF-2029', 3000000.00, 68, 'A', 1, '00000000-0000-4000-a000-000000000001'),
('60000000-0000-4000-a000-000000000006', 'Quincaillerie Diallo',  'INDIVIDUAL', 'diallo.quinc@email.com', '+223 756 78 90', 'Rue 105, Bamako', NULL,          3500000.00, 80, 'B', 1, '00000000-0000-4000-a000-000000000001'),
('60000000-0000-4000-a000-000000000007', N'Ets Koné Import',     'COMPANY',    'koneimport@email.com',    '+223 767 89 01', 'Rue 106, Bamako', 'ML-NIF-2031', 4000000.00, 65, 'C', 1, '00000000-0000-4000-a000-000000000001'),
('60000000-0000-4000-a000-000000000008', N'Société ABC',          'COMPANY',    'abc@email.com',           '+223 778 90 12', 'Rue 107, Bamako', NULL,          4500000.00, 55, 'D', 0, '00000000-0000-4000-a000-000000000001');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 8 : CIRCUITS DE VALIDATION                         ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO approval_circuits (id, tenant_id, name, min_amount, max_amount, is_active) VALUES
('70000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', N'Petit décaissement',  0.00,       100000.00, 1),
('70000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000001', N'Décaissement moyen', 100001.00,   500000.00, 1),
('70000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000001', N'Gros décaissement',  500001.00,   NULL,      1);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 9 : ÉTAPES DES CIRCUITS                            ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO approval_circuit_steps (id, circuit_id, level, role, approver_id) VALUES
-- Petit décaissement : Chef Comptable uniquement
('71000000-0000-4000-a000-000000000001', '70000000-0000-4000-a000-000000000001', 1, 'CHEF_COMPTABLE', '30000000-0000-4000-a000-000000000002'),
-- Décaissement moyen : Chef Comptable → DAF
('71000000-0000-4000-a000-000000000002', '70000000-0000-4000-a000-000000000002', 1, 'CHEF_COMPTABLE', '30000000-0000-4000-a000-000000000002'),
('71000000-0000-4000-a000-000000000003', '70000000-0000-4000-a000-000000000002', 2, 'DAF',            '30000000-0000-4000-a000-000000000002'),
-- Gros décaissement : Chef Comptable → DAF → DG
('71000000-0000-4000-a000-000000000004', '70000000-0000-4000-a000-000000000003', 1, 'CHEF_COMPTABLE', '30000000-0000-4000-a000-000000000002'),
('71000000-0000-4000-a000-000000000005', '70000000-0000-4000-a000-000000000003', 2, 'DAF',            '30000000-0000-4000-a000-000000000002'),
('71000000-0000-4000-a000-000000000006', '70000000-0000-4000-a000-000000000003', 3, 'DG',             '30000000-0000-4000-a000-000000000001');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 10 : BUDGETS (pas de tenant_id)                    ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO budgets (id, category_id, department_id, period_start, period_end, allocated_amount, consumed_amount) VALUES
('80000000-0000-4000-a000-000000000001', '40000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000003', '2026-04-01', '2026-04-30', 1200000.00,  980000.00),
('80000000-0000-4000-a000-000000000002', '40000000-0000-4000-a000-000000000004', '20000000-0000-4000-a000-000000000003', '2026-04-01', '2026-04-30',  800000.00,  750000.00),
('80000000-0000-4000-a000-000000000003', '40000000-0000-4000-a000-000000000005', '20000000-0000-4000-a000-000000000003', '2026-04-01', '2026-04-30', 2000000.00, 1450000.00),
('80000000-0000-4000-a000-000000000004', '40000000-0000-4000-a000-000000000008', '20000000-0000-4000-a000-000000000003', '2026-04-01', '2026-04-30',  400000.00,  320000.00),
('80000000-0000-4000-a000-000000000005', '40000000-0000-4000-a000-000000000009', '20000000-0000-4000-a000-000000000004', '2026-04-01', '2026-04-30',  500000.00,  210000.00);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 11 : DÉPENSES (reference NOT NULL, pas de tenant)  ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO expenses (id, reference, date, amount, description, beneficiary, payment_method, status, observations, category_id, created_by) VALUES
('90000000-0000-4000-a000-000000000001', 'DEP-2026-00001', '2026-04-01',  125000.00, 'Achat ramettes papier A4 x20',         'Papeterie Bamako',     'CASH',     'PAID',        NULL,                 '40000000-0000-4000-a000-000000000002', '30000000-0000-4000-a000-000000000003'),
('90000000-0000-4000-a000-000000000002', 'DEP-2026-00002', '2026-04-01',  750000.00, 'Loyer bureau avril 2026',              'SCI Immo Bamako',      'TRANSFER', 'APPROVED_L2', 'Paiement mensuel',   '40000000-0000-4000-a000-000000000004', '30000000-0000-4000-a000-000000000003'),
('90000000-0000-4000-a000-000000000003', 'DEP-2026-00003', '2026-04-02',   45000.00, 'Carburant vehicule de service',        'Station Total Bamako', 'CASH',     'PENDING',     NULL,                 '40000000-0000-4000-a000-000000000008', '30000000-0000-4000-a000-000000000003'),
('90000000-0000-4000-a000-000000000004', 'DEP-2026-00004', '2026-04-02',   85000.00, 'Toner imprimante laser',               'InfoPlus Electronique','CASH',     'PENDING',     NULL,                 '40000000-0000-4000-a000-000000000003', '30000000-0000-4000-a000-000000000004'),
('90000000-0000-4000-a000-000000000005', 'DEP-2026-00005', '2026-04-03', 1450000.00, 'Salaires permanents mars 2026',        'Personnel',            'TRANSFER', 'PAID',        'Virement bancaire',  '40000000-0000-4000-a000-000000000006', '30000000-0000-4000-a000-000000000001'),
('90000000-0000-4000-a000-000000000006', 'DEP-2026-00006', '2026-04-03',  350000.00, 'Consultation comptable',               'Cabinet Audit Plus',   'CHECK',    'APPROVED_L1', NULL,                 '40000000-0000-4000-a000-000000000007', '30000000-0000-4000-a000-000000000003'),
('90000000-0000-4000-a000-000000000007', 'DEP-2026-00007', '2026-04-03',   95000.00, 'Fournitures informatiques Cables reseau','TechShop Mali',      'CASH',     'DRAFT',       NULL,                 '40000000-0000-4000-a000-000000000003', '30000000-0000-4000-a000-000000000004'),
('90000000-0000-4000-a000-000000000008', 'DEP-2026-00008', '2026-04-04',  210000.00, 'Campagne publicitaire radio',          'Radio Liberte FM',     'TRANSFER', 'REJECTED',    'Budget insuffisant', '40000000-0000-4000-a000-000000000009', '30000000-0000-4000-a000-000000000003');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 11b : HISTORIQUE DE VALIDATION DES DÉPENSES        ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO expense_approvals (id, expense_id, approver_id, level, status, comment, approved_at, created_at) VALUES
-- DEP-2026-00001 (PAID) : L1 Fatou (MANAGER) ✓, L2 Amadou (ADMIN) ✓
('B0000000-0000-4000-a000-000000000001', '90000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000002', 1, 'APPROVED', 'Conforme au budget',       '2026-04-01T10:30:00+00:00', '2026-04-01T09:00:00+00:00'),
('B0000000-0000-4000-a000-000000000002', '90000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', 2, 'APPROVED', NULL,                       '2026-04-01T14:00:00+00:00', '2026-04-01T10:30:00+00:00'),
-- DEP-2026-00002 (APPROVED_L2) : L1 Ibrahim (MANAGER) ✓, L2 Amadou (ADMIN) ✓
('B0000000-0000-4000-a000-000000000003', '90000000-0000-4000-a000-000000000002', '30000000-0000-4000-a000-000000000005', 1, 'APPROVED', NULL,                       '2026-04-02T11:00:00+00:00', '2026-04-02T09:00:00+00:00'),
('B0000000-0000-4000-a000-000000000004', '90000000-0000-4000-a000-000000000002', '30000000-0000-4000-a000-000000000001', 2, 'APPROVED', 'Bon pour paiement',        '2026-04-02T15:00:00+00:00', '2026-04-02T11:00:00+00:00'),
-- DEP-2026-00003 (PENDING) : L1 Fatou (MANAGER) en attente
('B0000000-0000-4000-a000-000000000005', '90000000-0000-4000-a000-000000000003', '30000000-0000-4000-a000-000000000002', 1, 'PENDING',  NULL,                       NULL,                        '2026-04-03T08:00:00+00:00'),
-- DEP-2026-00004 (PENDING) : L1 Ibrahim (MANAGER) en attente
('B0000000-0000-4000-a000-000000000006', '90000000-0000-4000-a000-000000000004', '30000000-0000-4000-a000-000000000005', 1, 'PENDING',  NULL,                       NULL,                        '2026-04-03T09:00:00+00:00'),
-- DEP-2026-00005 (PAID) : L1 Fatou ✓, L2 Amadou ✓
('B0000000-0000-4000-a000-000000000007', '90000000-0000-4000-a000-000000000005', '30000000-0000-4000-a000-000000000002', 1, 'APPROVED', 'RAS',                      '2026-04-03T10:00:00+00:00', '2026-04-03T08:30:00+00:00'),
('B0000000-0000-4000-a000-000000000008', '90000000-0000-4000-a000-000000000005', '30000000-0000-4000-a000-000000000001', 2, 'APPROVED', 'Validé',                   '2026-04-03T14:30:00+00:00', '2026-04-03T10:00:00+00:00'),
-- DEP-2026-00006 (APPROVED_L1) : L1 Fatou ✓, L2 Amadou en attente
('B0000000-0000-4000-a000-000000000009', '90000000-0000-4000-a000-000000000006', '30000000-0000-4000-a000-000000000002', 1, 'APPROVED', 'Justificatifs conformes',  '2026-04-03T16:00:00+00:00', '2026-04-03T14:00:00+00:00'),
('B0000000-0000-4000-a000-000000000010', '90000000-0000-4000-a000-000000000006', '30000000-0000-4000-a000-000000000001', 2, 'PENDING',  NULL,                       NULL,                        '2026-04-03T16:00:00+00:00'),
-- DEP-2026-00008 (REJECTED) : L1 Ibrahim rejeté ✗
('B0000000-0000-4000-a000-000000000011', '90000000-0000-4000-a000-000000000008', '30000000-0000-4000-a000-000000000005', 1, 'REJECTED', 'Justificatif manquant, montant non conforme', '2026-04-04T09:30:00+00:00', '2026-04-04T08:00:00+00:00');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 12 : VENTES (reference NOT NULL, created_by)       ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO sales (id, reference, date, client_id, subtotal_ht, total_vat, discount_amount, total_ttc, amount_paid, status, created_by, tenant_id) VALUES
('A0000000-0000-4000-a000-000000000001', 'VTE-2026-00001', '2026-04-01', '60000000-0000-4000-a000-000000000001', 220000.00, 39600.00, 5500.00, 254100.00, 254100.00, 'PAID',           '30000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000001'),
('A0000000-0000-4000-a000-000000000002', 'VTE-2026-00002', '2026-04-01', '60000000-0000-4000-a000-000000000002',  84000.00, 15120.00,    0.00,  99120.00,      0.00, 'CONFIRMED',      '30000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000001'),
('A0000000-0000-4000-a000-000000000003', 'VTE-2026-00003', '2026-04-02', '60000000-0000-4000-a000-000000000003',  56000.00, 10080.00, 1400.00,  64680.00,  30000.00, 'PARTIALLY_PAID', '30000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000001'),
('A0000000-0000-4000-a000-000000000004', 'VTE-2026-00004', '2026-04-02', '60000000-0000-4000-a000-000000000004', 135000.00, 24300.00,    0.00, 159300.00, 159300.00, 'PAID',           '30000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000001'),
('A0000000-0000-4000-a000-000000000005', 'VTE-2026-00005', '2026-04-03', '60000000-0000-4000-a000-000000000005',  27500.00,  4950.00,    0.00,  32450.00,      0.00, 'DRAFT',          '30000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000001'),
('A0000000-0000-4000-a000-000000000006', 'VTE-2026-00006', '2026-04-03', '60000000-0000-4000-a000-000000000006',   500.00,    90.00,    0.00,    590.00,      0.00, 'DRAFT',          '30000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000001');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 13 : ARTICLES DE VENTE                             ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, vat_rate, discount_pct, line_total_ht, line_vat, line_total_ttc) VALUES
('A1000000-0000-4000-a000-000000000001', 'A0000000-0000-4000-a000-000000000001', '50000000-0000-4000-a000-000000000001', 40, 5500.00, 18.00, 2.50, 214500.00, 38610.00, 253110.00),
('A1000000-0000-4000-a000-000000000002', 'A0000000-0000-4000-a000-000000000001', '50000000-0000-4000-a000-000000000002',  5, 3200.00, 18.00, 0.00,  16000.00,  2880.00,  18880.00),
('A1000000-0000-4000-a000-000000000003', 'A0000000-0000-4000-a000-000000000002', '50000000-0000-4000-a000-000000000003',  3,28000.00, 18.00, 0.00,  84000.00, 15120.00,  99120.00),
('A1000000-0000-4000-a000-000000000004', 'A0000000-0000-4000-a000-000000000003', '50000000-0000-4000-a000-000000000003',  2,28000.00, 18.00, 2.50,  54600.00,  9828.00,  64428.00),
('A1000000-0000-4000-a000-000000000005', 'A0000000-0000-4000-a000-000000000004', '50000000-0000-4000-a000-000000000005',  1,45000.00, 18.00, 0.00,  45000.00,  8100.00,  53100.00),
('A1000000-0000-4000-a000-000000000006', 'A0000000-0000-4000-a000-000000000004', '50000000-0000-4000-a000-000000000004', 10, 8500.00, 18.00, 0.00,  85000.00, 15300.00, 100300.00),
('A1000000-0000-4000-a000-000000000007', 'A0000000-0000-4000-a000-000000000005', '50000000-0000-4000-a000-000000000001',  5, 5500.00, 18.00, 0.00,  27500.00,  4950.00,  32450.00),
('A1000000-0000-4000-a000-000000000008', 'A0000000-0000-4000-a000-000000000006', '50000000-0000-4000-a000-000000000006',  2,  250.00, 18.00, 0.00,    500.00,    90.00,    590.00);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 14 : PAIEMENTS (payment_method, payment_date)      ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO payments (id, sale_id, client_id, amount, payment_method, reference, payment_date, received_by) VALUES
('A2000000-0000-4000-a000-000000000001', 'A0000000-0000-4000-a000-000000000001', '60000000-0000-4000-a000-000000000001', 254100.00, 'CASH',         'REC-2026-001', '2026-04-01', '30000000-0000-4000-a000-000000000003'),
('A2000000-0000-4000-a000-000000000002', 'A0000000-0000-4000-a000-000000000003', '60000000-0000-4000-a000-000000000003',  30000.00, 'MOBILE_MONEY', 'REC-2026-002', '2026-04-02', '30000000-0000-4000-a000-000000000003'),
('A2000000-0000-4000-a000-000000000003', 'A0000000-0000-4000-a000-000000000004', '60000000-0000-4000-a000-000000000004', 159300.00, 'TRANSFER',     'REC-2026-003', '2026-04-02', '30000000-0000-4000-a000-000000000004');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÉTAPE 15 : CRÉANCES (total_amount, paid_amount, is_settled) ║
-- ╚═══════════════════════════════════════════════════════════╝
INSERT INTO receivables (id, sale_id, client_id, total_amount, paid_amount, outstanding_amount, due_date, aging_bucket, is_settled) VALUES
('A3000000-0000-4000-a000-000000000001', 'A0000000-0000-4000-a000-000000000002', '60000000-0000-4000-a000-000000000002', 99120.00,     0.00, 99120.00, '2026-04-15', 'CURRENT', 0),
('A3000000-0000-4000-a000-000000000002', 'A0000000-0000-4000-a000-000000000003', '60000000-0000-4000-a000-000000000003', 64680.00, 30000.00, 34680.00, '2026-04-10', 'CURRENT', 0);

SET NOCOUNT OFF;
PRINT '========================================';
PRINT 'Seed data inserted successfully!';
PRINT '========================================';

SELECT [table], [count] FROM (
  SELECT 'roles' AS [table], COUNT(*) AS [count] FROM roles
  UNION ALL SELECT 'departments', COUNT(*) FROM departments
  UNION ALL SELECT 'companies', COUNT(*) FROM companies
  UNION ALL SELECT 'users', COUNT(*) FROM users
  UNION ALL SELECT 'expense_categories', COUNT(*) FROM expense_categories
  UNION ALL SELECT 'products', COUNT(*) FROM products
  UNION ALL SELECT 'clients', COUNT(*) FROM clients
  UNION ALL SELECT 'approval_circuits', COUNT(*) FROM approval_circuits
  UNION ALL SELECT 'approval_circuit_steps', COUNT(*) FROM approval_circuit_steps
  UNION ALL SELECT 'budgets', COUNT(*) FROM budgets
  UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
  UNION ALL SELECT 'sales', COUNT(*) FROM sales
  UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
  UNION ALL SELECT 'payments', COUNT(*) FROM payments
  UNION ALL SELECT 'receivables', COUNT(*) FROM receivables
) t;
