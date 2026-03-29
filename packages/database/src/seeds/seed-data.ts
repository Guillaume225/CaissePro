import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { Expense } from '../entities/expense.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { Budget } from '../entities/budget.entity';
import { Client } from '../entities/client.entity';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Payment } from '../entities/payment.entity';
import {
  PaymentMethod,
  ExpenseStatus,
  ApprovalStatus,
  SaleStatus,
  ClientType,
  RiskClass,
} from '../entities/enums';

/* ─── Helpers ─── */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function date(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
// Deterministic password hash for "Password1!" — bcrypt $2b$10$ round
const DEMO_HASH = '$2b$10$EixZaYVK1fsbw1ZfbX3OXe.PZyWQ2HIHh0UysXDwMQxt7oGY/D4RO';

export async function seedAll(ds: DataSource): Promise<void> {
  /* ═══════════════════════════════════
   *  1. ROLES  (4)
   * ═══════════════════════════════════ */
  const roleRepo = ds.getRepository(Role);
  const roles = await roleRepo.save([
    { name: 'ADMIN', permissions: ['*'], isSystem: true },
    { name: 'MANAGER', permissions: ['expenses:approve', 'sales:read', 'reports:read', 'budgets:manage'], isSystem: true },
    { name: 'CASHIER', permissions: ['sales:create', 'sales:read', 'payments:create'], isSystem: true },
    { name: 'ACCOUNTANT', permissions: ['expenses:create', 'expenses:read', 'reports:read'], isSystem: false },
  ]);
  const [adminRole, managerRole, cashierRole, accountantRole] = roles;

  /* ═══════════════════════════════════
   *  2. DEPARTMENTS  (5)
   * ═══════════════════════════════════ */
  const deptRepo = ds.getRepository(Department);
  const departments = await deptRepo.save([
    { name: 'Direction Générale' },
    { name: 'Comptabilité & Finance' },
    { name: 'Commercial' },
    { name: 'Logistique' },
    { name: 'Ressources Humaines' },
  ]);

  /* ═══════════════════════════════════
   *  3. USERS  (10)
   * ═══════════════════════════════════ */
  const userRepo = ds.getRepository(User);
  const users = await userRepo.save([
    { email: 'admin@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Amadou', lastName: 'Diallo', roleId: adminRole.id, departmentId: departments[0].id, isActive: true },
    { email: 'dg@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Fatimata', lastName: 'Traoré', roleId: managerRole.id, departmentId: departments[0].id, isActive: true },
    { email: 'compta1@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Moussa', lastName: 'Konaté', roleId: accountantRole.id, departmentId: departments[1].id, isActive: true },
    { email: 'compta2@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Aïssata', lastName: 'Coulibaly', roleId: accountantRole.id, departmentId: departments[1].id, isActive: true },
    { email: 'manager.commercial@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Ibrahim', lastName: 'Sangaré', roleId: managerRole.id, departmentId: departments[2].id, isActive: true },
    { email: 'caissier1@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Mariam', lastName: 'Bah', roleId: cashierRole.id, departmentId: departments[2].id, isActive: true },
    { email: 'caissier2@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Oumar', lastName: 'Sidibé', roleId: cashierRole.id, departmentId: departments[2].id, isActive: true },
    { email: 'logistique@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Kadiatou', lastName: 'Keita', roleId: accountantRole.id, departmentId: departments[3].id, isActive: true },
    { email: 'rh@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Sékou', lastName: 'Camara', roleId: managerRole.id, departmentId: departments[4].id, isActive: true },
    { email: 'stagiaire@caisseflow.io', passwordHash: DEMO_HASH, firstName: 'Aminata', lastName: 'Diakité', roleId: cashierRole.id, departmentId: departments[2].id, isActive: false },
  ]);

  // Set department managers
  await deptRepo.update(departments[0].id, { managerId: users[1].id });
  await deptRepo.update(departments[1].id, { managerId: users[2].id });
  await deptRepo.update(departments[2].id, { managerId: users[4].id });
  await deptRepo.update(departments[3].id, { managerId: users[7].id });
  await deptRepo.update(departments[4].id, { managerId: users[8].id });

  /* ═══════════════════════════════════
   *  4. EXPENSE CATEGORIES  (20)
   * ═══════════════════════════════════ */
  const catRepo = ds.getRepository(ExpenseCategory);

  // Parent categories
  const parentCats = await catRepo.save([
    { name: 'Fonctionnement', code: 'FONC', budgetLimit: 50000000 },
    { name: 'Investissement', code: 'INVE', budgetLimit: 100000000 },
    { name: 'Personnel', code: 'PERS', budgetLimit: 80000000 },
    { name: 'Déplacements', code: 'DEPL', budgetLimit: 20000000 },
    { name: 'Communication', code: 'COMM', budgetLimit: 15000000 },
  ]);

  // Child categories
  const childCats = await catRepo.save([
    { name: 'Fournitures de bureau', code: 'FONC-001', parentId: parentCats[0].id, budgetLimit: 5000000 },
    { name: 'Loyer & charges', code: 'FONC-002', parentId: parentCats[0].id, budgetLimit: 12000000 },
    { name: 'Électricité', code: 'FONC-003', parentId: parentCats[0].id, budgetLimit: 3000000 },
    { name: 'Eau', code: 'FONC-004', parentId: parentCats[0].id, budgetLimit: 1500000 },
    { name: 'Internet & Téléphone', code: 'FONC-005', parentId: parentCats[0].id, budgetLimit: 2400000 },
    { name: 'Matériel informatique', code: 'INVE-001', parentId: parentCats[1].id, budgetLimit: 25000000 },
    { name: 'Mobilier', code: 'INVE-002', parentId: parentCats[1].id, budgetLimit: 10000000 },
    { name: 'Véhicules', code: 'INVE-003', parentId: parentCats[1].id, budgetLimit: 40000000 },
    { name: 'Salaires', code: 'PERS-001', parentId: parentCats[2].id, budgetLimit: 60000000 },
    { name: 'Primes & Bonus', code: 'PERS-002', parentId: parentCats[2].id, budgetLimit: 10000000 },
    { name: 'Missions locales', code: 'DEPL-001', parentId: parentCats[3].id, budgetLimit: 8000000 },
    { name: 'Missions internationales', code: 'DEPL-002', parentId: parentCats[3].id, budgetLimit: 12000000 },
    { name: 'Publicité', code: 'COMM-001', parentId: parentCats[4].id, budgetLimit: 8000000 },
    { name: 'Événementiel', code: 'COMM-002', parentId: parentCats[4].id, budgetLimit: 5000000 },
    { name: 'Relations publiques', code: 'COMM-003', parentId: parentCats[4].id, budgetLimit: 2000000 },
  ]);

  const allCats = [...parentCats, ...childCats];

  /* ═══════════════════════════════════
   *  5. BUDGETS  (5 — one per parent cat)
   * ═══════════════════════════════════ */
  const budgetRepo = ds.getRepository(Budget);
  for (let i = 0; i < parentCats.length; i++) {
    await budgetRepo.save({
      categoryId: parentCats[i].id,
      departmentId: departments[i % departments.length].id,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      allocatedAmount: parentCats[i].budgetLimit ?? 10000000,
      consumedAmount: rand(0, (parentCats[i].budgetLimit ?? 10000000) * 0.6),
      alertThresholds: [50, 75, 90, 100],
    });
  }

  /* ═══════════════════════════════════
   *  6. EXPENSES  (50)
   * ═══════════════════════════════════ */
  const expRepo = ds.getRepository(Expense);
  const payMethods = [PaymentMethod.CASH, PaymentMethod.CHECK, PaymentMethod.TRANSFER, PaymentMethod.MOBILE_MONEY];
  const expStatuses = [ExpenseStatus.DRAFT, ExpenseStatus.PENDING, ExpenseStatus.APPROVED_L1, ExpenseStatus.APPROVED_L2, ExpenseStatus.PAID, ExpenseStatus.REJECTED];
  const beneficiaries = [
    'Papeterie Centrale', 'Orange Mali', 'EDM SA', 'SOMAGEP', 'Total Energies',
    'Hôtel Radisson', 'Air France', 'Imprimerie Moderne', 'Garage Moto Plus', 'Fournisseur Tech',
  ];
  const descriptions = [
    'Achat de rames de papier A4', 'Facture internet mensuelle', 'Facture électricité trimestre',
    'Achat ordinateurs portables', 'Frais de mission Bamako-Ségou', 'Réparation véhicule de service',
    'Facture téléphonique', 'Achat cartouches imprimante', 'Location salle de conférence',
    'Abonnement logiciel comptable',
  ];
  const expenses: Expense[] = [];
  for (let i = 0; i < 50; i++) {
    const status = pick(expStatuses);
    const cat = pick(childCats.length > 0 ? childCats : allCats);
    const exp = await expRepo.save({
      // reference is auto-generated by trigger; provide a fallback for seed without trigger
      reference: `DEP-2026-${String(i + 1).padStart(5, '0')}`,
      date: date(Math.floor(Math.random() * 180)),
      amount: rand(15000, 12000000),
      description: pick(descriptions),
      beneficiary: pick(beneficiaries),
      paymentMethod: pick(payMethods),
      status,
      observations: i % 5 === 0 ? 'Facture originale jointe' : null,
      categoryId: cat.id,
      createdById: pick(users.slice(0, 8)).id,
      costCenterId: null,
      projectId: null,
    });
    expenses.push(exp);
  }

  /* ═══════════════════════════════════
   *  7. EXPENSE APPROVALS  (for non-draft expenses)
   * ═══════════════════════════════════ */
  const approvalRepo = ds.getRepository(ExpenseApproval);
  const managers = [users[1], users[4], users[8]]; // managers
  for (const exp of expenses) {
    if (exp.status === ExpenseStatus.DRAFT) continue;
    await approvalRepo.save({
      expenseId: exp.id,
      approverId: pick(managers).id,
      level: 1,
      status: [ExpenseStatus.APPROVED_L1, ExpenseStatus.APPROVED_L2, ExpenseStatus.PAID].includes(exp.status)
        ? ApprovalStatus.APPROVED
        : exp.status === ExpenseStatus.REJECTED
        ? ApprovalStatus.REJECTED
        : ApprovalStatus.PENDING,
      comment: exp.status === ExpenseStatus.REJECTED ? 'Montant non conforme au budget' : null,
      approvedAt: [ExpenseStatus.APPROVED_L1, ExpenseStatus.APPROVED_L2, ExpenseStatus.PAID].includes(exp.status)
        ? new Date()
        : null,
    });
    if ([ExpenseStatus.APPROVED_L2, ExpenseStatus.PAID].includes(exp.status)) {
      await approvalRepo.save({
        expenseId: exp.id,
        approverId: users[1].id, // DG
        level: 2,
        status: ApprovalStatus.APPROVED,
        comment: 'Validé par la DG',
        approvedAt: new Date(),
      });
    }
  }

  /* ═══════════════════════════════════
   *  8. CLIENTS  (15)
   * ═══════════════════════════════════ */
  const clientRepo = ds.getRepository(Client);
  const clientsData: Partial<Client>[] = [
    { name: 'Entreprise Sahel Distribution', type: ClientType.COMPANY, email: 'contact@saheldist.ml', phone: '+223 20 22 33 44', taxId: 'ML-NIF-001234', creditLimit: 5000000, score: 85, riskClass: RiskClass.A },
    { name: 'Boutique Chez Mamadou', type: ClientType.INDIVIDUAL, email: 'mamadou@gmail.com', phone: '+223 76 12 34 56', creditLimit: 500000, score: 60, riskClass: RiskClass.B },
    { name: 'SOGEPACK SA', type: ClientType.COMPANY, email: 'info@sogepack.com', phone: '+223 20 21 00 00', taxId: 'ML-NIF-005678', creditLimit: 10000000, score: 92, riskClass: RiskClass.A },
    { name: 'Aliou Bah', type: ClientType.INDIVIDUAL, phone: '+223 66 78 90 12', creditLimit: 200000, score: 45, riskClass: RiskClass.C },
    { name: 'Mali Agri Business', type: ClientType.COMPANY, email: 'malagri@business.ml', phone: '+223 20 23 45 67', taxId: 'ML-NIF-009012', creditLimit: 8000000, score: 78, riskClass: RiskClass.A },
    { name: 'Quincaillerie Moderne', type: ClientType.COMPANY, email: 'qm@qm.ml', phone: '+223 20 22 11 22', creditLimit: 3000000, score: 65, riskClass: RiskClass.B },
    { name: 'Fatoumata Sissoko', type: ClientType.INDIVIDUAL, phone: '+223 79 11 22 33', creditLimit: 100000, score: 30, riskClass: RiskClass.D },
    { name: 'GIE Femmes Battantes', type: ClientType.COMPANY, email: 'gie.fb@gmail.com', phone: '+223 73 44 55 66', creditLimit: 1500000, score: 55, riskClass: RiskClass.B },
    { name: 'Transport Kané & Fils', type: ClientType.COMPANY, email: 'kane.transport@ml.com', phone: '+223 20 29 88 77', taxId: 'ML-NIF-003456', creditLimit: 6000000, score: 70, riskClass: RiskClass.B },
    { name: 'Pharmacie du Fleuve', type: ClientType.COMPANY, email: 'pharma.fleuve@ml.com', phone: '+223 20 22 99 00', taxId: 'ML-NIF-007890', creditLimit: 4000000, score: 80, riskClass: RiskClass.A },
    { name: 'Moussa Touré', type: ClientType.INDIVIDUAL, phone: '+223 65 00 11 22', creditLimit: 300000, score: 50, riskClass: RiskClass.C },
    { name: 'BatiPlus SARL', type: ClientType.COMPANY, email: 'contact@batiplus.ml', phone: '+223 20 28 33 44', taxId: 'ML-NIF-004567', creditLimit: 7000000, score: 75, riskClass: RiskClass.A },
    { name: 'Salon Élégance', type: ClientType.INDIVIDUAL, email: 'elegance@gmail.com', phone: '+223 76 55 44 33', creditLimit: 400000, score: 40, riskClass: RiskClass.C },
    { name: 'Groupe Lafia', type: ClientType.COMPANY, email: 'info@lafia.ml', phone: '+223 20 20 00 01', taxId: 'ML-NIF-008901', creditLimit: 15000000, score: 95, riskClass: RiskClass.A },
    { name: 'Ibrahima Cissé', type: ClientType.INDIVIDUAL, phone: '+223 69 88 77 66', creditLimit: 150000, score: 35, riskClass: RiskClass.D },
  ];
  const clients = await clientRepo.save(clientsData);

  /* ═══════════════════════════════════
   *  9. PRODUCTS  (20)
   * ═══════════════════════════════════ */
  const prodRepo = ds.getRepository(Product);
  const productsData: Partial<Product>[] = [
    { name: 'Rame papier A4 (80g)', sku: 'PAP-A4-80', category: 'Fournitures', unitPrice: 3500, taxRate: 18 },
    { name: 'Stylo BIC bleu (boîte 50)', sku: 'STY-BIC-50', category: 'Fournitures', unitPrice: 12500, taxRate: 18 },
    { name: 'Cartouche HP 305 Noir', sku: 'CRT-HP305N', category: 'Fournitures', unitPrice: 22000, taxRate: 18 },
    { name: 'Classeur à levier A4', sku: 'CLA-LEV-A4', category: 'Fournitures', unitPrice: 2500, taxRate: 18 },
    { name: 'Ordinateur portable HP ProBook', sku: 'PC-HP-PB45', category: 'Informatique', unitPrice: 450000, taxRate: 18 },
    { name: 'Écran 24" Dell', sku: 'ECR-DELL-24', category: 'Informatique', unitPrice: 185000, taxRate: 18 },
    { name: 'Clavier sans fil Logitech', sku: 'CLV-LOG-WL', category: 'Informatique', unitPrice: 25000, taxRate: 18 },
    { name: 'Souris optique USB', sku: 'SOU-OPT-US', category: 'Informatique', unitPrice: 8500, taxRate: 18 },
    { name: 'Câble réseau Cat6 (3m)', sku: 'CAB-CAT6-3', category: 'Informatique', unitPrice: 3000, taxRate: 18 },
    { name: 'Chaise de bureau ergonomique', sku: 'CHR-ERG-01', category: 'Mobilier', unitPrice: 95000, taxRate: 18 },
    { name: 'Bureau droit 140cm', sku: 'BUR-DRT-14', category: 'Mobilier', unitPrice: 120000, taxRate: 18 },
    { name: 'Armoire métallique 2 portes', sku: 'ARM-MET-2P', category: 'Mobilier', unitPrice: 175000, taxRate: 18 },
    { name: 'Climatiseur split 12000 BTU', sku: 'CLI-SPL-12', category: 'Équipement', unitPrice: 280000, taxRate: 18 },
    { name: 'Groupe électrogène 5KVA', sku: 'GRP-ELC-5K', category: 'Équipement', unitPrice: 650000, taxRate: 18 },
    { name: 'Onduleur 1500VA', sku: 'OND-1500VA', category: 'Équipement', unitPrice: 125000, taxRate: 18 },
    { name: 'Photocopieur Ricoh MP2014', sku: 'PHO-RIC-20', category: 'Équipement', unitPrice: 850000, taxRate: 18 },
    { name: 'Toner Ricoh MP2014', sku: 'TON-RIC-20', category: 'Consommables', unitPrice: 35000, taxRate: 18 },
    { name: 'Désinfectant 5L', sku: 'DES-5L-001', category: 'Entretien', unitPrice: 7500, taxRate: 18 },
    { name: 'Savon liquide 5L', sku: 'SAV-LIQ-5L', category: 'Entretien', unitPrice: 6000, taxRate: 18 },
    { name: 'Pack eau minérale (12x1.5L)', sku: 'EAU-MIN-12', category: 'Consommables', unitPrice: 4800, taxRate: 0 },
  ];
  const products = await prodRepo.save(productsData);

  /* ═══════════════════════════════════
   *  10. SALES  (30) + SALE ITEMS + PAYMENTS
   * ═══════════════════════════════════ */
  const saleRepo = ds.getRepository(Sale);
  const saleItemRepo = ds.getRepository(SaleItem);
  const paymentRepo = ds.getRepository(Payment);
  const saleStatuses = [SaleStatus.DRAFT, SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_PAID, SaleStatus.PAID, SaleStatus.PAID];
  const sellers = [users[5], users[6], users[4]]; // cashiers + commercial manager

  for (let i = 0; i < 30; i++) {
    const client = pick(clients);
    const status = pick(saleStatuses);
    const saleDate = date(Math.floor(Math.random() * 120));

    // Create sale
    const sale = await saleRepo.save({
      reference: `VTE-2026-${String(i + 1).padStart(5, '0')}`,
      date: saleDate,
      clientId: client.id,
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      status,
      sellerId: pick(sellers).id,
    });

    // Create 1-5 line items
    const nbItems = Math.floor(Math.random() * 5) + 1;
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    for (let j = 0; j < nbItems; j++) {
      const prod = pick(products);
      const qty = Math.floor(Math.random() * 10) + 1;
      const discPct = Math.random() > 0.7 ? Math.floor(Math.random() * 15) : 0;
      const lineGross = qty * Number(prod.unitPrice);
      const lineDiscount = Math.round(lineGross * discPct / 100);
      const lineNet = lineGross - lineDiscount;
      const lineTax = Math.round(lineNet * Number(prod.taxRate) / 100);
      const lineSubtotal = lineNet + lineTax;

      await saleItemRepo.save({
        saleId: sale.id,
        productId: prod.id,
        quantity: qty,
        unitPrice: prod.unitPrice,
        discountPercent: discPct,
        discountAmount: lineDiscount,
        taxRate: prod.taxRate,
        subtotal: lineSubtotal,
      });

      subtotal += lineNet;
      taxAmount += lineTax;
      discountAmount += lineDiscount;
    }

    const total = subtotal + taxAmount;
    await saleRepo.update(sale.id, { subtotal, taxAmount, discountAmount, total });

    // Create payment(s) for paid / partially paid sales
    if (status === SaleStatus.PAID) {
      await paymentRepo.save({
        saleId: sale.id,
        amount: total,
        method: pick(payMethods),
        reference: `PAY-${String(i + 1).padStart(5, '0')}`,
        date: saleDate,
        receivedById: pick(sellers).id,
      });
    } else if (status === SaleStatus.PARTIALLY_PAID) {
      const partial = Math.round(total * (Math.random() * 0.5 + 0.2));
      await paymentRepo.save({
        saleId: sale.id,
        amount: partial,
        method: pick(payMethods),
        reference: `PAY-${String(i + 1).padStart(5, '0')}-P`,
        date: saleDate,
        receivedById: pick(sellers).id,
      });
    }
  }

  console.log('Seed data inserted:');
  console.log('  - 4 roles');
  console.log('  - 5 departments');
  console.log('  - 10 users');
  console.log('  - 20 expense categories');
  console.log('  - 50 expenses (with approvals)');
  console.log('  - 5 budgets');
  console.log('  - 15 clients');
  console.log('  - 20 products');
  console.log('  - 30 sales (with items & payments)');
}
