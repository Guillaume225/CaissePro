import { Module } from '@nestjs/common';
import { ApprovalCircuitsController } from './approval-circuits.controller';
import { ApprovalCircuitsService } from './approval-circuits.service';

@Module({
  controllers: [ApprovalCircuitsController],
  providers: [ApprovalCircuitsService],
})
export class ApprovalCircuitsModule {}
