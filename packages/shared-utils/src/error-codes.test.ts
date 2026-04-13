import { ErrorCodes, getHttpStatus } from './error-codes.js';
import type { ErrorCode } from './error-codes.js';

describe('error-codes', () => {
  test('ErrorCodes contient les codes auth', () => {
    expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS');
    expect(ErrorCodes.AUTH_TOKEN_EXPIRED).toBe('AUTH_TOKEN_EXPIRED');
    expect(ErrorCodes.AUTH_FORBIDDEN).toBe('AUTH_FORBIDDEN');
  });

  test('ErrorCodes contient les codes métier', () => {
    expect(ErrorCodes.EXPENSE_NOT_FOUND).toBe('EXPENSE_NOT_FOUND');
    expect(ErrorCodes.BUDGET_EXCEEDED).toBe('BUDGET_EXCEEDED');
    expect(ErrorCodes.SALE_NO_ITEMS).toBe('SALE_NO_ITEMS');
    expect(ErrorCodes.CLIENT_CREDIT_LIMIT_EXCEEDED).toBe('CLIENT_CREDIT_LIMIT_EXCEEDED');
  });

  test('ErrorCodes contient les codes system', () => {
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCodes.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });

  describe('getHttpStatus', () => {
    test('retourne 401 pour AUTH_INVALID_CREDENTIALS', () => {
      expect(getHttpStatus(ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(401);
    });

    test('retourne 403 pour AUTH_MFA_REQUIRED', () => {
      expect(getHttpStatus(ErrorCodes.AUTH_MFA_REQUIRED)).toBe(403);
    });

    test('retourne 404 pour NOT_FOUND', () => {
      expect(getHttpStatus(ErrorCodes.NOT_FOUND)).toBe(404);
    });

    test('retourne 409 pour CONFLICT', () => {
      expect(getHttpStatus(ErrorCodes.CONFLICT)).toBe(409);
    });

    test('retourne 422 pour EXPENSE_AMOUNT_EXCEEDS_LIMIT', () => {
      expect(getHttpStatus(ErrorCodes.EXPENSE_AMOUNT_EXCEEDS_LIMIT)).toBe(422);
    });

    test('retourne 413 pour FILE_TOO_LARGE', () => {
      expect(getHttpStatus(ErrorCodes.FILE_TOO_LARGE)).toBe(413);
    });

    test('retourne 429 pour RATE_LIMIT_EXCEEDED', () => {
      expect(getHttpStatus(ErrorCodes.RATE_LIMIT_EXCEEDED)).toBe(429);
    });

    test('retourne 500 pour un code inconnu', () => {
      expect(getHttpStatus('UNKNOWN_CODE')).toBe(500);
    });
  });

  test('type ErrorCode est assignable', () => {
    const code: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    expect(code).toBe('INTERNAL_ERROR');
  });
});
