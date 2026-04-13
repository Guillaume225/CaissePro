import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { DisbursementRequestsService } from './disbursement-requests.service';
import { DisbursementRequestsController } from './disbursement-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DisbursementRequest])],
  controllers: [DisbursementRequestsController],
  providers: [DisbursementRequestsService],
  exports: [DisbursementRequestsService],
})
export class DisbursementRequestsModule {}
