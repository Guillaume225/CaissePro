import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { LimitCounterService } from './limit-counter.service';
import { FeatureGuard } from './guards/feature.guard';
import { LimitGuard } from './guards/limit.guard';

@Module({
  providers: [SubscriptionService, LimitCounterService, FeatureGuard, LimitGuard],
  exports: [SubscriptionService, LimitCounterService, FeatureGuard, LimitGuard],
})
export class SubscriptionModule {}
