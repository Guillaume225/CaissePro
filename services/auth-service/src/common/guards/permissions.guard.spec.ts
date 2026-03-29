import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  function createMockContext(user?: any, permissions?: string[]): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permissions || undefined);

    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  }

  it('should allow access when no permissions are required', () => {
    const ctx = createMockContext({ permissions: ['sale.create'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user has all required permissions', () => {
    const ctx = createMockContext(
      { permissions: ['sale.create', 'sale.read', 'user.create'] },
      ['sale.create', 'sale.read'],
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access when user is missing a permission', () => {
    const ctx = createMockContext(
      { permissions: ['sale.create'] },
      ['sale.create', 'sale.read'],
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny access when no user on request', () => {
    const ctx = createMockContext(undefined, ['sale.create']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny when user has empty permissions array', () => {
    const ctx = createMockContext({ permissions: [] }, ['sale.create']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
