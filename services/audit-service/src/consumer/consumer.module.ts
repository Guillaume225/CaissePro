import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@/entities/audit-log.entity';
import { ConsumerService } from './consumer.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [ConsumerService],
  exports: [ConsumerService],
})
export class ConsumerModule {}
