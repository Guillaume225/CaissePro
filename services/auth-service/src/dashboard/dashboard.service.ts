import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /* ── Admin KPIs (/dashboard/admin/kpis) ────────────── */
  async getAdminKpis() {
    const [row] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM users WHERE is_active = 1) AS activeUsers,
        (SELECT COUNT(*) FROM roles) AS totalRoles,
        (SELECT COUNT(*) FROM audit_logs WHERE CAST([timestamp] AS DATE) = CAST(GETDATE() AS DATE)) AS auditEventsToday
    `);
    return this.wrap({
      totalUsers: Number(row.totalUsers),
      activeUsers: Number(row.activeUsers),
      totalRoles: Number(row.totalRoles),
      auditEventsToday: Number(row.auditEventsToday),
    });
  }

  /* ── Recent audit logs (/dashboard/admin/recent-logs) ─ */
  async getRecentLogs() {
    const rows = await this.dataSource.query(`
      SELECT TOP 20 a.id,
        COALESCE(u.first_name + ' ' + u.last_name, 'System') AS userName,
        a.action, a.entity_type AS entityType,
        COALESCE(a.action + ' on ' + a.entity_type, '') AS description,
        a.[timestamp] AS createdAt
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.[timestamp] DESC
    `);
    return this.wrap(rows);
  }

  /* ── Role distribution (/dashboard/admin/role-distribution) */
  async getRoleDistribution() {
    const rows = await this.dataSource.query(`
      SELECT r.name, COUNT(u.id) AS count
      FROM roles r
      LEFT JOIN users u ON u.role_id = r.id
      GROUP BY r.name
      ORDER BY count DESC
    `);
    return this.wrap(rows.map((r: Record<string, unknown>) => ({ name: r.name as string, count: Number(r.count) })));
  }

  /* ── Hourly activity (/dashboard/admin/hourly-activity) ─ */
  async getHourlyActivity() {
    const rows = await this.dataSource.query(`
      SELECT
        RIGHT('0' + CAST(DATEPART(HOUR, [timestamp]) AS VARCHAR), 2) + ':00' AS hour,
        COUNT(*) AS events
      FROM audit_logs
      WHERE CAST([timestamp] AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY DATEPART(HOUR, [timestamp])
      ORDER BY DATEPART(HOUR, [timestamp])
    `);
    return this.wrap(rows.map((r: Record<string, unknown>) => ({ hour: r.hour as string, events: Number(r.events) })));
  }
}
