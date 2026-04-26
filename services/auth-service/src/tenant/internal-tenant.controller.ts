import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';
import { Public } from '../common/decorators';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { PlanDefinition } from '../plans/plans.config';

@Controller('internal/tenants')
@Public()
@UseGuards(InternalSecretGuard)
export class InternalTenantController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get(':tenantId/plan')
  async getTenantPlan(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<{ success: boolean; data: PlanDefinition }> {
    const data = await this.subscriptionService.getPlan(tenantId);
    return { success: true, data };
  }
}
