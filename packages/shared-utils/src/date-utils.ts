/* ═══════════════════════════════════════════
 *  Utilitaires de dates — Contexte CI
 * ═══════════════════════════════════════════ */

import { CI_FIXED_HOLIDAYS, AGING_BRACKETS } from './constants.js';

/* ------- Trimestres / Fiscalité -------- */

/** Retourne le trimestre fiscal (1-4) d'une date. */
export function getFiscalQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

/** Retourne le label du trimestre : "T1 2024". */
export function getFiscalQuarterLabel(date: Date): string {
  return `T${getFiscalQuarter(date)} ${date.getFullYear()}`;
}

/** Premier jour du mois de la date. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Dernier jour du mois de la date. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Premier jour du trimestre. */
export function startOfQuarter(date: Date): Date {
  const q = getFiscalQuarter(date);
  return new Date(date.getFullYear(), (q - 1) * 3, 1);
}

/** Dernier jour du trimestre. */
export function endOfQuarter(date: Date): Date {
  const q = getFiscalQuarter(date);
  return new Date(date.getFullYear(), q * 3, 0);
}

/* ------------- Jours ouvrés ------------- */

/** Vérifie si un jour est un jour férié fixe CI. */
export function isFixedHoliday(date: Date): boolean {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return CI_FIXED_HOLIDAYS.some(([month, day]) => month === m && day === d);
}

/** Vérifie si un jour est ouvré (hors weekends & fériés fixes CI). */
export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false; // dimanche, samedi
  return !isFixedHoliday(date);
}

/** Ajoute N jours ouvrés à une date. */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  const step = days >= 0 ? 1 : -1;
  const target = Math.abs(days);
  while (added < target) {
    result.setDate(result.getDate() + step);
    if (isBusinessDay(result)) added++;
  }
  return result;
}

/** Nombre de jours ouvrés entre deux dates (bornes incluses). */
export function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (isBusinessDay(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/* -------------- Aging ------------------- */

export type AgingBracketKey = keyof typeof AGING_BRACKETS;

/** Retourne le bucket aging pour un nombre de jours écoulés. */
export function getAgingBracket(daysElapsed: number): AgingBracketKey {
  for (const [key, { min, max }] of Object.entries(AGING_BRACKETS)) {
    if (daysElapsed >= min && daysElapsed <= max) {
      return key as AgingBracketKey;
    }
  }
  return 'OVERDUE';
}

/** Calcule le nombre de jours entre une date et aujourd'hui (ou une date ref). */
export function daysSince(date: Date, ref: Date = new Date()): number {
  const diffMs = ref.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/* -------------- Formatage --------------- */

/** Formate une date en "DD/MM/YYYY". */
export function formatDateFR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Formate une date en "DD/MM/YYYY HH:mm". */
export function formatDateTimeFR(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDateFR(date)} ${hh}:${mm}`;
}
