import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from '../subscription.decorator';
import { SubscriptionService } from '../subscription.service';

interface RequestUser {
  tenantId: string;
}

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!feature) return true;

    const { user } = context.switchToHttp().getRequest<{ user: RequestUser }>();
    await this.subscriptionService.assertFeature(user.tenantId, feature);
    return true;
  }
}
