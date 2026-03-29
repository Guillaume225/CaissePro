/* ═══════════════════════════════════════════
 *  Générateur de références
 *  DEP-YYYY-NNNNN  /  VTE-YYYY-NNNNN
 * ═══════════════════════════════════════════ */

import { REF_PREFIX_EXPENSE, REF_PREFIX_SALE } from './constants.js';

/**
 * Génère une référence formatée PREFIX-YYYY-NNNNN.
 * @param prefix  Préfixe (ex: 'DEP', 'VTE')
 * @param seq     Numéro séquentiel (>= 1)
 * @param year    Année (défaut: année courante)
 */
export function generateReference(prefix: string, seq: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  if (seq < 1 || !Number.isInteger(seq)) {
    throw new RangeError('seq must be a positive integer');
  }
  return `${prefix}-${y}-${String(seq).padStart(5, '0')}`;
}

/** Génère une référence dépense. */
export function generateExpenseReference(seq: number, year?: number): string {
  return generateReference(REF_PREFIX_EXPENSE, seq, year);
}

/** Génère une référence vente. */
export function generateSaleReference(seq: number, year?: number): string {
  return generateReference(REF_PREFIX_SALE, seq, year);
}

/** Parse une référence et retourne ses composants. */
export function parseReference(ref: string): { prefix: string; year: number; seq: number } | null {
  const match = ref.match(/^([A-Z]{3})-(\d{4})-(\d{5})$/);
  if (!match) return null;
  return {
    prefix: match[1],
    year: parseInt(match[2], 10),
    seq: parseInt(match[3], 10),
  };
}
