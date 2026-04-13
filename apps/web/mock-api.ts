/**
 * Vite dev server middleware that serves mock API responses
 * for endpoints not yet implemented in the backend.
 * Only active during development.
 */
import type { Plugin } from 'vite';
import QRCode from 'qrcode';

// ── Helpers ──────────────────────────────────────────────
const json = (res: any, data: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ data }));
};

const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const now = new Date();

// ── Mock data ────────────────────────────────────────────

const kpis = {
  cashBalance: 12_450_000,
  monthExpenses: 3_280_000,
  monthRevenue: 5_640_000,
  outstandingReceivables: 1_870_000,
  cashBalanceTrend: 8.3,
  monthExpensesTrend: -4.1,
  monthRevenueTrend: 12.7,
  receivablesTrend: -2.5,
};

const treasury = Array.from({ length: 12 }, (_, i) => ({
  month: months[i],
  amount: 8_000_000 + Math.round(Math.random() * 6_000_000),
}));

const comparison = Array.from({ length: 6 }, (_, i) => ({
  month: months[(now.getMonth() - 5 + i + 12) % 12],
  expenses: 2_000_000 + Math.round(Math.random() * 2_500_000),
  revenue: 3_500_000 + Math.round(Math.random() * 3_000_000),
}));

const categories = [
  { name: 'Fournitures', value: 980_000 },
  { name: 'Loyer', value: 750_000 },
  { name: 'Salaires', value: 1_450_000 },
  { name: 'Transport', value: 320_000 },
  { name: 'Marketing', value: 210_000 },
  { name: 'Divers', value: 150_000 },
];

const topClients = [
  { clientId: 'c1', clientName: 'Ets Moussa & Fils', revenue: 2_340_000 },
  { clientId: 'c2', clientName: 'Sarl TechnoPlus', revenue: 1_870_000 },
  { clientId: 'c3', clientName: 'Boulangerie Kader', revenue: 1_560_000 },
  { clientId: 'c4', clientName: 'Pharmacie El Afia', revenue: 1_120_000 },
  { clientId: 'c5', clientName: 'Garage Central', revenue: 890_000 },
];

const alerts = [
  {
    id: 'a1',
    type: 'ANOMALY',
    severity: 'HIGH',
    title: 'Dépense inhabituelle détectée',
    message:
      'La dépense DEP-2026-0412 de 850 000 FCFA est 3.2x supérieure à la moyenne habituelle pour la catégorie Fournitures.',
    entityType: 'expense',
    entityId: 'e1',
    entityRoute: '/expenses/e1',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    isRead: false,
  },
  {
    id: 'a2',
    type: 'BUDGET',
    severity: 'MEDIUM',
    title: 'Budget Transport atteint 85%',
    message:
      "Le budget Transport a consommé 85% de l'enveloppe mensuelle. Il reste 48 000 FCFA disponibles.",
    entityType: 'budget',
    entityId: 'b1',
    entityRoute: '/expenses/budget',
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
    isRead: false,
  },
  {
    id: 'a3',
    type: 'RECEIVABLE',
    severity: 'HIGH',
    title: 'Créance échue — Ets Moussa & Fils',
    message:
      'La facture VNT-2026-0089 de 420 000 FCFA est en retard de 15 jours. Le client a dépassé sa limite de crédit.',
    entityType: 'sale',
    entityId: 's1',
    entityRoute: '/sales/s1',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    isRead: true,
  },
  {
    id: 'a4',
    type: 'FORECAST',
    severity: 'LOW',
    title: 'Prévision : hausse des ventes',
    message:
      "L'IA prévoit une hausse de +12% des ventes la semaine prochaine, basée sur les tendances saisonnières.",
    entityType: 'forecast',
    entityId: 'f1',
    entityRoute: '/',
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    isRead: true,
  },
];

const forecast = {
  dataPoints: Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86_400_000);
    const predicted = 700_000 + Math.round(Math.random() * 400_000);
    return {
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      predicted,
      lower: Math.round(predicted * 0.82),
      upper: Math.round(predicted * 1.18),
    };
  }),
  trend: 12.4,
  trendDirection: 'up' as const,
};

const notifications = [
  {
    id: 'n1',
    type: 'EXPENSE',
    title: 'Dépense approuvée',
    message: 'La dépense DEP-2026-0398 de 125 000 FCFA a été approuvée par Admin.',
    entityRoute: '/expenses/e1',
    isRead: false,
    createdAt: new Date(Date.now() - 1_800_000).toISOString(),
  },
  {
    id: 'n2',
    type: 'SALE',
    title: 'Nouvelle vente enregistrée',
    message: 'Vente VNT-2026-0156 — 340 000 FCFA pour Ets Moussa & Fils.',
    entityRoute: '/sales/s1',
    isRead: false,
    createdAt: new Date(Date.now() - 5_400_000).toISOString(),
  },
  {
    id: 'n3',
    type: 'PAYMENT',
    title: 'Paiement reçu',
    message: 'Paiement de 200 000 FCFA reçu de Sarl TechnoPlus (VNT-2026-0142).',
    entityRoute: '/sales/s2',
    isRead: false,
    createdAt: new Date(Date.now() - 10_800_000).toISOString(),
  },
  {
    id: 'n4',
    type: 'ALERT',
    title: "Anomalie détectée par l'IA",
    message: 'Une dépense inhabituelle a été détectée dans la catégorie Fournitures.',
    entityRoute: '/expenses/e2',
    isRead: true,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 'n5',
    type: 'SYSTEM',
    title: 'Mise à jour système',
    message: 'CaisseFlow Pro v0.2.0 est disponible avec de nouvelles fonctionnalités IA.',
    isRead: true,
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
  },
  {
    id: 'n6',
    type: 'EXPENSE',
    title: 'Dépense rejetée',
    message: 'La dépense DEP-2026-0395 a été rejetée : justificatif manquant.',
    entityRoute: '/expenses/e3',
    isRead: true,
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
  },
];

const chatResponses: Record<string, { content: string; chartData?: any }> = {
  default: {
    content:
      'Voici un résumé rapide :\n\n• Solde de caisse : 12 450 000 FCFA (+8.3%)\n• Dépenses du mois : 3 280 000 FCFA\n• Recettes du mois : 5 640 000 FCFA\n\nVoulez-vous plus de détails sur un point en particulier ?',
  },
  expenses: {
    content: "Vos dépenses du mois s'élèvent à **3 280 000 FCFA**, réparties ainsi :",
    chartData: {
      type: 'bar',
      data: categories.map((c) => ({ name: c.name, amount: c.value })),
      dataKey: 'amount',
    },
  },
  receivables: {
    content:
      "Vous avez **1 870 000 FCFA** de créances en cours.\n\n• 3 factures échues (> 30 jours)\n• Client le plus exposé : Ets Moussa & Fils (420 000 FCFA)\n\nJe recommande d'envoyer une relance pour les factures de plus de 15 jours.",
  },
  budget: {
    content: 'État de vos budgets ce mois-ci :',
    chartData: {
      type: 'bar',
      data: [
        { name: 'Fournitures', amount: 85 },
        { name: 'Loyer', amount: 100 },
        { name: 'Salaires', amount: 72 },
        { name: 'Transport', amount: 85 },
        { name: 'Marketing', amount: 45 },
      ],
      dataKey: 'amount',
      label: '% consommé',
    },
  },
};

// ── Track read state ─────────────────────────────────────
const readIds = new Set<string>();

// ── Mock admin data ──────────────────────────────────────
const mockCompanies = [
  {
    id: 'comp-1',
    tenantId: 'tenant-1',
    name: 'Entreprise Demo SARL',
    code: 'DEMO',
    address: 'Rue 310, Bamako, Mali',
    phone: '+223 20 22 33 44',
    email: 'contact@demo-sarl.com',
    taxId: 'ML-NIF-2025-00123',
    tradeRegister: 'BKO-2025-B-1234',
    currency: 'XOF',
    logo: null,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'comp-2',
    tenantId: 'tenant-1',
    name: 'CaisseFlow Holding',
    code: 'CFH',
    address: 'Avenue Kwame Nkrumah, Abidjan',
    phone: '+225 27 22 11 00',
    email: 'info@caisseflow.com',
    taxId: 'CI-CC-2025-5678',
    tradeRegister: 'ABJ-2025-A-5678',
    currency: 'XOF',
    logo: null,
    isActive: true,
    createdAt: '2025-02-15T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
  },
];

function resolveCompanyNames(ids?: string[]) {
  if (!ids?.length) return [];
  return ids.map((id) => mockCompanies.find((c) => c.id === id)?.name).filter(Boolean) as string[];
}

const mockUsers = [
  {
    id: 'u1',
    email: 'admin@caisseflow.com',
    firstName: 'Amadou',
    lastName: 'Diallo',
    role: 'admin',
    roleName: 'ADMIN',
    isActive: true,
    mfaEnabled: false,
    mfaConfigured: false,
    lastLogin: new Date(Date.now() - 1_800_000).toISOString(),
    createdAt: '2025-01-15T10:00:00Z',
    allowedModules: ['admin', 'expense', 'sales', 'fne', 'decision', 'manager-caisse'],
    companyIds: ['comp-1', 'comp-2'],
  },
  {
    id: 'u2',
    email: 'fatou@caisseflow.com',
    firstName: 'Fatou',
    lastName: 'Keita',
    role: 'manager',
    roleName: 'MANAGER',
    isActive: true,
    mfaEnabled: false,
    mfaConfigured: false,
    lastLogin: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: '2025-02-20T08:30:00Z',
    allowedModules: ['decision'],
    companyIds: ['comp-1'],
  },
  {
    id: 'u3',
    email: 'moussa@caisseflow.com',
    firstName: 'Moussa',
    lastName: 'Traoré',
    role: 'cashier',
    roleName: 'CASHIER',
    isActive: true,
    mfaEnabled: false,
    mfaConfigured: false,
    lastLogin: new Date(Date.now() - 3_600_000).toISOString(),
    createdAt: '2025-03-10T14:15:00Z',
    allowedModules: ['expense', 'sales'],
    companyIds: ['comp-1'],
  },
  {
    id: 'u4',
    email: 'awa@caisseflow.com',
    firstName: 'Awa',
    lastName: 'Coulibaly',
    role: 'cashier',
    roleName: 'CASHIER',
    isActive: true,
    mfaEnabled: false,
    mfaConfigured: false,
    lastLogin: new Date(Date.now() - 172_800_000).toISOString(),
    createdAt: '2025-04-05T09:00:00Z',
    allowedModules: ['expense'],
    companyIds: ['comp-2'],
  },
  {
    id: 'u5',
    email: 'ibrahim@caisseflow.com',
    firstName: 'Ibrahim',
    lastName: 'Sanogo',
    role: 'viewer',
    roleName: 'ACCOUNTANT',
    isActive: false,
    mfaEnabled: false,
    mfaConfigured: false,
    createdAt: '2025-05-01T11:30:00Z',
    allowedModules: ['expense'],
    companyIds: [],
  },
];

