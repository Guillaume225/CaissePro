import {
  TVA_RATE_CI,
  BUDGET_ALERT_THRESHOLDS,
  APPROVAL_DEADLINE_DAYS,
  AGING_BRACKETS,
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  REF_PREFIX_EXPENSE,
  REF_PREFIX_SALE,
  CI_PHONE_REGEX,
  CI_RCCM_REGEX,
  CI_FIXED_HOLIDAYS,
  DEFAULT_CREDIT_LIMIT,
  DEFAULT_CLIENT_SCORE,
  MAX_EXPORT_ROWS,
  ADVANCE_JUSTIFICATION_DAYS,
} from './constants.js';

describe('constants', () => {
  test('TVA_RATE_CI vaut 18', () => {
    expect(TVA_RATE_CI).toBe(18);
  });

  test('BUDGET_ALERT_THRESHOLDS est trié ascendant', () => {
    const arr = [...BUDGET_ALERT_THRESHOLDS];
    expect(arr).toEqual([50, 75, 90, 100]);
  });

  test('APPROVAL_DEADLINE_DAYS est positif', () => {
    expect(APPROVAL_DEADLINE_DAYS).toBeGreaterThan(0);
  });

  test('AGING_BRACKETS couvre toutes les plages', () => {
    expect(AGING_BRACKETS.CURRENT.min).toBe(0);
    expect(AGING_BRACKETS.OVERDUE.max).toBe(Infinity);
  });

  test('pagination defaults cohérents', () => {
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_PER_PAGE).toBe(25);
    expect(MAX_PER_PAGE).toBeGreaterThanOrEqual(DEFAULT_PER_PAGE);
  });

  test('DEFAULT_CURRENCY est XOF', () => {
    expect(DEFAULT_CURRENCY).toBe('XOF');
  });

  test('DEFAULT_LOCALE est fr-FR', () => {
    expect(DEFAULT_LOCALE).toBe('fr-FR');
  });

  test('préfixes de référence', () => {
    expect(REF_PREFIX_EXPENSE).toBe('DEP');
    expect(REF_PREFIX_SALE).toBe('VTE');
  });

  test('CI_PHONE_REGEX accepte un numéro valide', () => {
    expect(CI_PHONE_REGEX.test('+225 07 08 09 10 11')).toBe(true);
    expect(CI_PHONE_REGEX.test('+2250708091011')).toBe(true);
  });

  test('CI_PHONE_REGEX rejette un numéro invalide', () => {
    expect(CI_PHONE_REGEX.test('07 08 09 10 11')).toBe(false);
    expect(CI_PHONE_REGEX.test('+33 6 12 34 56 78')).toBe(false);
  });

  test('CI_RCCM_REGEX accepte un RCCM valide', () => {
    expect(CI_RCCM_REGEX.test('CI-ABJ-2023-B-12345')).toBe(true);
  });

  test('CI_RCCM_REGEX rejette un RCCM invalide', () => {
    expect(CI_RCCM_REGEX.test('CI-AB-2023-B-12345')).toBe(false);
    expect(CI_RCCM_REGEX.test('FR-ABJ-2023-B-12345')).toBe(false);
  });

  test('CI_FIXED_HOLIDAYS contient le 1er janvier', () => {
    expect(CI_FIXED_HOLIDAYS).toContainEqual([1, 1]);
  });

  test('CI_FIXED_HOLIDAYS contient 7 entrées', () => {
    expect(CI_FIXED_HOLIDAYS).toHaveLength(7);
  });

  test('constantes numériques positives', () => {
    expect(DEFAULT_CREDIT_LIMIT).toBe(0);
    expect(DEFAULT_CLIENT_SCORE).toBe(50);
    expect(MAX_EXPORT_ROWS).toBeGreaterThan(0);
    expect(ADVANCE_JUSTIFICATION_DAYS).toBeGreaterThan(0);
  });
});
