import {
  normalizePagination,
  buildPaginationMeta,
  paginateArray,
} from './pagination.js';

describe('pagination', () => {
  describe('normalizePagination', () => {
    test('utilise les valeurs par défaut sans input', () => {
      const result = normalizePagination();
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(25);
      expect(result.skip).toBe(0);
    });

    test('calcule skip correctement', () => {
      const result = normalizePagination({ page: 3, perPage: 10 });
      expect(result.page).toBe(3);
      expect(result.perPage).toBe(10);
      expect(result.skip).toBe(20);
    });

    test('clamp page à 1 minimum', () => {
      const result = normalizePagination({ page: -5 });
      expect(result.page).toBe(1);
    });

    test('clamp perPage à MAX_PER_PAGE', () => {
      const result = normalizePagination({ perPage: 9999 });
      expect(result.perPage).toBe(100);
    });

    test('clamp perPage à 1 minimum', () => {
      const result = normalizePagination({ perPage: -10 });
      expect(result.perPage).toBe(1);
    });

    test('arrondi les décimaux', () => {
      const result = normalizePagination({ page: 2.7, perPage: 10.3 });
      expect(result.page).toBe(2);
      expect(result.perPage).toBe(10);
    });
  });

  describe('buildPaginationMeta', () => {
    test('calcule totalPages et navigation', () => {
      const meta = buildPaginationMeta(1, 10, 35);
      expect(meta.totalPages).toBe(4);
      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrev).toBe(false);
    });

    test('dernière page', () => {
      const meta = buildPaginationMeta(4, 10, 35);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });

    test('page unique', () => {
      const meta = buildPaginationMeta(1, 10, 5);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });

    test('total = 0 donne 1 page', () => {
      const meta = buildPaginationMeta(1, 10, 0);
      expect(meta.totalPages).toBe(1);
    });
  });

  describe('paginateArray', () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1);

    test('retourne la première page par défaut', () => {
      const result = paginateArray(items);
      expect(result.data).toHaveLength(25);
      expect(result.data[0]).toBe(1);
      expect(result.data[24]).toBe(25);
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(50);
    });

    test('retourne la deuxième page', () => {
      const result = paginateArray(items, { page: 2, perPage: 20 });
      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toBe(21);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(true);
    });

    test('dernière page partielle', () => {
      const result = paginateArray(items, { page: 3, perPage: 20 });
      expect(result.data).toHaveLength(10);
      expect(result.data[0]).toBe(41);
      expect(result.meta.hasNext).toBe(false);
    });

    test('page au-delà du total retourne un tableau vide', () => {
      const result = paginateArray(items, { page: 100, perPage: 25 });
      expect(result.data).toHaveLength(0);
    });

    test('tableau vide', () => {
      const result = paginateArray([]);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