const mockEmployees: Array<Record<string, unknown>> = [
  {
    id: 'emp-1',
    matricule: 'MAT-001',
    firstName: 'Amadou',
    lastName: 'Diallo',
    email: 'a.diallo@entreprise.com',
    service: 'Comptabilité',
    position: 'Comptable',
    phone: '+225 07 00 00 01',
    isActive: true,
    createdAt: '2025-06-01T08:00:00Z',
  },
  {
    id: 'emp-2',
    matricule: 'MAT-042',
    firstName: 'Fatou',
    lastName: 'Koné',
    email: 'f.kone@entreprise.com',
    service: 'Logistique',
    position: 'Responsable logistique',
    phone: '+225 07 00 00 02',
    isActive: true,
    createdAt: '2025-06-10T09:00:00Z',
  },
  {
    id: 'emp-3',
    matricule: 'MAT-018',
    firstName: 'Ibrahim',
    lastName: 'Touré',
    email: 'i.toure@entreprise.com',
    service: 'Marketing',
    position: 'Chef de projet',
    phone: '+225 07 00 00 03',
    isActive: true,
    createdAt: '2025-07-01T10:00:00Z',
  },
  {
    id: 'emp-4',
    matricule: 'MAT-055',
    firstName: 'Mariam',
    lastName: 'Cissé',
    email: 'm.cisse@entreprise.com',
    service: 'Ressources Humaines',
    position: 'Assistante RH',
    phone: '+225 07 00 00 04',
    isActive: true,
    createdAt: '2025-08-15T11:00:00Z',
  },
  {
    id: 'emp-5',
    matricule: 'MAT-073',
    firstName: 'Oumar',
    lastName: 'Bamba',
    email: 'o.bamba@entreprise.com',
    service: 'Informatique',
    position: 'Développeur',
    phone: '+225 07 00 00 05',
    isActive: false,
    createdAt: '2025-09-01T08:30:00Z',
  },
];

// ── Mock MFA state ───────────────────────────────────────
const mockMfaSecrets: Record<string, string> = {};
const mockMfaTempTokens: Record<string, string> = {}; // tempToken → userId

function makeMockJwt(user: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      roleName: user.roleName,
      tenantId: 'tenant-1',
      permissions: [],
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString('base64url');
  return `${header}.${payload}.mock-signature`;
}

const mockRoles = [
  {
    id: 'r1',
    name: 'Administrateur',
    description: 'Accès complet au système',
    permissions: [
      'expenses.read',
      'expenses.write',
      'expenses.approve',
      'sales.read',
      'sales.write',
      'admin.read',
      'admin.write',
      'reports.read',
      'reports.write',
      'closing.read',
      'closing.write',
    ],
    isSystem: true,
    usersCount: 1,
  },
  {
    id: 'r2',
    name: 'Manager',
    description: 'Gestion des dépenses et ventes',
    permissions: [
      'expenses.read',
      'expenses.write',
      'expenses.approve',
      'sales.read',
      'sales.write',
      'reports.read',
      'closing.read',
      'closing.write',
    ],
    isSystem: true,
    usersCount: 1,
  },
  {
    id: 'r3',
    name: 'Caissier',
    description: 'Opérations de caisse quotidiennes',
    permissions: [
      'expenses.read',
      'expenses.write',
      'sales.read',
      'sales.write',
      'closing.read',
      'closing.write',
    ],
    isSystem: true,
    usersCount: 2,
  },
  {
    id: 'r4',
    name: 'Lecteur',
    description: 'Consultation uniquement',
    permissions: ['expenses.read', 'sales.read', 'reports.read', 'closing.read'],
    isSystem: true,
    usersCount: 1,
  },
  {
    id: 'r5',
    name: 'Auditeur',
    description: 'Accès aux logs et rapports',
    permissions: ['expenses.read', 'sales.read', 'admin.read', 'reports.read', 'closing.read'],
    isSystem: false,
    usersCount: 0,
  },
];

const mockPermissions = [
  { key: 'expenses.read', label: 'Lire les dépenses', module: 'expenses' },
  { key: 'expenses.write', label: 'Créer/modifier dépenses', module: 'expenses' },
  { key: 'expenses.approve', label: 'Approuver les dépenses', module: 'expenses' },
  { key: 'expenses.delete', label: 'Supprimer les dépenses', module: 'expenses' },
  { key: 'sales.read', label: 'Lire les ventes', module: 'sales' },
  { key: 'sales.write', label: 'Créer/modifier ventes', module: 'sales' },
  { key: 'sales.cancel', label: 'Annuler les ventes', module: 'sales' },
  { key: 'closing.read', label: "Voir l'état de caisse", module: 'closing' },
  { key: 'closing.write', label: 'Ouvrir/clôturer la caisse', module: 'closing' },
  { key: 'reports.read', label: 'Consulter les rapports', module: 'reports' },
  { key: 'reports.write', label: 'Générer des rapports', module: 'reports' },
  { key: 'admin.read', label: "Consulter l'administration", module: 'admin' },
  { key: 'admin.write', label: "Modifier l'administration", module: 'admin' },
  { key: 'dashboard.read', label: 'Voir le tableau de bord', module: 'dashboard' },
];

const mockSettings = {
  validation: {
    thresholdS1: 500_000,
    thresholdS2: 2_000_000,
    advanceJustificationDays: 7,
    maxDisbursementAmount: 5_000_000,
  },
  finance: {
    defaultTvaRate: 18,
    maxDiscountByRole: { admin: 30, manager: 20, cashier: 10, viewer: 0 },
  },
  ai: { anomalyThreshold: 0.75, forecastHorizonDays: 30 },
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    user: 'noreply@caisseflow.com',
    password: '••••••••',
    fromName: 'CaisseFlow Pro',
    fromEmail: 'noreply@caisseflow.com',
  },
  company: {
    name: 'Entreprise Demo SARL',
    logo: '',
    address: 'Rue 310, Bamako, Mali',
    phone: '+223 20 22 33 44',
    taxId: 'ML-NIF-2025-00123',
  },
};

const mockAuditLogs = Array.from({ length: 30 }, (_, i) => {
  const actions = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'SUBMIT',
    'APPROVE',
    'REJECT',
    'LOGIN',
    'EXPORT',
    'PAY',
  ] as const;
  const entities = ['expense', 'sale', 'payment', 'user', 'category', 'closing'] as const;
  const users = [
    { id: 'u1', name: 'Amadou Diallo' },
    { id: 'u2', name: 'Fatou Keita' },
    { id: 'u3', name: 'Moussa Traoré' },
  ];
  const user = users[i % users.length];
  const action = actions[i % actions.length];
  const entity = entities[i % entities.length];
  return {
    id: `log-${i + 1}`,
    userId: user.id,
    userName: user.name,
    action,
    entityType: entity,
    entityId: `${entity.charAt(0).toUpperCase()}-${1000 + i}`,
    description: `${action} sur ${entity} #${1000 + i}`,
    ipAddress: `192.168.1.${10 + (i % 50)}`,
    createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
  };
});

const mockCategories = [
  {
    id: 'cat1',
    name: 'Fournitures',
    code: 'FOUR',
    parentId: null,
    order: 0,
    isActive: true,
    accountingDebitAccount: '601000',
    accountingCreditAccount: '512000',
  },
  {
    id: 'cat1a',
    name: 'Fournitures bureau',
    code: 'FOUR-BUR',
    parentId: 'cat1',
    order: 0,
    isActive: true,
    accountingDebitAccount: '601100',
    accountingCreditAccount: '512000',
  },
  {
    id: 'cat1b',
    name: 'Fournitures informatiques',
    code: 'FOUR-INF',
    parentId: 'cat1',
    order: 1,
    isActive: true,
    accountingDebitAccount: '601200',
    accountingCreditAccount: '512000',
  },
  {
    id: 'cat2',
    name: 'Loyer',
    code: 'LOYER',
    parentId: null,
    order: 1,
    isActive: true,
    accountingDebitAccount: '613000',
    accountingCreditAccount: '512000',
  },
  {
    id: 'cat3',
    name: 'Salaires',
    code: 'SAL',
    parentId: null,
    order: 2,
    isActive: true,
    accountingDebitAccount: '641000',
    accountingCreditAccount: '421000',
  },
  {
    id: 'cat3a',
    name: 'Salaires permanents',
    code: 'SAL-PERM',
    parentId: 'cat3',
    order: 0,
    isActive: true,
    accountingDebitAccount: '641100',
    accountingCreditAccount: '421000',
  },
  {
    id: 'cat3b',
    name: 'Consultants',
    code: 'SAL-CONS',
    parentId: 'cat3',
    order: 1,
    isActive: true,
    accountingDebitAccount: '622000',
    accountingCreditAccount: '401000',
  },
  {
    id: 'cat4',
    name: 'Transport',
    code: 'TRANS',
    parentId: null,
    order: 3,
    isActive: true,
    accountingDebitAccount: '625000',
    accountingCreditAccount: '512000',
  },
  {
    id: 'cat5',
    name: 'Marketing',
    code: 'MKT',
    parentId: null,
    order: 4,
    isActive: true,
    accountingDebitAccount: '623000',
    accountingCreditAccount: '512000',
  },
  {
    id: 'cat6',
    name: 'Divers',
    code: 'DIV',
    parentId: null,
    order: 5,
    isActive: false,
    accountingDebitAccount: null,
    accountingCreditAccount: null,
  },
];

const mockReportHistory = [
  {
    id: 'rpt1',
    type: 'monthly-expenses',
    name: 'Dépenses Juin 2025',
    dateFrom: '2025-06-01',
    dateTo: '2025-06-30',
    format: 'pdf',
    size: 245_000,
    downloadUrl: '#',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdBy: 'Amadou Diallo',
  },
  {
    id: 'rpt2',
    type: 'monthly-sales',
    name: 'Ventes Juin 2025',
    dateFrom: '2025-06-01',
    dateTo: '2025-06-30',
    format: 'xlsx',
    size: 189_000,
    downloadUrl: '#',
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    createdBy: 'Fatou Keita',
  },
  {
    id: 'rpt3',
    type: 'budget-tracking',
    name: 'Suivi budget Q2 2025',
    dateFrom: '2025-04-01',
    dateTo: '2025-06-30',
    format: 'pdf',
    size: 512_000,
    downloadUrl: '#',
    createdAt: new Date(Date.now() - 604_800_000).toISOString(),
    createdBy: 'Amadou Diallo',
  },
];

