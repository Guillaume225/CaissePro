import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser, Permissions } from '../common/decorators';
import { SubscriptionService } from '../subscription/subscription.service';
import { LimitCounterService } from '../subscription/limit-counter.service';
import { PlanStatus, LimitStatus } from '../subscription/subscription.interface';
import { PERMISSIONS } from '../common/permissions';

const USAGE_WARN_THRESHOLD = 0.8;

@Controller('plan')
export class TenantController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly limitCounter: LimitCounterService,
  ) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getPlanStatus(@CurrentUser('tenantId') tenantId: string): Promise<{ success: boolean; data: PlanStatus }> {
    const plan = await this.subscriptionService.getPlan(tenantId);

    const limitNames = Object.keys(plan.limits) as Array<keyof typeof plan.limits>;
    const limitStatuses: Record<string, LimitStatus> = {};

    await Promise.all(
      limitNames.map(async (name) => {
        const max = plan.limits[name] as number | null;
        const current = await this.limitCounter.count(String(name), tenantId);
        const percentage = max !== null ? Math.round((current / max) * 100) : null;
        limitStatuses[String(name)] = {
          limit: max,
          current,
          percentage,
          warning: percentage !== null && percentage >= USAGE_WARN_THRESHOLD * 100,
        };
      }),
    );

    const data: PlanStatus = {
      tenantId,
      planCode: plan.code,
      displayName: plan.displayName,
      aiLevel: plan.aiLevel,
      limits: limitStatuses,
      features: plan.features as unknown as Record<string, boolean>,
    };

    return { success: true, data };
  }
}
