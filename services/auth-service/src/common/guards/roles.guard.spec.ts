import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user?: any, roles?: string[]): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles || undefined);

    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  }

  it('should allow access when no roles are required', () => {
    const ctx = createMockContext({ roleName: 'ADMIN' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    const ctx = createMockContext({ roleName: 'ADMIN' }, ['ADMIN', 'DAF']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access when user does not have required role', () => {
    const ctx = createMockContext({ roleName: 'CAISSIER_VENTE' }, ['ADMIN', 'DAF']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny access when no user on request', () => {
    const ctx = createMockContext(undefined, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
