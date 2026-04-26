import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import { SubscriptionService } from './subscription.service';
import { LimitCounterService } from './limit-counter.service';
import { PlanStatus, LimitStatus } from './subscription.interface';

const USAGE_WARN_THRESHOLD = 80;

@Controller('plan')
export class PlanStatusController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly limitCounter: LimitCounterService,
  ) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getPlanStatus(
    @CurrentUser('tenantId') tenantId: string,
  ): Promise<{ success: boolean; data: PlanStatus; timestamp: string }> {
    const plan = await this.subscriptionService.getPlan(tenantId);

    const limitEntries = Object.entries(plan.limits) as Array<[string, number | null]>;
    const limitStatuses: Record<string, LimitStatus> = {};

    await Promise.all(
      limitEntries.map(async ([name, max]) => {
        const current = await this.limitCounter.count(name, tenantId);
        const percentage = max !== null ? Math.round((current / max) * 100) : null;
        limitStatuses[name] = {
          limit: max,
          current,
          percentage,
          warning: percentage !== null && percentage >= USAGE_WARN_THRESHOLD,
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

    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
