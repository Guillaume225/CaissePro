import { Injectable, Logger, ForbiddenException, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { TenantService } from '../tenant/tenant.service';
import { PlansService } from '../plans/plans.service';
import { PlanDefinition } from '../plans/plans.config';

const CACHE_PREFIX = 'subscription:';
const CACHE_TTL_SECONDS = 300;
const USAGE_WARN_THRESHOLD = 0.8;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly tenantService: TenantService,
    private readonly plansService: PlansService,
  ) {}

  async getPlan(tenantId: string): Promise<PlanDefinition> {
    const key = `${CACHE_PREFIX}${tenantId}`;
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as PlanDefinition;
    }
    const tenant = await this.tenantService.findById(tenantId);
    const plan = this.plansService.getPlan(tenant.planCode);
    await this.redis.set(key, JSON.stringify(plan), 'EX', CACHE_TTL_SECONDS);
    return plan;
  }

  async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.del(`${CACHE_PREFIX}${tenantId}`);
    this.logger.log(`[CACHE-INVALIDATED] tenant=${tenantId}`);
  }

  async assertFeature(tenantId: string, feature: string): Promise<void> {
    const plan = await this.getPlan(tenantId);
    const enabled = (plan.features as unknown as Record<string, boolean>)[feature] ?? false;

    if (!enabled) {
      this.logger.warn(
        `[FEATURE-BLOCKED] tenant=${tenantId} plan=${plan.code} feature="${feature}"`,
      );
      throw new ForbiddenException(
        `La fonctionnalité "${feature}" n'est pas disponible dans votre plan "${plan.displayName}".`,
      );
    }
  }

  async assertLimit(
    tenantId: string,
    limitName: string,
    currentCount: number,
  ): Promise<void> {
    const plan = await this.getPlan(tenantId);
    const max = (plan.limits as unknown as Record<string, number | null>)[limitName];

    if (max === null || max === undefined) {
      return;
    }

    const ratio = currentCount / max;

    if (ratio >= USAGE_WARN_THRESHOLD && ratio < 1) {
      this.logger.warn(
        `[USAGE-WARNING] tenant=${tenantId} plan=${plan.code} limit=${limitName} usage=${currentCount}/${max} (${Math.round(ratio * 100)}%)`,
      );
    }

    if (currentCount >= max) {
      this.logger.error(
        `[LIMIT-EXCEEDED] tenant=${tenantId} plan=${plan.code} limit=${limitName} current=${currentCount} max=${max}`,
      );
      throw new ForbiddenException(
        `Limite atteinte : "${limitName}" (${currentCount}/${max}). Passez au plan supérieur.`,
      );
    }
  }
}