// In-memory store for report design configs (mock DB)
const mockReportDesignConfigs: any[] = [];

const mockNarrativeReport = {
  id: 'nar1',
  period: '2025-07',
  markdownContent: `# Rapport narratif — Juillet 2025

## Résumé exécutif

Le mois de juillet 2025 a été marqué par une **hausse significative des recettes** (+12.7% par rapport au mois précédent) accompagnée d'une **maîtrise des dépenses** (-4.1%). Le solde de caisse s'établit à **12 450 000 FCFA**, en progression de 8.3%.

## Analyse des ventes

- Chiffre d'affaires mensuel : **5 640 000 FCFA**
- Nombre de transactions : **234 ventes**
- Panier moyen : **24 100 FCFA** (+5.2%)
- Taux d'encaissement : **87.3%**

Le client **Ets Moussa & Fils** reste le premier contributeur au chiffre d'affaires avec **2 340 000 FCFA** de commandes.

## Analyse des dépenses

- Total des dépenses : **3 280 000 FCFA**
- Catégorie principale : **Salaires** (1 450 000 FCFA, 44.2%)
- 3 anomalies détectées par l'IA, dont 1 confirmée

> La dépense de 850 000 FCFA en fournitures a été signalée comme inhabituelle (3.2x la moyenne). Après vérification, il s'agissait d'un achat groupé trimestriel.

## Créances

- Créances en cours : **1 870 000 FCFA** (-2.5%)
- 3 factures en retard de plus de 30 jours
- Recommandation : envoyer une relance à Ets Moussa & Fils (420 000 FCFA à 15 jours)

## Prévisions IA

L'intelligence artificielle prévoit une **hausse de 12.4%** des ventes pour la semaine à venir, basée sur les tendances saisonnières et le calendrier commercial.

### Recommandations

- Renforcer les stocks de fournitures avant le pic d'activité prévu
- Relancer les créances de plus de 15 jours
- Revoir le budget Marketing (consommé à seulement 45%)`,
  generatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  generatedBy: 'IA CaisseFlow',
};

// ── Mock expenses data ───────────────────────────────────
const mockExpenseCategories = [
  {
    id: 'cat1',
    name: 'Fournitures',
    code: 'FOUR',
    parentId: null,
    parentName: null,
    budgetLimit: 1_200_000,
    isActive: true,
    children: [
      {
        id: 'cat1a',
        name: 'Fournitures bureau',
        code: 'FOUR-BUR',
        parentId: 'cat1',
        parentName: 'Fournitures',
        budgetLimit: null,
        isActive: true,
        children: [],
      },
      {
        id: 'cat1b',
        name: 'Fournitures informatiques',
        code: 'FOUR-INF',
        parentId: 'cat1',
        parentName: 'Fournitures',
        budgetLimit: null,
        isActive: true,
        children: [],
      },
    ],
  },
  {
    id: 'cat2',
    name: 'Loyer',
    code: 'LOYER',
    parentId: null,
    parentName: null,
    budgetLimit: 800_000,
    isActive: true,
    children: [],
  },
  {
    id: 'cat3',
    name: 'Salaires',
    code: 'SAL',
    parentId: null,
    parentName: null,
    budgetLimit: 2_000_000,
    isActive: true,
    children: [
      {
        id: 'cat3a',
        name: 'Salaires permanents',
        code: 'SAL-PERM',
        parentId: 'cat3',
        parentName: 'Salaires',
        budgetLimit: null,
        isActive: true,
        children: [],
      },
      {
        id: 'cat3b',
        name: 'Consultants',
        code: 'SAL-CONS',
        parentId: 'cat3',
        parentName: 'Salaires',
        budgetLimit: null,
        isActive: true,
        children: [],
      },
    ],
  },
  {
    id: 'cat4',
    name: 'Transport',
    code: 'TRANS',
    parentId: null,
    parentName: null,
    budgetLimit: 400_000,
    isActive: true,
    children: [],
  },
  {
    id: 'cat5',
    name: 'Marketing',
    code: 'MKT',
    parentId: null,
    parentName: null,
    budgetLimit: 500_000,
    isActive: true,
    children: [],
  },
  {
    id: 'cat6',
    name: 'Divers',
    code: 'DIV',
    parentId: null,
    parentName: null,
    budgetLimit: null,
    isActive: true,
    children: [],
  },
];

// ── Approval Circuits (circuits de validation) ───────────
const mockApprovalCircuits = [
  {
    id: 'ac1',
    name: 'Petit décaissement',
    minAmount: 0,
    maxAmount: 100_000,
    steps: [
      { level: 1, role: 'chef_comptable' as const, approverId: 'u2', approverName: 'Fatou Keita' },
    ],
    isActive: true,
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'ac2',
    name: 'Décaissement moyen',
    minAmount: 100_001,
    maxAmount: 500_000,
    steps: [
      { level: 1, role: 'chef_comptable' as const, approverId: 'u2', approverName: 'Fatou Keita' },
      { level: 2, role: 'daf' as const, approverId: 'u2', approverName: 'Fatou Keita' },
    ],
    isActive: true,
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'ac3',
    name: 'Gros décaissement',
    minAmount: 500_001,
    maxAmount: null,
    steps: [
      { level: 1, role: 'chef_comptable' as const, approverId: 'u2', approverName: 'Fatou Keita' },
      { level: 2, role: 'daf' as const, approverId: 'u2', approverName: 'Fatou Keita' },
      { level: 3, role: 'dg' as const, approverId: 'u2', approverName: 'Fatou Keita' },
    ],
    isActive: true,
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
  },
];

/** Find the matching approval circuit for a given amount */
function findApprovalCircuit(amount: number) {
  return mockApprovalCircuits.find(
    (c) => c.isActive && amount >= c.minAmount && (c.maxAmount === null || amount <= c.maxAmount),
  );
}

/** Generate approval steps from a circuit */
function generateApprovals(circuit: (typeof mockApprovalCircuits)[0]) {
  return circuit.steps.map((step) => ({
    id: `apr-${Date.now()}-${step.level}`,
    approverId: step.approverId,
    approverName: step.approverName,
    level: step.level,
    status: 'PENDING' as const,
    comment: null,
    approvedAt: null,
  }));
}

const mockExpenses: Array<Record<string, any>> = [];

const mockBudgetSummary = {
  totalAllocated: 4_900_000,
  totalConsumed: 3_280_000,
  totalRemaining: 1_620_000,
  categories: [
    {
      categoryId: 'cat1',
      categoryName: 'Fournitures',
      allocated: 1_200_000,
      consumed: 980_000,
      percent: 81.7,
    },
    {
      categoryId: 'cat2',
      categoryName: 'Loyer',
      allocated: 800_000,
      consumed: 750_000,
      percent: 93.8,
    },
    {
      categoryId: 'cat3',
      categoryName: 'Salaires',
      allocated: 2_000_000,
      consumed: 1_450_000,
      percent: 72.5,
    },
    {
      categoryId: 'cat4',
      categoryName: 'Transport',
      allocated: 400_000,
      consumed: 320_000,
      percent: 80,
    },
    {
      categoryId: 'cat5',
      categoryName: 'Marketing',
      allocated: 500_000,
      consumed: 210_000,
      percent: 42,
    },
  ],
  monthlyTrend: months
    .slice(0, now.getMonth() + 1)
    .map((m, i) => ({ month: m, amount: 2_500_000 + Math.round(Math.random() * 1_500_000) })),
  forecast: [
    { month: months[(now.getMonth() + 1) % 12], amount: 3_400_000 },
    { month: months[(now.getMonth() + 2) % 12], amount: 3_100_000 },
  ],
};

// ── Mock sales data ──────────────────────────────────────
const mockSaleKpis = {
  todayRevenue: 1_840_000,
  monthRevenue: 5_640_000,
  todaySalesCount: 12,
  collectionRate: 87.3,
};

const mockProducts: Array<{
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  taxRate: number;
  isActive: boolean;
  description: string | null;
}> = [
  {
    id: 'p1',
    name: 'Ciment CPA 50kg',
    sku: 'CIM-50',
    category: 'Matériaux',
    unitPrice: 5_500,
    taxRate: 18,
    isActive: true,
    description: null,
  },
  {
    id: 'p2',
    name: 'Fer à béton 10mm',
    sku: 'FER-10',
    category: 'Matériaux',
    unitPrice: 3_200,
    taxRate: 18,
    isActive: true,
    description: null,
  },
  {
    id: 'p3',
    name: 'Peinture acrylique 20L',
    sku: 'PNT-20',
    category: 'Peinture',
    unitPrice: 28_000,
    taxRate: 18,
    isActive: true,
    description: null,
  },
  {
    id: 'p4',
    name: 'Tuyau PVC 110mm',
    sku: 'TUY-110',
    category: 'Plomberie',
    unitPrice: 8_500,
    taxRate: 18,
    isActive: true,
    description: null,
  },
  {
    id: 'p5',
    name: 'Câble électrique 2.5mm',
    sku: 'CAB-25',
    category: 'Électricité',
    unitPrice: 45_000,
    taxRate: 18,
    isActive: true,
    description: null,
  },
  {
    id: 'p6',
    name: 'Brique creuse 15',
    sku: 'BRK-15',
    category: 'Matériaux',
    unitPrice: 250,
    taxRate: 18,
    isActive: true,
    description: null,
  },
];

const clientNames = [
  'Ets Moussa & Fils',
  'Sarl TechnoPlus',
  'Boulangerie Kader',
  'Pharmacie El Afia',
  'Garage Central',
  'Quincaillerie Diallo',
  'Ets Koné Import',
  'Société ABC',
];
const sellerNames = ['Moussa Traoré', 'Awa Coulibaly', 'Amadou Diallo'];

