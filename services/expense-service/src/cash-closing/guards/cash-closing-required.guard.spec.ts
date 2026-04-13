import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CashClosingRequiredGuard } from './cash-closing-required.guard';
import { CashClosingService } from '../cash-closing.service';

describe('CashClosingRequiredGuard (expense)', () => {
  let guard: CashClosingRequiredGuard;
  let service: { isYesterdayClosed: jest.Mock };
  let reflector: Reflector;

  function mockContext(method: string, isPublic = false, skip = false): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ method }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    service = { isYesterdayClosed: jest.fn() };
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    guard = new CashClosingRequiredGuard(
      service as unknown as CashClosingService,
      reflector,
    );
  });

  it('should allow GET requests without checking', async () => {
    const ctx = mockContext('GET');
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(service.isYesterdayClosed).not.toHaveBeenCalled();
  });

  it('should allow POST if yesterday is closed', async () => {
    service.isYesterdayClosed.mockResolvedValue(true);
    const ctx = mockContext('POST');
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should block POST if yesterday is not closed', async () => {
    service.isYesterdayClosed.mockResolvedValue(false);
    const ctx = mockContext('POST');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should block DELETE if yesterday is not closed', async () => {
    service.isYesterdayClosed.mockResolvedValue(false);
    const ctx = mockContext('DELETE');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should allow if public route', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    const ctx = mockContext('POST');
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(service.isYesterdayClosed).not.toHaveBeenCalled();
  });
});
