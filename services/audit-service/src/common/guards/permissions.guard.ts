import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user?.permissions || !Array.isArray(user.permissions)) {
      throw new ForbiddenException('Permissions information missing');
    }
    const hasAll = requiredPermissions.every((p: string) => user.permissions.includes(p));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
