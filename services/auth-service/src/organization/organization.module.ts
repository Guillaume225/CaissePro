import { Module } from '@nestjs/common';
import { DepartmentsController, ServicesController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { TenantDataSourceModule } from '../tenant/tenant-datasource.module';

@Module({
  imports: [TenantDataSourceModule],
  controllers: [DepartmentsController, ServicesController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
