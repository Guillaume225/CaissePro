import { Module } from '@nestjs/common';
import { SagePurchaseOrderService } from './sage-po.service';

@Module({
  providers: [SagePurchaseOrderService],
  exports: [SagePurchaseOrderService],
})
export class SageModule {}
