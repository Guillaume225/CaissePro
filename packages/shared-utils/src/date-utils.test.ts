import {
  getFiscalQuarter,
  getFiscalQuarterLabel,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  isFixedHoliday,
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
  getAgingBracket,
  daysSince,
  formatDateFR,
  formatDateTimeFR,
} from './date-utils.js';

describe('date-utils', () => {
  describe('getFiscalQuarter', () => {
    test.each([
      [new Date(2024, 0, 15), 1],  // Janvier → T1
      [new Date(2024, 2, 31), 1],  // Mars → T1
      [new Date(2024, 3, 1), 2],   // Avril → T2
      [new Date(2024, 6, 15), 3],  // Juillet → T3
      [new Date(2024, 11, 31), 4], // Décembre → T4
    ])('retourne le bon trimestre pour %s', (date, expected) => {
      expect(getFiscalQuarter(date)).toBe(expected);
    });
  });

  describe('getFiscalQuarterLabel', () => {
    test('retourne le format "T1 2024"', () => {
      expect(getFiscalQuarterLabel(new Date(2024, 0, 1))).toBe('T1 2024');
      expect(getFiscalQuarterLabel(new Date(2024, 11, 1))).toBe('T4 2024');
    });
  });

  describe('startOfMonth / endOfMonth', () => {
    test('startOfMonth retourne le 1er du mois', () => {
      const d = startOfMonth(new Date(2024, 5, 15));
      expect(d.getDate()).toBe(1);
      expect(d.getMonth()).toBe(5);
    });

    test('endOfMonth retourne le dernier jour', () => {
      // Février 2024 (bissextile) → 29
      const d = endOfMonth(new Date(2024, 1, 10));
      expect(d.getDate()).toBe(29);
      expect(d.getMonth()).toBe(1);
    });
  });

  describe('startOfQuarter / endOfQuarter', () => {
    test('T2 2024 : 1er avril → 30 juin', () => {
      const date = new Date(2024, 4, 15); // Mai
      const start = startOfQuarter(date);
      const end = endOfQuarter(date);
      expect(start.getMonth()).toBe(3); // Avril
      expect(start.getDate()).toBe(1);
      expect(end.getMonth()).toBe(5);   // Juin
      expect(end.getDate()).toBe(30);
    });
  });

  describe('isFixedHoliday', () => {
    test('1er janvier est férié', () => {
      expect(isFixedHoliday(new Date(2024, 0, 1))).toBe(true);
    });

    test('7 août (indépendance) est férié', () => {
      expect(isFixedHoliday(new Date(2024, 7, 7))).toBe(true);
    });

    test('2 janvier n\'est pas férié', () => {
      expect(isFixedHoliday(new Date(2024, 0, 2))).toBe(false);
    });
  });

  describe('isBusinessDay', () => {
    test('un lundi normal est ouvré', () => {
      // 2024-01-08 = lundi
      expect(isBusinessDay(new Date(2024, 0, 8))).toBe(true);
    });

    test('un samedi n\'est pas ouvré', () => {
      // 2024-01-06 = samedi
      expect(isBusinessDay(new Date(2024, 0, 6))).toBe(false);
    });

    test('un dimanche n\'est pas ouvré', () => {
      expect(isBusinessDay(new Date(2024, 0, 7))).toBe(false);
    });

    test('un jour férié en semaine n\'est pas ouvré', () => {
      // 1er mai 2024 = mercredi
      expect(isBusinessDay(new Date(2024, 4, 1))).toBe(false);
    });
  });

  describe('addBusinessDays', () => {
    test('ajoute des jours ouvrés en sautant le weekend', () => {
      // Vendredi 5 jan 2024 + 1 jour ouvré = lundi 8 jan
      const result = addBusinessDays(new Date(2024, 0, 5), 1);
      expect(result.getDate()).toBe(8);
      expect(result.getMonth()).toBe(0);
    });

    test('soustrait des jours ouvrés', () => {
      // Lundi 8 jan 2024 - 1 jour ouvré = vendredi 5 jan
      const result = addBusinessDays(new Date(2024, 0, 8), -1);
      expect(result.getDate()).toBe(5);
    });
  });

  describe('countBusinessDays', () => {
    test('compte les jours ouvrés dans une semaine complète', () => {
      // Lun 8 jan → Ven 12 jan 2024 = 5 jours ouvrés
      const count = countBusinessDays(
        new Date(2024, 0, 8),
        new Date(2024, 0, 12),
      );
      expect(count).toBe(5);
    });
  });

  describe('getAgingBracket', () => {
    test('retourne CURRENT pour 0-29 jours', () => {
      expect(getAgingBracket(0)).toBe('CURRENT');
      expect(getAgingBracket(29)).toBe('CURRENT');
    });

    test('retourne DAYS_30 pour 30-59 jours', () => {
      expect(getAgingBracket(30)).toBe('DAYS_30');
      expect(getAgingBracket(59)).toBe('DAYS_30');
    });

    test('retourne OVERDUE pour >= 120 jours', () => {
      expect(getAgingBracket(120)).toBe('OVERDUE');
      expect(getAgingBracket(999)).toBe('OVERDUE');
    });
  });

  describe('daysSince', () => {
    test('calcule le nombre de jours entre deux dates', () => {
      const start = new Date(2024, 0, 1);
      const ref = new Date(2024, 0, 11);
      expect(daysSince(start, ref)).toBe(10);
    });

    test('retourne 0 pour le même jour', () => {
      const d = new Date(2024, 0, 1);
      expect(daysSince(d, d)).toBe(0);
    });
  });

  describe('formatDateFR', () => {
    test('formate en DD/MM/YYYY', () => {
      expect(formatDateFR(new Date(2024, 0, 5))).toBe('05/01/2024');
      expect(formatDateFR(new Date(2024, 11, 25))).toBe('25/12/2024');
    });
  });

  describe('formatDateTimeFR', () => {
    test('formate en DD/MM/YYYY HH:mm', () => {
      const d = new Date(2024, 0, 5, 14, 30);
      expect(formatDateTimeFR(d)).toBe('05/01/2024 14:30');
    });
  });
});
