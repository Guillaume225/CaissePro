export const PERMISSIONS = {
  // Expense
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_READ: 'expense.read',
  EXPENSE_UPDATE: 'expense.update',
  EXPENSE_DELETE: 'expense.delete',
  EXPENSE_APPROVE_L1: 'expense.approve_l1',
  EXPENSE_APPROVE_L2: 'expense.approve_l2',
  EXPENSE_PAY: 'expense.pay',
  EXPENSE_CANCEL: 'expense.cancel',
  EXPENSE_EXPORT: 'expense.export',

  // Sale
  SALE_CREATE: 'sale.create',
  SALE_READ: 'sale.read',
  SALE_UPDATE: 'sale.update',
  SALE_DELETE: 'sale.delete',
  SALE_EXPORT: 'sale.export',

  // Payment
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_READ: 'payment.read',

  // Client
  CLIENT_CREATE: 'client.create',
  CLIENT_READ: 'client.read',
  CLIENT_UPDATE: 'client.update',
  CLIENT_DELETE: 'client.delete',

  // Product
  PRODUCT_CREATE: 'product.create',
  PRODUCT_READ: 'product.read',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',

  // Budget
  BUDGET_CREATE: 'budget.create',
  BUDGET_READ: 'budget.read',
  BUDGET_UPDATE: 'budget.update',

  // User Management
  USER_CREATE: 'user.create',
  USER_READ: 'user.read',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',

  // Role Management
  ROLE_CREATE: 'role.create',
  ROLE_READ: 'role.read',
  ROLE_UPDATE: 'role.update',

  // Audit
  AUDIT_READ: 'audit.read',

  // Report
  REPORT_READ: 'report.read',
  REPORT_EXPORT: 'report.export',

  // Dashboard
  DASHBOARD_READ: 'dashboard.read',

  // Cash Closing
  CASH_CLOSING_CREATE: 'cash_closing.create',
  CASH_CLOSING_READ: 'cash_closing.read',
  CASH_CLOSING_VALIDATE: 'cash_closing.validate',

  // Company Management
  COMPANY_CREATE: 'company.create',
  COMPANY_READ: 'company.read',
  COMPANY_UPDATE: 'company.update',

  // FNE (Facturation Normalisée Électronique)
  FNE_CREATE: 'fne.create',
  FNE_READ: 'fne.read',
  FNE_UPDATE: 'fne.update',
  FNE_CREDIT_NOTE: 'fne.credit_note',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Labels and module groups for the frontend permissions grid
const PERMISSION_MODULE_MAP: Record<string, string> = {
  expense: 'expenses',
  sale: 'sales',
  payment: 'sales',
  client: 'sales',
  product: 'sales',
  fne: 'fne',
  budget: 'expenses',
  cash_closing: 'closing',
  user: 'admin',
  role: 'admin',
  audit: 'admin',
  company: 'admin',
  report: 'reports',
  dashboard: 'dashboard',
};

const PERMISSION_LABELS: Record<string, string> = {
  'expense.create': 'Créer des dépenses',
  'expense.read': 'Lire les dépenses',
  'expense.update': 'Modifier les dépenses',
  'expense.delete': 'Supprimer les dépenses',
  'expense.approve_l1': 'Approuver niveau 1',
  'expense.approve_l2': 'Approuver niveau 2',
  'expense.pay': 'Payer les dépenses',
  'expense.cancel': 'Annuler les dépenses',
  'expense.export': 'Exporter les dépenses',
  'sale.create': 'Créer des ventes',
  'sale.read': 'Lire les ventes',
  'sale.update': 'Modifier les ventes',
  'sale.delete': 'Supprimer les ventes',
  'sale.export': 'Exporter les ventes',
  'payment.create': 'Créer des paiements',
  'payment.read': 'Lire les paiements',
  'client.create': 'Créer des clients',
  'client.read': 'Lire les clients',
  'client.update': 'Modifier les clients',
  'client.delete': 'Supprimer les clients',
  'product.create': 'Créer des produits',
  'product.read': 'Lire les produits',
  'product.update': 'Modifier les produits',
  'product.delete': 'Supprimer les produits',
  'budget.create': 'Créer des budgets',
  'budget.read': 'Lire les budgets',
  'budget.update': 'Modifier les budgets',
  'user.create': 'Créer des utilisateurs',
  'user.read': 'Lire les utilisateurs',
  'user.update': 'Modifier les utilisateurs',
  'user.delete': 'Supprimer les utilisateurs',
  'role.create': 'Créer des rôles',
  'role.read': 'Lire les rôles',
  'role.update': 'Modifier les rôles',
  'audit.read': 'Consulter les logs d\'audit',
  'report.read': 'Consulter les rapports',
  'report.export': 'Exporter les rapports',
  'dashboard.read': 'Voir le tableau de bord',
  'cash_closing.create': 'Ouvrir/clôturer la caisse',
  'cash_closing.read': 'Voir l\'état de caisse',
  'cash_closing.validate': 'Valider la clôture',
  'company.create': 'Créer des sociétés',
  'company.read': 'Consulter les sociétés',
  'company.update': 'Modifier les sociétés',
  'fne.create': 'Créer des factures FNE',
  'fne.read': 'Consulter les factures FNE',
  'fne.update': 'Modifier les factures FNE',
  'fne.credit_note': 'Émettre des avoirs FNE',
};

export function getPermissionsMeta(): { key: string; label: string; module: string }[] {
  return ALL_PERMISSIONS.map((perm) => {
    const [prefix] = perm.split('.');
    return {
      key: perm,
      label: PERMISSION_LABELS[perm] || perm,
      module: PERMISSION_MODULE_MAP[prefix] || prefix,
    };
  });
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [...ALL_PERMISSIONS],

  DAF: [
    PERMISSIONS.EXPENSE_READ, PERMISSIONS.EXPENSE_APPROVE_L2, PERMISSIONS.EXPENSE_PAY, PERMISSIONS.EXPENSE_CANCEL, PERMISSIONS.EXPENSE_EXPORT,
    PERMISSIONS.SALE_READ, PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.BUDGET_CREATE, PERMISSIONS.BUDGET_READ, PERMISSIONS.BUDGET_UPDATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.CASH_CLOSING_READ, PERMISSIONS.CASH_CLOSING_VALIDATE,
  ],

  CAISSIER_DEPENSES: [
    PERMISSIONS.EXPENSE_CREATE, PERMISSIONS.EXPENSE_READ, PERMISSIONS.EXPENSE_UPDATE,
    PERMISSIONS.EXPENSE_APPROVE_L1, PERMISSIONS.EXPENSE_PAY, PERMISSIONS.EXPENSE_CANCEL,
    PERMISSIONS.BUDGET_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.CASH_CLOSING_CREATE, PERMISSIONS.CASH_CLOSING_READ,
  ],

  CAISSIER_VENTE: [
    PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_READ, PERMISSIONS.SALE_UPDATE,
    PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.CLIENT_CREATE, PERMISSIONS.CLIENT_READ, PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.CASH_CLOSING_CREATE, PERMISSIONS.CASH_CLOSING_READ,
  ],

  COMMERCIAL: [
    PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_READ,
    PERMISSIONS.CLIENT_CREATE, PERMISSIONS.CLIENT_READ, PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.DASHBOARD_READ,
  ],

  COMPTABLE: [
    PERMISSIONS.EXPENSE_READ, PERMISSIONS.EXPENSE_EXPORT,
    PERMISSIONS.SALE_READ, PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.BUDGET_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.CASH_CLOSING_READ, PERMISSIONS.CASH_CLOSING_VALIDATE,
  ],

  AUDITEUR: [
    PERMISSIONS.EXPENSE_READ, PERMISSIONS.EXPENSE_EXPORT,
    PERMISSIONS.SALE_READ, PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.BUDGET_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.CASH_CLOSING_READ,
  ],

  FACTURIER_FNE: [
    PERMISSIONS.FNE_CREATE, PERMISSIONS.FNE_READ, PERMISSIONS.FNE_UPDATE, PERMISSIONS.FNE_CREDIT_NOTE,
    PERMISSIONS.CLIENT_CREATE, PERMISSIONS.CLIENT_READ, PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.COMPANY_READ,
  ],
};
