import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