const mockClients: Array<{
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  creditLimit: number;
  score: number;
  riskClass: string;
  isActive: boolean;
  totalPurchases: number;
  outstandingBalance: number;
  createdAt: string;
}> = clientNames.map((name, i) => ({
  id: `c${i + 1}`,
  name,
  type: i % 3 === 0 ? 'INDIVIDUAL' : 'COMPANY',
  email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@email.com`,
  phone: `+223 7${i}${i + 1} ${i + 2}${i + 3} ${i + 4}${i + 5}`,
  address: `Rue ${100 + i}, Bamako`,
  taxId: i % 2 === 0 ? `ML-NIF-${2025 + i}` : null,
  creditLimit: 1_000_000 + i * 500_000,
  score: 60 + Math.round(Math.random() * 40),
  riskClass: ['A', 'B', 'B', 'C', 'A', 'B', 'C', 'D'][i],
  isActive: i !== 7,
  totalPurchases: 1_000_000 + Math.round(Math.random() * 5_000_000),
  outstandingBalance: Math.round(Math.random() * 800_000),
  createdAt: new Date(Date.now() - (365 - i * 30) * 86_400_000).toISOString(),
}));

const saleStatuses = ['DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;
const paymentMethods = ['CASH', 'CHECK', 'TRANSFER', 'MOBILE_MONEY'] as const;

const mockSales = Array.from({ length: 40 }, (_, i) => {
  const status = saleStatuses[i % saleStatuses.length];
  const client = mockClients[i % mockClients.length];
  const seller = sellerNames[i % sellerNames.length];
  const itemCount = 1 + (i % 3);
  const items = Array.from({ length: itemCount }, (_, j) => {
    const prod = mockProducts[(i + j) % mockProducts.length];
    const qty = 1 + j * 2;
    const disc = j === 0 ? 5 : 0;
    const subtotal = prod.unitPrice * qty * (1 - disc / 100);
    return {
      id: `si-${i}-${j}`,
      productId: prod.id,
      productName: prod.name,
      productSku: prod.sku,
      quantity: qty,
      unitPrice: prod.unitPrice,
      discountPercent: disc,
      discountAmount: Math.round((prod.unitPrice * qty * disc) / 100),
      taxRate: prod.taxRate,
      subtotal: Math.round(subtotal),
    };
  });
  const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
  const taxAmount = Math.round(subtotal * 0.18);
  const total = subtotal + taxAmount;
  const paidAmount =
    status === 'PAID' ? total : status === 'PARTIALLY_PAID' ? Math.round(total * 0.5) : 0;
  const payments =
    paidAmount > 0
      ? [
          {
            id: `pay-${i}`,
            saleId: `s${i + 1}`,
            amount: paidAmount,
            method: paymentMethods[i % paymentMethods.length],
            reference: i % 2 === 0 ? `REF-${1000 + i}` : null,
            date: new Date(Date.now() - i * 86_400_000).toISOString().split('T')[0],
            receivedById: 'u3',
            receivedByName: 'Moussa Traoré',
            createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
          },
        ]
      : [];
  return {
    id: `s${i + 1}`,
    reference: `VNT-2026-${String(100 + i).padStart(4, '0')}`,
    date: new Date(Date.now() - i * 86_400_000).toISOString().split('T')[0],
    clientId: client.id,
    clientName: client.name,
    subtotal,
    taxAmount,
    discountAmount: items.reduce((s, it) => s + it.discountAmount, 0),
    total,
    status,
    sellerId: `u${(i % 3) + 1}`,
    sellerName: seller,
    items,
    payments,
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  };
});

const agingBuckets = ['CURRENT', '30', '60', '90', 'OVERDUE'] as const;
const mockReceivables = Array.from({ length: 20 }, (_, i) => {
  const sale = mockSales[i % mockSales.length];
  const amountDue = Math.round(sale.total * (0.3 + Math.random() * 0.7));
  const amountPaid = Math.round(amountDue * Math.random() * 0.6);
  return {
    id: `rec-${i + 1}`,
    saleId: sale.id,
    saleReference: sale.reference,
    clientId: sale.clientId!,
    clientName: sale.clientName!,
    amountDue,
    amountPaid,
    balance: amountDue - amountPaid,
    dueDate: new Date(Date.now() - (i - 5) * 86_400_000).toISOString().split('T')[0],
    status: amountPaid >= amountDue ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'PENDING',
    agingBucket: agingBuckets[i % agingBuckets.length],
    createdAt: new Date(Date.now() - i * 2 * 86_400_000).toISOString(),
  };
});

const mockAgingSummary = {
  current: 450_000,
  days30: 380_000,
  days60: 290_000,
  days90: 210_000,
  overdue: 540_000,
  total: 1_870_000,
};

// ── Module-specific dashboard data ───────────────────────

const expenseDashKpis = {
  totalExpenses: 3_280_000,
  pendingApprovals: 5,
  budgetUtilization: 66.9,
  overduePayments: 2,
  totalExpensesTrend: -4.1,
  pendingTrend: 2,
  budgetTrend: 3.2,
  overdueTrend: -1,
};

const expenseMonthlyTrend = Array.from({ length: 12 }, (_, i) => ({
  month: months[i],
  amount: 2_500_000 + Math.round(Math.random() * 1_500_000),
}));

const recentExpenses = mockExpenses.slice(0, 5).map((e) => ({
  id: e.id,
  reference: e.reference,
  date: e.date,
  amount: e.amount,
  categoryName: e.categoryName,
  status: e.status,
  beneficiary: e.beneficiary,
}));

const budgetCategories = [
  {
    categoryId: 'cat1',
    categoryName: 'Fournitures',
    allocated: 1_200_000,
    consumed: 980_000,
    percent: 81.7,
  },
  {
    categoryId: 'cat2',
    categoryName: 'Loyer',
    allocated: 800_000,
    consumed: 750_000,
    percent: 93.8,
  },
  {
    categoryId: 'cat3',
    categoryName: 'Salaires',
    allocated: 2_000_000,
    consumed: 1_450_000,
    percent: 72.5,
  },
  {
    categoryId: 'cat4',
    categoryName: 'Transport',
    allocated: 400_000,
    consumed: 320_000,
    percent: 80,
  },
  {
    categoryId: 'cat5',
    categoryName: 'Marketing',
    allocated: 500_000,
    consumed: 210_000,
    percent: 42,
  },
];

const salesDashKpis = {
  todayRevenue: 1_840_000,
  monthRevenue: 5_640_000,
  todaySalesCount: 12,
  collectionRate: 87.3,
  todayRevenueTrend: 15.2,
  monthRevenueTrend: 12.7,
  salesCountTrend: 8.0,
  collectionRateTrend: 2.1,
};

const salesMonthlyTrend = Array.from({ length: 12 }, (_, i) => ({
  month: months[i],
  amount: 3_500_000 + Math.round(Math.random() * 3_000_000),
}));

const adminDashKpis = {
  totalUsers: mockUsers.length,
  activeUsers: mockUsers.filter((u) => u.isActive).length,
  totalRoles: mockRoles.length,
  auditEventsToday: 8,
};

const roleDistribution = mockRoles.map((r) => ({ name: r.name, count: r.usersCount }));

const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}h`,
  events: i >= 8 && i <= 18 ? 2 + Math.round(Math.random() * 8) : Math.round(Math.random() * 2),
}));

// ── Per-user cash day state ──────────────────────────────
type CashMovementRow = {
  id: string;
  cashDayId: string;
  cashDayRef: string;
  time: string;
  type: 'ENTRY' | 'EXIT';
  category: 'SALE' | 'EXPENSE' | 'PAYMENT' | 'ADJUSTMENT' | 'OTHER';
  reference: string;
  description: string;
  amount: number;
};
interface UserCashDay {
  id: string;
  status: 'OPEN' | 'CLOSED';
  ref: string;
  openingBalance: number;
  openedAt: string;
  openedByName: string;
  movements: CashMovementRow[];
}
const userCashDays = new Map<string, UserCashDay>();

/** Extract user id from Bearer JWT (base64 payload) */
function extractUserId(req: any): string {
  const auth = req.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return '__anon__';
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || '__anon__';
  } catch {
    return '__anon__';
  }
}

function extractUserName(req: any): string {
  const auth = req.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return 'Inconnu';
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.email || 'Inconnu';
  } catch {
    return 'Inconnu';
  }
}

function getUserCashDay(userId: string): UserCashDay {
  if (!userCashDays.has(userId)) {
    userCashDays.set(userId, {
      id: '',
      status: 'CLOSED',
      ref: '',
      openingBalance: 0,
      openedAt: '',
      openedByName: '',
      movements: [],
    });
  }
  return userCashDays.get(userId)!;
}

const mockCashState = (userId: string) => {
  const day = getUserCashDay(userId);
  const totalEntries = day.movements
    .filter((m) => m.type === 'ENTRY')
    .reduce((s, m) => s + m.amount, 0);
  const totalExits = day.movements
    .filter((m) => m.type === 'EXIT')
    .reduce((s, m) => s + m.amount, 0);
  const theoreticalBalance = day.openingBalance + totalEntries - totalExits;
  return {
    status: day.status,
    cashDayId: day.id || undefined,
    openedAt: day.openedAt || undefined,
    openedBy: day.status === 'OPEN' ? day.openedByName : undefined,
    openingBalance: day.openingBalance,
    theoreticalBalance,
    todaySales: day.movements
      .filter((m) => m.category === 'SALE')
      .reduce((s, m) => s + m.amount, 0),
    todayExpenses: day.movements
      .filter((m) => m.category === 'EXPENSE')
      .reduce((s, m) => s + m.amount, 0),
    todayPaymentsReceived: day.movements
      .filter((m) => m.category === 'PAYMENT')
      .reduce((s, m) => s + m.amount, 0),
    totalEntries,
    totalExits,
    movementsCount: day.movements.length,
    reference: day.ref || undefined,
  };
};

const mockDayOperations: CashMovementRow[] = [];

const mockClosingHistory: Array<{
  id: string;
  date: string;
  reference: string;
  openedBy: string;
  closedBy: string;
  openingBalance: number;
  theoreticalBalance: number;
  actualBalance: number;
  gap: number;
  comment?: string;
  closedAt: string;
  movementsCount: number;
}> = [];

