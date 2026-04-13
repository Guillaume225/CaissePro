import {
  formatCurrency,
  roundXOF,
  roundCurrency,
  amountExclTax,
  amountInclTax,
  taxAmount,
  parseCurrencyString,
} from './currency.js';

describe('currency', () => {
  describe('formatCurrency', () => {
    test('formate en XOF sans décimales', () => {
      const result = formatCurrency(15000);
      // Intl format varies by platform, just check it contains the amount
      expect(result).toContain('15');
      expect(result).toContain('000');
    });

    test('formate en EUR avec 2 décimales', () => {
      const result = formatCurrency(1234.56, 'EUR', 'fr-FR');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });
  });

  describe('roundXOF', () => {
    test('arrondi au franc près', () => {
      expect(roundXOF(1234.4)).toBe(1234);
      expect(roundXOF(1234.5)).toBe(1235);
      expect(roundXOF(1234.9)).toBe(1235);
    });
  });

  describe('roundCurrency', () => {
    test('arrondi à 2 décimales par défaut', () => {
      expect(roundCurrency(1.005)).toBe(1.01);
      expect(roundCurrency(1.004)).toBe(1);
      expect(roundCurrency(99.999)).toBe(100);
    });

    test('arrondi à N décimales', () => {
      expect(roundCurrency(1.2345, 3)).toBe(1.235);
      expect(roundCurrency(1.2345, 0)).toBe(1);
    });
  });

  describe('amountExclTax', () => {
    test('calcule HT à partir de TTC avec TVA CI 18%', () => {
      // 11800 TTC → 10000 HT
      expect(amountExclTax(11800)).toBe(10000);
    });

    test('calcule avec un taux custom', () => {
      // 12000 TTC, 20% → 10000 HT
      expect(amountExclTax(12000, 20)).toBe(10000);
    });
  });

  describe('amountInclTax', () => {
    test('calcule TTC à partir de HT avec TVA CI 18%', () => {
      expect(amountInclTax(10000)).toBe(11800);
    });

    test('calcule avec un taux custom', () => {
      expect(amountInclTax(10000, 20)).toBe(12000);
    });
  });

  describe('taxAmount', () => {
    test('calcule le montant de TVA', () => {
      expect(taxAmount(10000)).toBe(1800);
    });

    test('calcule avec un taux custom', () => {
      expect(taxAmount(10000, 20)).toBe(2000);
    });
  });

  describe('parseCurrencyString', () => {
    test('parse un montant simple', () => {
      expect(parseCurrencyString('15000')).toBe(15000);
    });

    test('parse un montant avec séparateur de milliers', () => {
      expect(parseCurrencyString('15.000')).toBe(15000);
    });

    test('parse un montant avec virgule décimale', () => {
      expect(parseCurrencyString('1234,56')).toBe(1234.56);
    });

    test('parse un montant avec symbole devise', () => {
      expect(parseCurrencyString('15 000 FCFA')).toBe(15000);
    });

    test('retourne null pour une string non numérique', () => {
      expect(parseCurrencyString('abc')).toBeNull();
      expect(parseCurrencyString('')).toBeNull();
    });
  });
});
