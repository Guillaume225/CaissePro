/* ═══════════════════════════════════════════
 *  Helpers de pagination
 * ═══════════════════════════════════════════ */

import {
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
} from './constants.js';

/* ------------ Types -------------------- */

export interface PaginationInput {
  page?: number;
  perPage?: number;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/* ------------ Fonctions ---------------- */

/** Normalise et sécurise les paramètres de pagination. */
export function normalizePagination(input: PaginationInput = {}): {
  page: number;
  perPage: number;
  skip: number;
} {
  const page = Math.max(1, Math.floor(input.page ?? DEFAULT_PAGE));
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Math.floor(input.perPage ?? DEFAULT_PER_PAGE)),
  );
  const skip = (page - 1) * perPage;
  return { page, perPage, skip };
}

/** Construit les métadonnées de pagination. */
export function buildPaginationMeta(
  page: number,
  perPage: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/** Crée un résultat paginé complet. */
export function paginateArray<T>(
  items: T[],
  input: PaginationInput = {},
): PaginatedResult<T> {
  const { page, perPage, skip } = normalizePagination(input);
  const data = items.slice(skip, skip + perPage);
  const meta = buildPaginationMeta(page, perPage, items.length);
  return { data, meta };
}
