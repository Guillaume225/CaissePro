import { Injectable } from '@nestjs/common';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';

@Injectable()
export class DashboardService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /** GET /dashboard/stats — counts by status + total estimated amount. */
  async getStats(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);

    const byStatusRows: { status: string; count: number }[] = await ds.query(`
      SELECT status, COUNT(*) AS count
      FROM [${s}].[purchase_requests]
      GROUP BY status
    `);

    const [totalRow] = await ds.query(`
      SELECT COALESCE(SUM(total_estimated_amount), 0) AS totalAmount, COUNT(*) AS totalCount
      FROM [${s}].[purchase_requests]
    `);

    return this.wrap({
      counts: byStatusRows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = Number(r.count);
        return acc;
      }, {}),
      totalAmount: Number(totalRow?.totalAmount ?? 0),
    });
  }
}
