import { Injectable, Logger } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class LimitCounterService {
  private readonly logger = new Logger(LimitCounterService.name);

  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async count(limitName: string, tenantId: string): Promise<number> {
    const ds = await this.tenantDsService.getDataSource(tenantId);

    switch (limitName) {
      case 'maxUsers':
        return ds.getRepository(User).count({ where: { isActive: true } });

      case 'maxCompanies':
        return ds.getRepository(Company).count({ where: { isActive: true } });

      case 'maxCaisses':
      case 'transactionsLimit':
        return 0;

      default:
        this.logger.warn(`No counter registered for limit "${limitName}" in auth-service`);
        return 0;
    }
  }
}