// ── Accounting entries generator ─────────────────────────
function generateAccountingEntries(dateStr: string, ops: typeof mockDayOperations, gap: number) {
  const entries: Array<{
    id: string;
    date: string;
    journalCode: string;
    accountNumber: string;
    accountLabel: string;
    entryType: 'DEBIT' | 'CREDIT';
    debit: number;
    credit: number;
    reference: string;
    label: string;
    operationType: 'SALE' | 'EXPENSE' | 'PAYMENT' | 'CLOSING_GAP';
  }> = [];
  let idx = 0;

  for (const op of ops) {
    if (op.type === 'SALE') {
      // Débit 571 Caisse / Crédit 707 Ventes
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'CA',
        accountNumber: '571000',
        accountLabel: 'Caisse',
        entryType: 'DEBIT',
        debit: op.amount,
        credit: 0,
        reference: op.reference,
        label: op.description,
        operationType: 'SALE',
      });
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'CA',
        accountNumber: '707000',
        accountLabel: 'Ventes de marchandises',
        entryType: 'CREDIT',
        debit: 0,
        credit: op.amount,
        reference: op.reference,
        label: op.description,
        operationType: 'SALE',
      });
    } else if (op.type === 'EXPENSE') {
      // Débit 6xxxxx Charges / Crédit 571 Caisse
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'CA',
        accountNumber: '601000',
        accountLabel: 'Achats & charges',
        entryType: 'DEBIT',
        debit: op.amount,
        credit: 0,
        reference: op.reference,
        label: op.description,
        operationType: 'EXPENSE',
      });
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'CA',
        accountNumber: '571000',
        accountLabel: 'Caisse',
        entryType: 'CREDIT',
        debit: 0,
        credit: op.amount,
        reference: op.reference,
        label: op.description,
        operationType: 'EXPENSE',
      });
    } else if (op.type === 'PAYMENT') {
      // Débit 571 Caisse / Crédit 411 Clients
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'CA',
        accountNumber: '571000',
        accountLabel: 'Caisse',
        entryType: 'DEBIT',
        debit: op.amount,
        credit: 0,
        reference: op.reference,
        label: op.description,
        operationType: 'PAYMENT',
      });
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'CA',
        accountNumber: '411000',
        accountLabel: 'Clients',
        entryType: 'CREDIT',
        debit: 0,
        credit: op.amount,
        reference: op.reference,
        label: op.description,
        operationType: 'PAYMENT',
      });
    }
  }

  // Écriture d'écart de caisse
  if (gap !== 0) {
    if (gap > 0) {
      // Excédent : Débit 571 Caisse / Crédit 758 Produits divers
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'OD',
        accountNumber: '571000',
        accountLabel: 'Caisse',
        entryType: 'DEBIT',
        debit: Math.abs(gap),
        credit: 0,
        reference: 'CLOTURE',
        label: 'Excédent de caisse',
        operationType: 'CLOSING_GAP',
      });
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'OD',
        accountNumber: '758000',
        accountLabel: 'Produits divers de gestion',
        entryType: 'CREDIT',
        debit: 0,
        credit: Math.abs(gap),
        reference: 'CLOTURE',
        label: 'Excédent de caisse',
        operationType: 'CLOSING_GAP',
      });
    } else {
      // Déficit : Débit 658 Charges diverses / Crédit 571 Caisse
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'OD',
        accountNumber: '658000',
        accountLabel: 'Charges diverses de gestion',
        entryType: 'DEBIT',
        debit: Math.abs(gap),
        credit: 0,
        reference: 'CLOTURE',
        label: 'Déficit de caisse',
        operationType: 'CLOSING_GAP',
      });
      entries.push({
        id: `ae-${++idx}`,
        date: dateStr,
        journalCode: 'OD',
        accountNumber: '571000',
        accountLabel: 'Caisse',
        entryType: 'CREDIT',
        debit: 0,
        credit: Math.abs(gap),
        reference: 'CLOTURE',
        label: 'Déficit de caisse',
        operationType: 'CLOSING_GAP',
      });
    }
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return {
    date: dateStr,
    totalDebit,
    totalCredit,
    entriesCount: entries.length,
    isBalanced: Math.abs(totalDebit - totalCredit) < 1,
    entries,
  };
}

// ── Plugin ───────────────────────────────────────────────

