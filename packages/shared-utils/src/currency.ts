/* ═══════════════════════════════════════════
 *  Currency helpers — FCFA (XOF)
 * ═══════════════════════════════════════════ */

import { DEFAULT_CURRENCY, DEFAULT_LOCALE, TVA_RATE_CI } from './constants.js';

/**
 * Formate un montant en devise.
 * Par défaut : FCFA (XOF), locale fr-FR.
 * XOF n'a pas de sous-unité, donc 0 décimales.
 */
export function formatCurrency(
  value: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE,
): string {
  const fractionDigits = currency === 'XOF' ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Arrondi bancaire (au franc près pour XOF). */
export function roundXOF(value: number): number {
  return Math.round(value);
}

/** Arrondi à 2 décimales (pour les devises à sous-unités). */
export function roundCurrency(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Calcule le montant HT à partir du TTC. */
export function amountExclTax(ttc: number, taxRate = TVA_RATE_CI): number {
  return roundCurrency(ttc / (1 + taxRate / 100));
}

/** Calcule le montant TTC à partir du HT. */
export function amountInclTax(ht: number, taxRate = TVA_RATE_CI): number {
  return roundCurrency(ht * (1 + taxRate / 100));
}

/** Calcule le montant de taxe. */
export function taxAmount(ht: number, taxRate = TVA_RATE_CI): number {
  return roundCurrency(ht * taxRate / 100);
}

/** Parse un montant depuis une string (gère les séparateurs FR). */
export function parseCurrencyString(value: string): number | null {
  // Supprime le symbole devise, espaces, puis convertit virgule → point.
  const cleaned = value
    .replace(/[^\d,.\-]/g, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3})/g, '') // retire les points de milliers
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
