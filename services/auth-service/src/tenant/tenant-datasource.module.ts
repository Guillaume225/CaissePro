import { Global, Module } from '@nestjs/common';
import { TenantDataSourceService } from './tenant-datasource.service';

@Global()
@Module({
  providers: [TenantDataSourceService],
  exports: [TenantDataSourceService],
})
export class TenantDataSourceModule {}