export function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const pathname = url.split('?')[0];

        // Only intercept /api paths that would 404
        // Admin module routes now go to real backend via proxy:
        //   /api/auth/* → auth-service:3001
        //   /api/users/* → auth-service:3001
        //   /api/roles/* → auth-service:3001
        //   /api/companies/* → auth-service:3001
        //   /api/admin/* → auth-service:3001 / expense-service:3002
        //   /api/employees/* → hr-service:3006
        if (
          !url.startsWith('/api/dashboard') &&
          !url.startsWith('/api/ai') &&
          !url.startsWith('/api/notifications') &&
          !url.startsWith('/api/reports') &&
          !url.startsWith('/api/report-configs') &&
          !url.startsWith('/api/closing') &&
          !url.startsWith('/api/expenses') &&
          !url.startsWith('/api/sales') &&
          !url.startsWith('/api/clients') &&
          !url.startsWith('/api/products') &&
          !url.startsWith('/api/payments') &&
          !url.startsWith('/api/receivables') &&
          !url.startsWith('/api/disbursement-requests')
        ) {
          return next();
        }

        // ── Let disbursement-requests pass to real backend ──
        if (url.startsWith('/api/disbursement-requests')) {
          return next();
        }

        // ── Dashboard endpoints ────────────────
        if (url === '/api/dashboard/kpis') return json(res, kpis);
        if (url === '/api/dashboard/treasury') return json(res, treasury);
        if (url === '/api/dashboard/monthly-comparison') return json(res, comparison);
        if (url === '/api/dashboard/expense-categories') return json(res, categories);
        if (url === '/api/dashboard/top-clients') return json(res, topClients);

        // ── AI endpoints ───────────────────────
        if (url === '/api/ai/alerts')
          return json(
            res,
            alerts.map((a) => ({
              ...a,
              isRead: a.isRead || readIds.has(a.id),
            })),
          );
        if (url === '/api/ai/forecast/sales') return json(res, forecast);

        // ── Module dashboard endpoints ─────────
        if (url === '/api/dashboard/expense/kpis') return json(res, expenseDashKpis);
        if (url === '/api/dashboard/expense/monthly-trend') return json(res, expenseMonthlyTrend);
        if (url === '/api/dashboard/expense/recent') return json(res, recentExpenses);
        if (url === '/api/dashboard/expense/budget-categories') return json(res, budgetCategories);
        if (url === '/api/dashboard/sales/kpis') return json(res, salesDashKpis);
        if (url === '/api/dashboard/sales/monthly-trend') return json(res, salesMonthlyTrend);
        if (url === '/api/dashboard/admin/kpis') return json(res, adminDashKpis);
        if (url === '/api/dashboard/admin/recent-logs')
          return json(res, mockAuditLogs.slice(0, 10));
        if (url === '/api/dashboard/admin/role-distribution') return json(res, roleDistribution);
        if (url === '/api/dashboard/admin/hourly-activity') return json(res, hourlyActivity);

        // /api/ai/chat → bypassed to real ai-service via Vite proxy

        // ── Notifications endpoints ────────────
        if (url === '/api/notifications/unread-count') {
          const count = notifications.filter((n) => !n.isRead && !readIds.has(n.id)).length;
          return json(res, count);
        }

        if (
          url.startsWith('/api/notifications') &&
          url.includes('/read') &&
          req.method === 'PATCH'
        ) {
          if (url === '/api/notifications/read-all') {
            notifications.forEach((n) => readIds.add(n.id));
          } else {
            const id = url.split('/notifications/')[1]?.split('/read')[0];
            if (id) readIds.add(id);
          }
          return json(res, { success: true });
        }

        if (url.startsWith('/api/notifications') && req.method === 'GET') {
          const urlObj = new URL(url, 'http://localhost');
          const typeFilter = urlObj.searchParams.get('type');
          let filtered = notifications.map((n) => ({
            ...n,
            isRead: n.isRead || readIds.has(n.id),
          }));
          if (typeFilter) filtered = filtered.filter((n) => n.type === typeFilter);
          return json(res, filtered);
        }

        // Fallback for unmatched mock routes
        // ── Auth & MFA endpoints ───────────────
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', async () => {
            const { email, password, mfaCode, mfaToken } = JSON.parse(body);

            // Step 2: MFA verification with temp token
            if (mfaToken) {
              const userId = mockMfaTempTokens[mfaToken];
              if (!userId) return json(res, { message: 'Token MFA expiré' }, 401);
              const user = mockUsers.find((u) => u.id === userId);
              if (!user) return json(res, { message: 'Utilisateur introuvable' }, 401);
              // Accept any 6-digit code in mock mode
              if (!mfaCode || mfaCode.length !== 6)
                return json(res, { message: 'Code MFA invalide' }, 401);
              delete mockMfaTempTokens[mfaToken];
              user.lastLogin = new Date().toISOString();
              return json(res, {
                accessToken: makeMockJwt(user),
                refreshToken: `refresh-${user.id}-${Date.now()}`,
              });
            }

            // Step 1: Email + password
            const user = mockUsers.find(
              (u) => (u.email as string).toLowerCase() === email?.toLowerCase(),
            );
            if (!user || !user.isActive)
              return json(res, { message: 'Email ou mot de passe incorrect' }, 401);

            // If MFA enabled but not configured → user needs to set it up
            if (user.mfaEnabled && !user.mfaConfigured) {
              const setupToken = `setup-${user.id}-${Date.now()}`;
              mockMfaTempTokens[setupToken] = user.id as string;
              // Generate QR data for setup
              const secret = 'JBSWY3DPEHPK3PXP';
              mockMfaSecrets[user.id as string] = secret;
              const otpauthUrl = `otpauth://totp/CaisseFlowPro:${user.email}?secret=${secret}&issuer=CaisseFlowPro`;
              const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
                width: 280,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
              });
              return json(res, { requiresMfaSetup: true, setupToken, secret, qrCodeDataUrl });
            }

            // If MFA enabled and configured → require MFA code
            if (user.mfaEnabled && user.mfaConfigured) {
              const tempToken = `mfa-${user.id}-${Date.now()}`;
              mockMfaTempTokens[tempToken] = user.id as string;
              return json(res, { requiresMfa: true, mfaToken: tempToken });
            }

            // No MFA → return tokens directly
            user.lastLogin = new Date().toISOString();
            json(res, {
              accessToken: makeMockJwt(user),
              refreshToken: `refresh-${user.id}-${Date.now()}`,
            });
          });
          return;
        }

        // ── MFA setup verification at login (unauthenticated) ──
        if (pathname === '/api/auth/mfa/setup-verify' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const { setupToken, code } = JSON.parse(body);
            const userId = mockMfaTempTokens[setupToken];
            if (!userId) return json(res, { message: 'Token de configuration expiré' }, 401);
            if (!code || code.length !== 6) return json(res, { message: 'Code invalide' }, 400);
            const user = mockUsers.find((u) => u.id === userId);
            if (!user) return json(res, { message: 'Utilisateur introuvable' }, 401);
            // Mark MFA as configured
            user.mfaConfigured = true;
            delete mockMfaTempTokens[setupToken];
            delete mockMfaSecrets[userId];
            user.lastLogin = new Date().toISOString();
            json(res, {
              accessToken: makeMockJwt(user),
              refreshToken: `refresh-${user.id}-${Date.now()}`,
            });
          });
          return;
        }

        if (pathname === '/api/auth/refresh' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const rt = parsed.refresh_token || parsed.refreshToken || '';
              const userId = rt.replace(/^refresh-/, '').replace(/-\d+$/, '');
              const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
              if (!user || !user.isActive)
                return json(res, { message: 'Invalid refresh token' }, 401);
              json(res, {
                access_token: makeMockJwt(user),
                refresh_token: `refresh-${user.id}-${Date.now()}`,
                accessToken: makeMockJwt(user),
                refreshToken: `refresh-${user.id}-${Date.now()}`,
              });
            } catch {
              json(res, { message: 'Invalid request' }, 400);
            }
          });
          return;
        }

        if (pathname === '/api/users/me' && req.method === 'GET') {
          const userId = extractUserId(req);
          const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
          return json(res, {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roleName: user.roleName,
            tenantId: 'tenant-1',
            companyIds: user.companyIds || [],
            companyNames: resolveCompanyNames(user.companyIds),
            permissions: [],
            allowedModules: user.allowedModules || [],
            mfaEnabled: user.mfaEnabled,
          });
        }

        if (pathname === '/api/auth/mfa/setup' && req.method === 'POST') {
          const userId = extractUserId(req);
          const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
          const secret = 'JBSWY3DPEHPK3PXP'; // fixed mock TOTP secret
          mockMfaSecrets[userId] = secret;
          const otpauthUrl = `otpauth://totp/CaisseFlowPro:${user.email}?secret=${secret}&issuer=CaisseFlowPro`;
          const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
            width: 280,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
          return json(res, { secret, otpauthUrl, qrCodeDataUrl });
        }

        if (pathname === '/api/auth/mfa/verify' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const { code } = JSON.parse(body);
            if (!code || code.length !== 6) return json(res, { message: 'Code invalide' }, 400);
            const userId = extractUserId(req);
            const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
            if (user) {
              user.mfaEnabled = true;
              user.mfaConfigured = true;
            }
            delete mockMfaSecrets[userId];
            json(res, { enabled: true });
          });
          return;
        }

        if (pathname === '/api/auth/mfa/disable' && req.method === 'POST') {
          const userId = extractUserId(req);
          const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
          if (user) {
            user.mfaEnabled = false;
            user.mfaConfigured = false;
          }
          return json(res, { enabled: false });
        }

        // ── Direct /api/users, /api/roles, /api/companies (used by hooks via proxy) ──
        if (pathname === '/api/users' && req.method === 'GET')
          return json(
            res,
            mockUsers.map((u) => ({ ...u, companyNames: resolveCompanyNames(u.companyIds) })),
          );
        if (pathname === '/api/roles' && req.method === 'GET') return json(res, mockRoles);
        if (pathname === '/api/companies' && req.method === 'GET') {
          return json(res, mockCompanies);
        }
        if (pathname === '/api/companies' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            json(
              res,
              {
                id: `comp-${Date.now()}`,
                tenantId: 'tenant-1',
                ...dto,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              201,
            );
          });
          return;
        }
        if (pathname.match(/^\/api\/companies\/[^/]+\/switch$/) && req.method === 'POST') {
          const companyId = pathname.split('/api/companies/')[1]?.split('/switch')[0];
          const company = mockCompanies.find((c) => c.id === companyId);
          if (!company) return json(res, { message: 'Société introuvable' }, 404);
          return json(res, { success: true, companyId: company.id, companyName: company.name });
        }

        if (pathname.match(/^\/api\/users\/[^/]+$/) && req.method === 'PATCH') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const id = pathname.split('/api/users/')[1];
            const dto = JSON.parse(body);
            const user = mockUsers.find((u) => u.id === id);
            if (user) Object.assign(user, dto);
            json(res, user);
          });
          return;
        }

        // ── Admin endpoints ────────────────────
        if (pathname === '/api/admin/users' && req.method === 'GET')
          return json(
            res,
            mockUsers.map((u) => ({ ...u, companyNames: resolveCompanyNames(u.companyIds) })),
          );
        if (pathname === '/api/admin/users' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const newUser = {
              id: `u${Date.now()}`,
              ...dto,
              isActive: true,
              mfaEnabled: false,
              createdAt: new Date().toISOString(),
            };
            mockUsers.push(newUser);
            json(res, newUser, 201);
          });
          return;
        }
        if (pathname.match(/^\/api\/admin\/users\/[^/]+$/) && req.method === 'PATCH') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const id = url.split('/api/admin/users/')[1];
            const dto = JSON.parse(body);
            const user = mockUsers.find((u) => u.id === id);
            if (user) Object.assign(user, dto);
            json(res, { data: user });
          });
          return;
        }
        if (pathname.match(/^\/api\/admin\/users\/[^/]+\/mfa$/) && req.method === 'PATCH') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const id = url.split('/api/admin/users/')[1]?.split('/mfa')[0];
            const { enabled } = JSON.parse(body);
            const user = mockUsers.find((u) => u.id === id);
            if (user) user.mfaEnabled = enabled;
            json(res, user);
          });
          return;
        }
        if (pathname.match(/^\/api\/admin\/users\/[^/]+$/) && req.method === 'DELETE') {
          const id = url.split('/api/admin/users/')[1];
          const idx = mockUsers.findIndex((u) => u.id === id);
          if (idx >= 0) mockUsers.splice(idx, 1);
          return json(res, { success: true });
        }

        if (pathname === '/api/admin/roles' && req.method === 'GET') return json(res, mockRoles);
        if (pathname === '/api/admin/permissions' && req.method === 'GET')
          return json(res, mockPermissions);
        if (pathname === '/api/admin/roles' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const newRole = { id: `r${Date.now()}`, ...dto, isSystem: false, usersCount: 0 };
            mockRoles.push(newRole);
            json(res, newRole, 201);
          });
          return;
        }
        if (pathname.match(/^\/api\/admin\/roles\/[^/]+$/) && req.method === 'PATCH') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const id = url.split('/api/admin/roles/')[1];
            const dto = JSON.parse(body);
            const role = mockRoles.find((r) => r.id === id);
            if (role) Object.assign(role, dto);
            json(res, role);
          });
          return;
        }
        if (pathname.match(/^\/api\/admin\/roles\/[^/]+$/) && req.method === 'DELETE') {
          const id = url.split('/api/admin/roles/')[1];
          const idx = mockRoles.findIndex((r) => r.id === id);
          if (idx >= 0) mockRoles.splice(idx, 1);
          return json(res, { success: true });
        }

        if (pathname === '/api/admin/settings' && req.method === 'GET')
          return json(res, mockSettings);
        if (pathname === '/api/admin/settings' && req.method === 'PUT') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            Object.assign(mockSettings, dto);
            json(res, mockSettings);
          });
          return;
        }

        if (url.startsWith('/api/admin/audit-logs') && req.method === 'GET')
          return json(res, mockAuditLogs);

        // ── Approval Circuits CRUD ───────────
        if (url === '/api/admin/approval-circuits' && req.method === 'GET')
          return json(res, mockApprovalCircuits);
        if (url === '/api/admin/approval-circuits' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const newCircuit = {
              id: `ac${Date.now()}`,
              name: dto.name,
              minAmount: dto.minAmount ?? 0,
              maxAmount: dto.maxAmount ?? null,
              steps: dto.steps || [],
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            mockApprovalCircuits.push(newCircuit);
            json(res, newCircuit, 201);
          });
          return;
        }
        if (url.match(/^\/api\/admin\/approval-circuits\/[^/]+$/) && req.method === 'PUT') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const id = url.split('/api/admin/approval-circuits/')[1];
            const dto = JSON.parse(body);
            const circuit = mockApprovalCircuits.find((c) => c.id === id);
            if (circuit) {
              Object.assign(circuit, dto, { updatedAt: new Date().toISOString() });
              json(res, circuit);
            } else {
              json(res, { message: 'Not found' }, 404);
            }
          });
          return;
        }
        if (url.match(/^\/api\/admin\/approval-circuits\/[^/]+$/) && req.method === 'DELETE') {
          const id = url.split('/api/admin/approval-circuits/')[1];
          const idx = mockApprovalCircuits.findIndex((c) => c.id === id);
          if (idx >= 0) mockApprovalCircuits.splice(idx, 1);
          return json(res, { success: true });
        }

        if (url === '/api/admin/categories' && req.method === 'GET')
          return json(res, mockCategories);
        if (url === '/api/admin/categories' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const newCat = {
              id: `cat${Date.now()}`,
              ...dto,
              order: mockCategories.length,
              isActive: true,
            };
            mockCategories.push(newCat);
            json(res, newCat, 201);
          });
          return;
        }
        if (url.match(/^\/api\/admin\/categories\/reorder/) && req.method === 'PATCH') {
          return json(res, { success: true });
        }
        if (url.match(/^\/api\/admin\/categories\/[^/]+$/) && req.method === 'PATCH') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const id = url.split('/api/admin/categories/')[1];
            const dto = JSON.parse(body);
            const cat = mockCategories.find((c) => c.id === id);
            if (cat) Object.assign(cat, dto);
            json(res, cat);
          });
          return;
        }
        if (url.match(/^\/api\/admin\/categories\/[^/]+$/) && req.method === 'DELETE') {
          const id = url.split('/api/admin/categories/')[1];
          const idx = mockCategories.findIndex((c) => c.id === id);
          if (idx >= 0) mockCategories.splice(idx, 1);
          return json(res, { success: true });
        }

        // ── Reports endpoints ──────────────────
        if (url === '/api/reports/generate' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            setTimeout(() => {
              const report = {
                id: `rpt-${Date.now()}`,
                type: dto.type,
                name: `Rapport ${dto.type} — ${dto.dateFrom} à ${dto.dateTo}`,
                dateFrom: dto.dateFrom,
                dateTo: dto.dateTo,
                format: dto.format || 'pdf',
                size: 150_000 + Math.round(Math.random() * 400_000),
                downloadUrl: '#',
                createdAt: new Date().toISOString(),
                createdBy: 'Amadou Diallo',
              };
              mockReportHistory.unshift(report);
              json(res, report);
            }, 1500);
          });
          return;
        }
        if (url === '/api/reports/history' && req.method === 'GET')
          return json(res, mockReportHistory);
        if (url.startsWith('/api/reports/narrative') && req.method === 'GET')
          return json(res, mockNarrativeReport);

        // ── Report design configs (in-memory mock) ─
        if (pathname === '/api/report-configs' && req.method === 'GET') {
          return json(res, mockReportDesignConfigs);
        }
        if (pathname === '/api/report-configs/bulk' && req.method === 'PUT') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const { configs } = JSON.parse(body);
            for (const cfg of configs) {
              const idx = mockReportDesignConfigs.findIndex(
                (c: any) => c.reportId === cfg.reportId,
              );
              const entry = {
                id: idx >= 0 ? mockReportDesignConfigs[idx].id : `rc-${Date.now()}-${cfg.reportId}`,
                tenantId: 'mock-tenant',
                reportId: cfg.reportId,
                reportName: cfg.reportName,
                configJson: cfg.configJson,
                updatedAt: new Date().toISOString(),
                createdAt:
                  idx >= 0 ? mockReportDesignConfigs[idx].createdAt : new Date().toISOString(),
              };
              if (idx >= 0) mockReportDesignConfigs[idx] = entry;
              else mockReportDesignConfigs.push(entry);
            }
            json(res, mockReportDesignConfigs);
          });
          return;
        }
        if (pathname.match(/^\/api\/report-configs\/[^/]+$/) && req.method === 'PUT') {
          const reportId = pathname.split('/api/report-configs/')[1];
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const idx = mockReportDesignConfigs.findIndex((c: any) => c.reportId === reportId);
            const entry = {
              id: idx >= 0 ? mockReportDesignConfigs[idx].id : `rc-${Date.now()}`,
              tenantId: 'mock-tenant',
              reportId,
              reportName: dto.reportName,
              configJson: dto.configJson,
              updatedAt: new Date().toISOString(),
              createdAt:
                idx >= 0 ? mockReportDesignConfigs[idx].createdAt : new Date().toISOString(),
            };
            if (idx >= 0) mockReportDesignConfigs[idx] = entry;
            else mockReportDesignConfigs.push(entry);
            json(res, entry);
          });
          return;
        }
        if (pathname.match(/^\/api\/report-configs\/[^/]+$/) && req.method === 'DELETE') {
          const reportId = pathname.split('/api/report-configs/')[1];
          const idx = mockReportDesignConfigs.findIndex((c: any) => c.reportId === reportId);
          if (idx >= 0) mockReportDesignConfigs.splice(idx, 1);
          return json(res, { success: true });
        }

        // ── Expenses endpoints ─────────────────
        if (url.startsWith('/api/expenses/categories') && req.method === 'GET') {
          return json(res, mockExpenseCategories);
        }
        if (url.startsWith('/api/expenses/budgets/summary') && req.method === 'GET') {
          return json(res, mockBudgetSummary);
        }
        if (url.match(/^\/api\/expenses\/[^/?]+$/) && req.method === 'GET') {
          const id = url.split('/api/expenses/')[1];
          const expense = mockExpenses.find((e) => e.id === id);
          if (expense) return json(res, expense);
          return json(res, { message: 'Not found' }, 404);
        }
        if (url.startsWith('/api/expenses') && req.method === 'GET') {
          const urlObj = new URL(url, 'http://localhost');
          const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
          const perPage = parseInt(urlObj.searchParams.get('perPage') || '10', 10);
          const statusFilter = urlObj.searchParams.get('status');
          const categoryFilter = urlObj.searchParams.get('categoryId');
          const search = urlObj.searchParams.get('search')?.toLowerCase();
          let filtered = [...mockExpenses];
          if (statusFilter) {
            const statuses = statusFilter.split(',');
            filtered = filtered.filter((e) => statuses.includes(e.status));
          }
          if (categoryFilter) filtered = filtered.filter((e) => e.categoryId === categoryFilter);
          if (search)
            filtered = filtered.filter(
              (e) =>
                e.reference.toLowerCase().includes(search) ||
                e.description?.toLowerCase().includes(search) ||
                e.beneficiary?.toLowerCase().includes(search),
            );
          const total = filtered.length;
          const totalPages = Math.ceil(total / perPage);
          const start = (page - 1) * perPage;
          const paged = filtered.slice(start, start + perPage);
          // PaginatedExpenses expects { data, meta } at top level (hook reads `data` directly, not `data.data`)
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              data: paged,
              meta: {
                page,
                perPage,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            }),
          );
          return;
        }
        if (url === '/api/expenses' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const userId = extractUserId(req);
            const day = getUserCashDay(userId);
            const cat = mockExpenseCategories.find((c) => c.id === dto.categoryId);
            const amount = dto.amount || 0;
            const isDraft = !!dto.isDraft;
            // Enforce max disbursement limit
            if (
              !isDraft &&
              mockSettings.validation.maxDisbursementAmount > 0 &&
              amount > mockSettings.validation.maxDisbursementAmount
            ) {
              res.statusCode = 400;
              return json(
                res,
                {
                  message: `Le montant (${amount.toLocaleString('fr-FR')} FCFA) dépasse la limite autorisée de ${mockSettings.validation.maxDisbursementAmount.toLocaleString('fr-FR')} FCFA`,
                },
                400,
              );
            }
            // Auto-detect approval circuit by amount threshold
            const circuit = !isDraft ? findApprovalCircuit(amount) : undefined;
            const approvals = circuit ? generateApprovals(circuit) : [];
            const newExp = {
              id: `e${Date.now()}`,
              reference: `DEP-2026-${String(400 + mockExpenses.length).padStart(4, '0')}`,
              date: dto.date,
              amount,
              description: dto.description || null,
              beneficiary: dto.beneficiary || null,
              paymentMethod: dto.paymentMethod,
              status: isDraft ? ('DRAFT' as const) : ('PENDING' as const),
              observations: dto.observations || null,
              categoryId: dto.categoryId,
              categoryName: cat?.name || 'Inconnu',
              subCategoryId: null,
              subCategoryName: null,
              createdById: userId,
              createdByName: extractUserName(req),
              cashDayId: day.status === 'OPEN' ? day.id : null,
              cashDayRef: day.status === 'OPEN' ? day.ref : null,
              approvalCircuitId: circuit?.id || null,
              approvalCircuitName: circuit?.name || null,
              costCenterId: null,
              projectId: null,
              approvals,
              attachments: [],
              aiCategoryConfidence: null,
              aiAnomalyScore: null,
              aiAnomalyReasons: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            mockExpenses.unshift(newExp);
            json(res, newExp, 201);
          });
          return;
        }

        // ── Expense approve endpoint ─────────
        if (url.match(/^\/api\/expenses\/[^/?]+\/approve$/) && req.method === 'POST') {
          const id = url.split('/api/expenses/')[1]?.split('/approve')[0];
          const expense = mockExpenses.find((e) => e.id === id);
          if (!expense) return json(res, { message: 'Not found' }, 404);
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = body ? JSON.parse(body) : {};
            const nextPending = expense.approvals?.find((a: any) => a.status === 'PENDING');
            if (nextPending) {
              nextPending.status = 'APPROVED';
              nextPending.approvedAt = new Date().toISOString();
              if (dto.comment) nextPending.comment = dto.comment;
            }
            // If all approvals are now APPROVED, mark expense as APPROVED
            const allApproved = expense.approvals?.every((a: any) => a.status === 'APPROVED');
            if (allApproved) expense.status = 'APPROVED';
            expense.updatedAt = new Date().toISOString();
            json(res, expense);
          });
          return;
        }

        // ── Expense reject endpoint ──────────
        if (url.match(/^\/api\/expenses\/[^/?]+\/reject$/) && req.method === 'POST') {
          const id = url.split('/api/expenses/')[1]?.split('/reject')[0];
          const expense = mockExpenses.find((e) => e.id === id);
          if (!expense) return json(res, { message: 'Not found' }, 404);
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = body ? JSON.parse(body) : {};
            const nextPending = expense.approvals?.find((a: any) => a.status === 'PENDING');
            if (nextPending) {
              nextPending.status = 'REJECTED';
              nextPending.approvedAt = new Date().toISOString();
              if (dto.comment) nextPending.comment = dto.comment;
            }
            expense.status = 'REJECTED';
            expense.updatedAt = new Date().toISOString();
            json(res, expense);
          });
          return;
        }

        // ── Expense pay endpoint ─────────────
        if (url.match(/^\/api\/expenses\/[^/?]+\/pay$/) && req.method === 'POST') {
          const id = url.split('/api/expenses/')[1]?.split('/pay')[0];
          const expense = mockExpenses.find((e) => e.id === id);
          if (!expense) return json(res, { message: 'Not found' }, 404);
          expense.status = 'PAID';
          expense.updatedAt = new Date().toISOString();
          // Create cash movement (EXIT/EXPENSE) on the payer's open cash day
          const payerUserId = extractUserId(req);
          const day = getUserCashDay(payerUserId);
          if (day.status === 'OPEN') {
            const now = new Date();
            day.movements.push({
              id: `mv-${Date.now()}`,
              cashDayId: day.id,
              cashDayRef: day.ref,
              time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
              type: 'EXIT',
              category: 'EXPENSE',
              reference: expense.reference,
              description: `Dépense: ${expense.description || expense.categoryName || 'Dépense'}`,
              amount: expense.amount,
            });
            // Link expense to current cash day
            expense.cashDayId = day.id;
            expense.cashDayRef = day.ref;
          }
          return json(res, expense);
        }

        // ── Sales endpoints ─────────────────
        if (url === '/api/sales/kpis' && req.method === 'GET') return json(res, mockSaleKpis);
        if (url === '/api/sales/export' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/csv');
          res.end(
            'reference,date,client,total,status\n' +
              mockSales
                .slice(0, 10)
                .map((s) => `${s.reference},${s.date},${s.clientName},${s.total},${s.status}`)
                .join('\n'),
          );
          return;
        }
        if (url.match(/^\/api\/sales\/[^/?]+\/cancel$/) && req.method === 'POST') {
          const id = url.split('/api/sales/')[1]?.split('/cancel')[0];
          const sale = mockSales.find((s) => s.id === id);
          if (sale) (sale as any).status = 'CANCELLED';
          return json(res, { success: true });
        }
        if (url.match(/^\/api\/sales\/[^/?]+$/) && req.method === 'GET') {
          const id = url.split('/api/sales/')[1];
          const sale = mockSales.find((s) => s.id === id);
          if (sale) return json(res, sale);
          return json(res, { message: 'Not found' }, 404);
        }
        if (url === '/api/sales' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const newSale = {
              id: `s${Date.now()}`,
              reference: `VNT-2026-${String(200 + mockSales.length).padStart(4, '0')}`,
              date: dto.date,
              clientId: dto.clientId || null,
              clientName: dto.clientId
                ? mockClients.find((c) => c.id === dto.clientId)?.name || null
                : null,
              subtotal: 0,
              taxAmount: 0,
              discountAmount: 0,
              total: 0,
              status: 'DRAFT' as const,
              sellerId: 'u1',
              sellerName: 'Amadou Diallo',
              items: [],
              payments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            mockSales.unshift(newSale);
            json(res, newSale, 201);
          });
          return;
        }
        if (url.startsWith('/api/sales') && req.method === 'GET') {
          const urlObj = new URL(url, 'http://localhost');
          const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
          const perPage = parseInt(urlObj.searchParams.get('perPage') || '10', 10);
          const statusFilter = urlObj.searchParams.get('status');
          const search = urlObj.searchParams.get('search')?.toLowerCase();
          let filtered = [...mockSales];
          if (statusFilter) {
            const ss = statusFilter.split(',');
            filtered = filtered.filter((s) => ss.includes(s.status));
          }
          if (search)
            filtered = filtered.filter(
              (s) =>
                s.reference.toLowerCase().includes(search) ||
                s.clientName?.toLowerCase().includes(search),
            );
          const total = filtered.length;
          const totalPages = Math.ceil(total / perPage);
          const start = (page - 1) * perPage;
          const paged = filtered.slice(start, start + perPage);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              data: paged,
              meta: {
                page,
                perPage,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            }),
          );
          return;
        }

        // ── Clients endpoints ──────────────────
        if (url.startsWith('/api/clients/search') && req.method === 'GET') {
          const urlObj = new URL(url, 'http://localhost');
          const q = (urlObj.searchParams.get('q') || '').toLowerCase();
          const results = mockClients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
          return json(res, results);
        }
        if (url.match(/^\/api\/clients\/[^/?]+$/) && req.method === 'GET') {
          const id = url.split('/api/clients/')[1];
          const client = mockClients.find((c) => c.id === id);
          if (client)
            return json(res, {
              ...client,
              purchaseHistory: mockSales.filter((s) => s.clientId === id).slice(0, 5),
              paymentHistory: [],
            });
          return json(res, { message: 'Not found' }, 404);
        }
        if (url === '/api/clients' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const newClient = {
              id: `c${Date.now()}`,
              ...dto,
              score: 70,
              riskClass: 'B',
              isActive: true,
              totalPurchases: 0,
              outstandingBalance: 0,
              createdAt: new Date().toISOString(),
            };
            mockClients.push(newClient);
            json(res, newClient, 201);
          });
          return;
        }
        if (url.startsWith('/api/clients') && req.method === 'GET') {
          const urlObj = new URL(url, 'http://localhost');
          const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
          const perPage = parseInt(urlObj.searchParams.get('perPage') || '10', 10);
          const search = urlObj.searchParams.get('search')?.toLowerCase();
          let filtered = [...mockClients];
          if (search) filtered = filtered.filter((c) => c.name.toLowerCase().includes(search));
          const total = filtered.length;
          const totalPages = Math.ceil(total / perPage);
          const start = (page - 1) * perPage;
          const paged = filtered.slice(start, start + perPage);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              data: paged,
              meta: {
                page,
                perPage,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            }),
          );
          return;
        }

        // ── Products endpoints ─────────────────
        if (url.startsWith('/api/products/search') && req.method === 'GET') {
          const urlObj = new URL(url, 'http://localhost');
          const q = (urlObj.searchParams.get('q') || '').toLowerCase();
          const results = mockProducts.filter(
            (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
          );
          return json(res, results);
        }

        // ── Payments endpoints ─────────────────
        if (url === '/api/payments' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const payment = {
              id: `pay-${Date.now()}`,
              saleId: dto.saleId,
              amount: dto.amount,
              method: dto.method,
              reference: dto.reference || null,
              date: dto.date,
              receivedById: 'u1',
              receivedByName: 'Amadou Diallo',
              createdAt: new Date().toISOString(),
            };
            json(res, payment, 201);
          });
          return;
        }

        // ── Receivables endpoints ──────────────
        if (url === '/api/receivables/aging' && req.method === 'GET')
          return json(res, mockAgingSummary);
        if (url.match(/^\/api\/receivables\/[^/?]+\/remind$/) && req.method === 'POST')
          return json(res, { success: true });
        if (url.startsWith('/api/receivables') && req.method === 'GET') {
          const urlObj = new URL(url, 'http://localhost');
          const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
          const perPage = parseInt(urlObj.searchParams.get('perPage') || '10', 10);
          const search = urlObj.searchParams.get('search')?.toLowerCase();
          let filtered = [...mockReceivables];
          if (search)
            filtered = filtered.filter(
              (r) =>
                r.clientName.toLowerCase().includes(search) ||
                r.saleReference.toLowerCase().includes(search),
            );
          const total = filtered.length;
          const totalPages = Math.ceil(total / perPage);
          const start = (page - 1) * perPage;
          const paged = filtered.slice(start, start + perPage);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              data: paged,
              meta: {
                page,
                perPage,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            }),
          );
          return;
        }

        // ── AI client score ────────────────────
        if (url.match(/^\/api\/ai\/clients\/[^/]+\/score$/) && req.method === 'GET') {
          return json(res, {
            score: 75,
            riskClass: 'B',
            creditRecommendation: 2_000_000,
            reasons: [
              'Historique de paiement régulier',
              "Volume d'achats croissant",
              'Légère exposition au risque sectoriel',
            ],
          });
        }

        // ── Closing endpoints ──────────────────
        if (url === '/api/closing/state' && req.method === 'GET') {
          const userId = extractUserId(req);
          return json(res, mockCashState(userId));
        }
        if (url === '/api/closing/operations' && req.method === 'GET') {
          const userId = extractUserId(req);
          const day = getUserCashDay(userId);
          return json(res, day.movements);
        }
        if (url === '/api/closing/open' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const userId = extractUserId(req);
            const userName = extractUserName(req);
            const year = new Date().getFullYear();
            const seq = mockClosingHistory.length + 1;
            const day = getUserCashDay(userId);
            day.id = `cd-${Date.now()}`;
            day.ref = `JC-${year}-${String(seq).padStart(5, '0')}`;
            day.openingBalance = dto.openingBalance || 0;
            day.openedAt = new Date().toISOString();
            day.openedByName = userName;
            day.movements.length = 0;
            day.status = 'OPEN';
            json(res, mockCashState(userId));
          });
          return;
        }
        if (url === '/api/closing/close' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const userId = extractUserId(req);
            const day = getUserCashDay(userId);
            day.status = 'CLOSED';
            const state = mockCashState(userId);
            const record = {
              id: `cl-${Date.now()}`,
              date: day.openedAt,
              reference: day.ref,
              openedBy: day.openedByName,
              closedBy: extractUserName(req),
              openingBalance: day.openingBalance,
              theoreticalBalance: state.theoreticalBalance,
              actualBalance: dto.actualBalance,
              gap: dto.actualBalance - state.theoreticalBalance,
              comment: dto.comment,
              closedAt: new Date().toISOString(),
              movementsCount: day.movements.length,
            };
            mockClosingHistory.unshift(record);
            day.movements.length = 0;
            day.id = '';
            day.ref = '';
            day.openingBalance = 0;
            day.openedAt = '';
            day.openedByName = '';
            json(res, record);
          });
          return;
        }
        if (url === '/api/closing/movements' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const userId = extractUserId(req);
            const day = getUserCashDay(userId);
            if (day.status !== 'OPEN') {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(
                JSON.stringify({
                  message: 'La caisse doit être ouverte pour enregistrer un mouvement',
                }),
              );
            }
            const now = new Date();
            const movement: CashMovementRow = {
              id: `mv-${Date.now()}`,
              cashDayId: day.id,
              cashDayRef: day.ref,
              time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
              type: dto.type as 'ENTRY' | 'EXIT',
              category: dto.category as 'SALE' | 'EXPENSE' | 'PAYMENT' | 'ADJUSTMENT' | 'OTHER',
              reference: dto.reference || null,
              description: dto.description,
              amount: dto.amount,
            };
            day.movements.push(movement);
            json(res, movement, 201);
          });
          return;
        }
        // ── Employee endpoints (salariés) ──────
        if (pathname === '/api/employees' && req.method === 'GET')
          return json(
            res,
            mockEmployees.filter((e) => e.isActive !== false || url.includes('all=true')),
          );
        if (pathname === '/api/employees/all' && req.method === 'GET')
          return json(res, mockEmployees);
        if (pathname === '/api/employees/login' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const { matricule, email } = JSON.parse(body);
            const emp = mockEmployees.find(
              (e) =>
                (e.matricule as string).toLowerCase() === matricule?.toLowerCase() &&
                (e.email as string).toLowerCase() === email?.toLowerCase() &&
                e.isActive === true,
            );
            if (!emp) {
              res.statusCode = 401;
              return json(res, { message: 'Matricule ou email incorrect, ou compte désactivé' });
            }
            json(res, emp);
          });
          return;
        }
        if (pathname === '/api/employees' && req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const dto = JSON.parse(body);
            const newEmp = {
              id: `emp-${Date.now()}`,
              ...dto,
              isActive: true,
              createdAt: new Date().toISOString(),
            };
            mockEmployees.push(newEmp);
            json(res, newEmp, 201);
          });
          return;
        }
        if (pathname.match(/^\/api\/employees\/[^/]+$/) && req.method === 'PATCH') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c.toString();
          });
          req.on('end', () => {
            const id = pathname.split('/api/employees/')[1];
            const dto = JSON.parse(body);
            const emp = mockEmployees.find((e) => e.id === id);
            if (emp) Object.assign(emp, dto);
            json(res, emp);
          });
          return;
        }
        if (pathname.match(/^\/api\/employees\/[^/]+$/) && req.method === 'DELETE') {
          const id = pathname.split('/api/employees/')[1];
          const idx = mockEmployees.findIndex((e) => e.id === id);
          if (idx >= 0) mockEmployees.splice(idx, 1);
          return json(res, { success: true });
        }

        if (url === '/api/closing/history' && req.method === 'GET')
          return json(res, mockClosingHistory);

        if (url === '/api/closing/accounting-entries' && req.method === 'GET') {
          const userId = extractUserId(req);
          const today = new Date().toISOString().slice(0, 10);
          const gap =
            mockCashState(userId).theoreticalBalance -
            mockCashState(userId).theoreticalBalance +
            15_000; // simulate small gap
          return json(res, generateAccountingEntries(today, mockDayOperations, gap));
        }

        next();
      });
    },
  };
}
