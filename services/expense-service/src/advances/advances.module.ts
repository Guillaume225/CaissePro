import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Advance } from '../entities/advance.entity';
import { AuditModule } from '../audit/audit.module';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Advance]), AuditModule],
  controllers: [AdvancesController],
  providers: [AdvancesService],
  exports: [AdvancesService],
})
export class AdvancesModule {}
