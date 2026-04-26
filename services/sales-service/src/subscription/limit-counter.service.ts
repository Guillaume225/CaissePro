import { Injectable, Logger } from '@nestjs/common';
import { CashDay } from '../entities/cash-day.entity';
import { CashMovement } from '../entities/cash-movement.entity';
import { CashDayStatus } from '../entities/enums';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class LimitCounterService {
  private readonly logger = new Logger(LimitCounterService.name);

  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async count(limitName: string, tenantId: string): Promise<number> {
    switch (limitName) {
      case 'maxCaisses':
        return this.countOpenCaisses(tenantId);

      case 'transactionsLimit':
        return this.countMonthlyTransactions(tenantId);

      case 'maxUsers':
      case 'maxCompanies':
        return 0;

      default:
        this.logger.warn(`No counter registered for limit "${limitName}" in sales-service`);
        return 0;
    }
  }

  private async countOpenCaisses(tenantId: string): Promise<number> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(CashDay).count({ where: { status: CashDayStatus.OPEN } });
  }

  private async countMonthlyTransactions(tenantId: string): Promise<number> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return ds
      .getRepository(CashMovement)
      .createQueryBuilder('m')
      .innerJoin('m.cashDay', 'cd')
      .andWhere('m.createdAt >= :startOfMonth', { startOfMonth })
      .getCount();
  }
}
