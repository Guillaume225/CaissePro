import {
  generateReference,
  generateExpenseReference,
  generateSaleReference,
  parseReference,
} from './reference-generator.js';

describe('reference-generator', () => {
  describe('generateReference', () => {
    test('génère le bon format PREFIX-YYYY-NNNNN', () => {
      expect(generateReference('DEP', 1, 2024)).toBe('DEP-2024-00001');
      expect(generateReference('VTE', 42, 2024)).toBe('VTE-2024-00042');
      expect(generateReference('DEP', 99999, 2024)).toBe('DEP-2024-99999');
    });

    test("utilise l'année courante par défaut", () => {
      const year = new Date().getFullYear();
      expect(generateReference('TST', 1)).toBe(`TST-${year}-00001`);
    });

    test('lève une erreur si seq < 1', () => {
      expect(() => generateReference('DEP', 0, 2024)).toThrow(RangeError);
      expect(() => generateReference('DEP', -1, 2024)).toThrow(RangeError);
    });

    test("lève une erreur si seq n'est pas un entier", () => {
      expect(() => generateReference('DEP', 1.5, 2024)).toThrow(RangeError);
    });
  });

  describe('generateExpenseReference', () => {
    test('utilise le préfixe DEP', () => {
      expect(generateExpenseReference(1, 2024)).toBe('DEP-2024-00001');
      expect(generateExpenseReference(123, 2025)).toBe('DEP-2025-00123');
    });
  });

  describe('generateSaleReference', () => {
    test('utilise le préfixe VTE', () => {
      expect(generateSaleReference(1, 2024)).toBe('VTE-2024-00001');
      expect(generateSaleReference(456, 2025)).toBe('VTE-2025-00456');
    });
  });

  describe('parseReference', () => {
    test('parse une référence valide', () => {
      const result = parseReference('DEP-2024-00042');
      expect(result).toEqual({ prefix: 'DEP', year: 2024, seq: 42 });
    });

    test('parse une référence vente', () => {
      const result = parseReference('VTE-2025-00001');
      expect(result).toEqual({ prefix: 'VTE', year: 2025, seq: 1 });
    });

    test('retourne null pour une référence invalide', () => {
      expect(parseReference('INVALID')).toBeNull();
      expect(parseReference('DEP-24-001')).toBeNull();
      expect(parseReference('DE-2024-00001')).toBeNull();
      expect(parseReference('')).toBeNull();
    });

    test('roundtrip: generate → parse', () => {
      const ref = generateExpenseReference(573, 2024);
      const parsed = parseReference(ref);
      expect(parsed).toEqual({ prefix: 'DEP', year: 2024, seq: 573 });
    });
  });
});
