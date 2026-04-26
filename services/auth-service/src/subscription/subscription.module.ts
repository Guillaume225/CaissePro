import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionService } from './subscription.service';
import { LimitCounterService } from './limit-counter.service';
import { FeatureGuard } from './guards/feature.guard';
import { LimitGuard } from './guards/limit.guard';
import { PlanStatusController } from './plan-status.controller';
import { InternalTenantController } from '../tenant/internal-tenant.controller';

@Module({
  imports: [TenantModule, PlansModule],
  controllers: [PlanStatusController, InternalTenantController],
  providers: [SubscriptionService, LimitCounterService, FeatureGuard, LimitGuard],
  exports: [SubscriptionService, LimitCounterService, FeatureGuard, LimitGuard],
})
export class SubscriptionModule {}
