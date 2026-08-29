import { Module } from '@nestjs/common';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';
import { PurchasingController } from './purchasing.controller';

@Module({
  imports: [PurchaseRequestsModule],
  controllers: [PurchasingController],
})
export class PurchasingModule {}
