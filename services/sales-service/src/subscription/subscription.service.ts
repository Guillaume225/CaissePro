import { Injectable, Logger, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SubscriptionPlan } from './subscription.interface';

const CACHE_PREFIX = 'subscription:';
const CACHE_TTL_SECONDS = 300;
const USAGE_WARN_THRESHOLD = 0.8;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly authServiceUrl: string;
  private readonly internalSecret: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.authServiceUrl = this.config.get<string>('app.authServiceUrl') ?? 'http://auth-service:3001';
    this.internalSecret = this.config.get<string>('app.internalSecret') ?? '';
  }

  async getPlan(tenantId: string): Promise<SubscriptionPlan> {
    const key = `${CACHE_PREFIX}${tenantId}`;
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as SubscriptionPlan;
    }
    // Cache miss: auth-service is the authoritative source
    const plan = await this.fetchFromAuthService(tenantId);
    await this.redis.set(key, JSON.stringify(plan), 'EX', CACHE_TTL_SECONDS);
    return plan;
  }

  async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.del(`${CACHE_PREFIX}${tenantId}`);
  }

  async assertFeature(tenantId: string, feature: string): Promise<void> {
    const plan = await this.getPlan(tenantId);
    const enabled = (plan.features as Record<string, boolean>)[feature] ?? false;

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
    const max = (plan.limits as Record<string, number | null>)[limitName];

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

  private async fetchFromAuthService(tenantId: string): Promise<SubscriptionPlan> {
    const url = `${this.authServiceUrl}/internal/tenants/${tenantId}/plan`;
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
      });
    } catch (err) {
      this.logger.error(
        `[AUTH-SERVICE-UNREACHABLE] tenant=${tenantId} error=${(err as Error).message}`,
      );
      throw new ForbiddenException('Impossible de vérifier votre abonnement. Réessayez.');
    }

    if (!response.ok) {
      this.logger.error(`[AUTH-SERVICE-ERROR] tenant=${tenantId} status=${response.status}`);
      throw new ForbiddenException('Impossible de vérifier votre abonnement. Réessayez.');
    }

    const body = await response.json() as { data: SubscriptionPlan };
    return body.data;
  }
}
