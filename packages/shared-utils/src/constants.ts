/* ═══════════════════════════════════════════
 *  Constants métier CaisseFlow Pro
 * ═══════════════════════════════════════════ */

/** Taux TVA Côte d'Ivoire */
export const TVA_RATE_CI = 18;

/** Seuils d'alerte budgétaire par défaut (%) */
export const BUDGET_ALERT_THRESHOLDS = [50, 75, 90, 100] as const;

/** Délai d'approbation max (jours ouvrables) */
export const APPROVAL_DEADLINE_DAYS = 5;

/** Délai de justification d'avance par défaut (jours) */
export const ADVANCE_JUSTIFICATION_DAYS = 30;

/** Délais aging buckets (jours) */
export const AGING_BRACKETS = {
  CURRENT: { min: 0, max: 29 },
  DAYS_30: { min: 30, max: 59 },
  DAYS_60: { min: 60, max: 89 },
  DAYS_90: { min: 90, max: 119 },
  OVERDUE: { min: 120, max: Infinity },
} as const;

/** Nombre max de lignes par export CSV/Excel */
export const MAX_EXPORT_ROWS = 10_000;

/** Pagination par défaut */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;

/** Limite de crédit par défaut pour un nouveau client */
export const DEFAULT_CREDIT_LIMIT = 0;

/** Score client par défaut */
export const DEFAULT_CLIENT_SCORE = 50;

/** Devise par défaut */
export const DEFAULT_CURRENCY = 'XOF';

/** Locale par défaut */
export const DEFAULT_LOCALE = 'fr-FR';

/** Préfixes de référence */
export const REF_PREFIX_EXPENSE = 'DEP';
export const REF_PREFIX_SALE = 'VTE';

/** Format téléphone CI */
export const CI_PHONE_REGEX = /^\+225\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/;

/** Format RCCM (Registre du Commerce et du Crédit Mobilier) CI */
export const CI_RCCM_REGEX = /^CI-[A-Z]{3}-\d{4}-[A-Z]-\d{5}$/;

/** Jours fériés fixes en Côte d'Ivoire (mois/jour) */
export const CI_FIXED_HOLIDAYS: ReadonlyArray<[number, number]> = [
  [1, 1],   // Jour de l'An
  [5, 1],   // Fête du Travail
  [8, 7],   // Fête de l'Indépendance
  [8, 15],  // Assomption
  [11, 1],  // Toussaint
  [11, 15], // Journée nationale de la Paix
  [12, 25], // Noël
];
