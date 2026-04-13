/* ═══════════════════════════════════════════
 *  Helpers de validation — Côte d'Ivoire
 * ═══════════════════════════════════════════ */

import { CI_PHONE_REGEX, CI_RCCM_REGEX } from './constants.js';

/** Vérifie un numéro de téléphone CI (+225 XX XX XX XX XX). */
export function isValidCIPhone(phone: string): boolean {
  return CI_PHONE_REGEX.test(phone.trim());
}

/** Vérifie un numéro RCCM (CI-XXX-YYYY-X-NNNNN). */
export function isValidRCCM(rccm: string): boolean {
  return CI_RCCM_REGEX.test(rccm.trim());
}

/** Vérifie un email (validation légère, pas RFC 5322 complète). */
export function isValidEmail(email: string): boolean {
  // Regex intentionnellement simple : on se repose sur class-validator
  // côté DTO pour une validation plus stricte.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email.trim());
}

/** Vérifie que le montant est un nombre positif. */
export function isPositiveAmount(amount: number): boolean {
  return typeof amount === 'number' && isFinite(amount) && amount > 0;
}

/** Vérifie que le montant est positif ou zéro. */
export function isNonNegativeAmount(amount: number): boolean {
  return typeof amount === 'number' && isFinite(amount) && amount >= 0;
}

/** Nettoyage d'un numéro de téléphone : supprime espaces / tirets / points. */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[\s\-\.\(\)]/g, '');
}

/** Vérifie qu'une string n'est pas vide / uniquement espaces. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Tronque un texte à maxLen caractères avec "…" si dépassement. */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}
