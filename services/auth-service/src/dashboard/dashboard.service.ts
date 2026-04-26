import { Injectable } from '@nestjs/common';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';

@Injectable()
export class DashboardService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /* ── Admin KPIs (/dashboard/admin/kpis) ────────────── */
  async getAdminKpis(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const [row] = await ds.query(`
      SELECT
        (SELECT COUNT(*) FROM [${s}].[users]) AS totalUsers,
        (SELECT COUNT(*) FROM [${s}].[users] WHERE is_active = 1) AS activeUsers,
        (SELECT COUNT(*) FROM [${s}].[roles]) AS totalRoles,
        (SELECT COUNT(*) FROM [dbo].[audit_logs] WHERE CAST([timestamp] AS DATE) = CAST(GETDATE() AS DATE)) AS auditEventsToday
    `);
    return this.wrap({
      totalUsers: Number(row.totalUsers),
      activeUsers: Number(row.activeUsers),
      totalRoles: Number(row.totalRoles),
      auditEventsToday: Number(row.auditEventsToday),
    });
  }

  /* ── Recent audit logs (/dashboard/admin/recent-logs) ─ */
  async getRecentLogs(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT TOP 20 a.id,
        COALESCE(u.first_name + ' ' + u.last_name, 'System') AS userName,
        a.action, a.entity_type AS entityType,
        COALESCE(a.action + ' on ' + a.entity_type, '') AS description,
        a.[timestamp] AS createdAt
      FROM [dbo].[audit_logs] a
      LEFT JOIN [${s}].[users] u ON u.id = a.user_id
      ORDER BY a.[timestamp] DESC
    `);
    return this.wrap(rows);
  }

  /* ── Role distribution (/dashboard/admin/role-distribution) */
  async getRoleDistribution(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT r.name, COUNT(u.id) AS count
      FROM [${s}].[roles] r
      LEFT JOIN [${s}].[users] u ON u.role_id = r.id
      GROUP BY r.name
      ORDER BY count DESC
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({
        name: r.name as string,
        count: Number(r.count),
      })),
    );
  }

  /* ── Hourly activity (/dashboard/admin/hourly-activity) ─ */
  async getHourlyActivity(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const rows = await ds.query(`
      SELECT
        RIGHT('0' + CAST(DATEPART(HOUR, [timestamp]) AS VARCHAR), 2) + ':00' AS hour,
        COUNT(*) AS events
      FROM [dbo].[audit_logs]
      WHERE CAST([timestamp] AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY DATEPART(HOUR, [timestamp])
      ORDER BY DATEPART(HOUR, [timestamp])
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({
        hour: r.hour as string,
        events: Number(r.events),
      })),
    );
  }
}
