import { Module } from '@nestjs/common';
import { DisbursementRequestsService } from './disbursement-requests.service';
import { DisbursementRequestsController } from './disbursement-requests.controller';

@Module({
  controllers: [DisbursementRequestsController],
  providers: [DisbursementRequestsService],
  exports: [DisbursementRequestsService],
})
export class DisbursementRequestsModule {}
