import {
  isValidCIPhone,
  isValidRCCM,
  isValidEmail,
  isPositiveAmount,
  isNonNegativeAmount,
  sanitizePhone,
  isNonEmptyString,
  truncate,
} from './validation.js';

describe('validation', () => {
  describe('isValidCIPhone', () => {
    test('accepte un numéro valide avec espaces', () => {
      expect(isValidCIPhone('+225 07 08 09 10 11')).toBe(true);
    });

    test('accepte un numéro valide sans espaces', () => {
      expect(isValidCIPhone('+2250708091011')).toBe(true);
    });

    test('rejette un numéro sans indicatif', () => {
      expect(isValidCIPhone('07 08 09 10 11')).toBe(false);
    });

    test('rejette un numéro avec indicatif FR', () => {
      expect(isValidCIPhone('+33 6 12 34 56 78')).toBe(false);
    });

    test('gère les espaces en début/fin', () => {
      expect(isValidCIPhone('  +225 07 08 09 10 11  ')).toBe(true);
    });
  });

  describe('isValidRCCM', () => {
    test('accepte un RCCM valide', () => {
      expect(isValidRCCM('CI-ABJ-2023-B-12345')).toBe(true);
    });

    test('rejette un RCCM avec ville trop courte', () => {
      expect(isValidRCCM('CI-AB-2023-B-12345')).toBe(false);
    });

    test('rejette un RCCM avec pays incorrect', () => {
      expect(isValidRCCM('FR-ABJ-2023-B-12345')).toBe(false);
    });

    test('rejette un RCCM avec numéro trop court', () => {
      expect(isValidRCCM('CI-ABJ-2023-B-1234')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    test('accepte un email valide', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('a.b@domain.co.ci')).toBe(true);
    });

    test('rejette un email sans @', () => {
      expect(isValidEmail('notanemail')).toBe(false);
    });

    test('rejette un email sans domaine', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    test('rejette un email avec espaces', () => {
      expect(isValidEmail('user @example.com')).toBe(false);
    });
  });

  describe('isPositiveAmount', () => {
    test('accepte un montant positif', () => {
      expect(isPositiveAmount(100)).toBe(true);
      expect(isPositiveAmount(0.01)).toBe(true);
    });

    test('rejette zéro', () => {
      expect(isPositiveAmount(0)).toBe(false);
    });

    test('rejette un montant négatif', () => {
      expect(isPositiveAmount(-1)).toBe(false);
    });

    test('rejette NaN et Infinity', () => {
      expect(isPositiveAmount(NaN)).toBe(false);
      expect(isPositiveAmount(Infinity)).toBe(false);
    });
  });

  describe('isNonNegativeAmount', () => {
    test('accepte zéro', () => {
      expect(isNonNegativeAmount(0)).toBe(true);
    });

    test('accepte un montant positif', () => {
      expect(isNonNegativeAmount(100)).toBe(true);
    });

    test('rejette un montant négatif', () => {
      expect(isNonNegativeAmount(-1)).toBe(false);
    });
  });

  describe('sanitizePhone', () => {
    test('supprime espaces, tirets, points, parenthèses', () => {
      expect(sanitizePhone('+225 07-08.09 (10) 11')).toBe('+22507080910 11'.replace(/ /g, ''));
    });

    test('retourne tel quel si déjà propre', () => {
      expect(sanitizePhone('+2250708091011')).toBe('+2250708091011');
    });
  });

  describe('isNonEmptyString', () => {
    test('accepte une string non vide', () => {
      expect(isNonEmptyString('hello')).toBe(true);
    });

    test('rejette une string vide', () => {
      expect(isNonEmptyString('')).toBe(false);
    });

    test('rejette une string d\'espaces', () => {
      expect(isNonEmptyString('   ')).toBe(false);
    });

    test('rejette null et undefined', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
    });

    test('rejette un nombre', () => {
      expect(isNonEmptyString(42)).toBe(false);
    });
  });

  describe('truncate', () => {
    test('ne tronque pas si <= maxLen', () => {
      expect(truncate('hello', 10)).toBe('hello');
      expect(truncate('hello', 5)).toBe('hello');
    });

    test('tronque avec "…" si > maxLen', () => {
      expect(truncate('hello world', 5)).toBe('hell…');
    });
  });
});
