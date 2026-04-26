import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_LIMIT_KEY } from '../subscription.decorator';
import { SubscriptionService } from '../subscription.service';
import { LimitCounterService } from '../limit-counter.service';

interface RequestUser {
  tenantId: string;
}

@Injectable()
export class LimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
    private readonly limitCounter: LimitCounterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limitName = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!limitName) return true;

    const { user } = context.switchToHttp().getRequest<{ user: RequestUser }>();
    const currentCount = await this.limitCounter.count(limitName, user.tenantId);
    await this.subscriptionService.assertLimit(user.tenantId, limitName, currentCount);
    return true;
  }
}
