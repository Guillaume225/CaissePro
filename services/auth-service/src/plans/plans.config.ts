export type PlanCode = 'STARTER' | 'BUSINESS' | 'PRO' | 'ENTERPRISE';
export type AiLevel = 'none' | 'light' | 'advanced' | 'full';

export interface PlanLimits {
  maxUsers: number | null;
  maxCompanies: number | null;
  maxCaisses: number | null;
  transactionsLimit: number | null;
}

export interface PlanFeatures {
  caisse: boolean;
  depenses: boolean;
  fermeture_caisse: boolean;
  etats_journaliers: boolean;
  dashboard: boolean;
  notifications: boolean;
  validation_simple: boolean;
  multi_validation: boolean;
  accounting: boolean;
  export_sage: boolean;
  fne: boolean;
  ai_ocr: boolean;
  ai_anomaly: boolean;
  ai_prediction: boolean;
  ai_full: boolean;
  api_access: boolean;
  webhooks: boolean;
  audit_advanced: boolean;
}

export interface PlanDefinition {
  code: PlanCode;
  displayName: string;
  aiLevel: AiLevel;
  limits: PlanLimits;
  features: PlanFeatures;
}

export const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  STARTER: {
    code: 'STARTER',
    displayName: 'Starter',
    aiLevel: 'none',
    limits: {
      maxUsers: 2,
      maxCompanies: 1,
      maxCaisses: 1,
      transactionsLimit: 100,
    },
    features: {
      caisse: true,
      depenses: true,
      fermeture_caisse: true,
      etats_journaliers: true,
      dashboard: false,
      notifications: false,
      validation_simple: false,
      multi_validation: false,
      accounting: false,
      export_sage: false,
      fne: false,
      ai_ocr: false,
      ai_anomaly: false,
      ai_prediction: false,
      ai_full: false,
      api_access: false,
      webhooks: false,
      audit_advanced: false,
    },
  },

  BUSINESS: {
    code: 'BUSINESS',
    displayName: 'Business',
    aiLevel: 'light',
    limits: {
      maxUsers: 5,
      maxCompanies: 2,
      maxCaisses: 3,
      transactionsLimit: null,
    },
    features: {
      caisse: true,
      depenses: true,
      fermeture_caisse: true,
      etats_journaliers: true,
      dashboard: true,
      notifications: true,
      validation_simple: true,
      multi_validation: false,
      accounting: false,
      export_sage: false,
      fne: false,
      ai_ocr: true,
      ai_anomaly: false,
      ai_prediction: false,
      ai_full: false,
      api_access: false,
      webhooks: false,
      audit_advanced: false,
    },
  },

  PRO: {
    code: 'PRO',
    displayName: 'Pro',
    aiLevel: 'advanced',
    limits: {
      maxUsers: 15,
      maxCompanies: 5,
      maxCaisses: null,
      transactionsLimit: null,
    },
    features: {
      caisse: true,
      depenses: true,
      fermeture_caisse: true,
      etats_journaliers: true,
      dashboard: true,
      notifications: true,
      validation_simple: true,
      multi_validation: true,
      accounting: true,
      export_sage: true,
      fne: true,
      ai_ocr: true,
      ai_anomaly: true,
      ai_prediction: true,
      ai_full: false,
      api_access: false,
      webhooks: false,
      audit_advanced: false,
    },
  },

  ENTERPRISE: {
    code: 'ENTERPRISE',
    displayName: 'Enterprise',
    aiLevel: 'full',
    limits: {
      maxUsers: null,
      maxCompanies: null,
      maxCaisses: null,
      transactionsLimit: null,
    },
    features: {
      caisse: true,
      depenses: true,
      fermeture_caisse: true,
      etats_journaliers: true,
      dashboard: true,
      notifications: true,
      validation_simple: true,
      multi_validation: true,
      accounting: true,
      export_sage: true,
      fne: true,
      ai_ocr: true,
      ai_anomaly: true,
      ai_prediction: true,
      ai_full: true,
      api_access: true,
      webhooks: true,
      audit_advanced: true,
    },
  },
};

/**
 * Derives the list of frontend module IDs the admin user should have access to
 * based on the features included in their plan.
 *
 * Frontend ModuleId: 'admin' | 'expense' | 'manager-caisse' | 'fne' | 'decision'
 */
export function getModulesForPlan(planCode: PlanCode): string[] {
  const { features } = PLAN_DEFINITIONS[planCode];
  const modules: string[] = ['admin']; // admin module always granted to the provisioned admin

  if (features.depenses || features.caisse) {
    modules.push('expense');
  }
  if (features.caisse || features.fermeture_caisse) {
    modules.push('manager-caisse');
  }
  if (features.fne) {
    modules.push('fne');
  }
  if (features.dashboard || features.multi_validation || features.accounting) {
    modules.push('decision');
  }

  return modules;
}
