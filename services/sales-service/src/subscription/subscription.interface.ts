export type PlanCode = 'STARTER' | 'BUSINESS' | 'PRO' | 'ENTERPRISE';
export type AiLevel = 'none' | 'light' | 'advanced' | 'full';

export interface SubscriptionPlan {
  code: PlanCode;
  displayName: string;
  aiLevel: AiLevel;
  limits: {
    maxUsers: number | null;
    maxCompanies: number | null;
    maxCaisses: number | null;
    transactionsLimit: number | null;
  };
  features: {
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
    [key: string]: boolean;
  };
}
