import { Injectable } from '@nestjs/common';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';

@Injectable()
export class DashboardService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /* ── General KPIs (/dashboard/kpis) ────────────────── */
  async getKpis(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [row] = await ds.query(
      `
      SELECT
        COALESCE((SELECT SUM(CASE WHEN type='ENTRY' THEN amount ELSE -amount END) FROM [${s}].[cash_movements]), 0) AS cashBalance,
        COALESCE((SELECT SUM(amount) FROM [${s}].[expenses] WHERE MONTH([date])=@0 AND YEAR([date])=@1 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS monthExpenses,
        COALESCE((SELECT SUM(total) FROM [${s}].[sales] WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1 AND status != 'CANCELLED'), 0) AS monthRevenue,
        COALESCE((SELECT SUM(amount_due - amount_paid) FROM [${s}].[receivables] WHERE status != 'PAID'), 0) AS outstandingReceivables,
        COALESCE((SELECT SUM(amount) FROM [${s}].[expenses] WHERE MONTH([date])=@2 AND YEAR([date])=@3 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS prevMonthExpenses,
        COALESCE((SELECT SUM(total) FROM [${s}].[sales] WHERE MONTH(created_at)=@2 AND YEAR(created_at)=@3 AND status != 'CANCELLED'), 0) AS prevMonthRevenue
    `,
      [thisMonth, thisYear, lastMonth, lastYear],
    );

    const trend = (cur: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

    return this.wrap({
      cashBalance: Number(row.cashBalance),
      monthExpenses: Number(row.monthExpenses),
      monthRevenue: Number(row.monthRevenue),
      outstandingReceivables: Number(row.outstandingReceivables),
      cashBalanceTrend: 0,
      monthExpensesTrend: trend(Number(row.monthExpenses), Number(row.prevMonthExpenses)),
      monthRevenueTrend: trend(Number(row.monthRevenue), Number(row.prevMonthRevenue)),
      receivablesTrend: 0,
    });
  }

  /* ── Treasury chart (/dashboard/treasury) ──────────── */
  async getTreasury(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT
        FORMAT(created_at, 'yyyy-MM') AS month,
        SUM(CASE WHEN type='ENTRY' THEN amount ELSE -amount END) AS amount
      FROM [${s}].[cash_movements]
      WHERE created_at >= DATEADD(MONTH, -11, CAST(CAST(YEAR(GETDATE()) AS VARCHAR) + '-' + RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR),2) + '-01' AS DATE))
      GROUP BY FORMAT(created_at, 'yyyy-MM')
      ORDER BY month
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({ month: r.month, amount: Number(r.amount) })),
    );
  }

  /* ── Monthly comparison (/dashboard/monthly-comparison) */
  async getMonthlyComparison(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT m.month,
        COALESCE(e.total, 0) AS expenses,
        COALESCE(sv.total, 0) AS revenue
      FROM (
        SELECT FORMAT(DATEADD(MONTH, -n, GETDATE()), 'yyyy-MM') AS month
        FROM (VALUES (0),(1),(2),(3),(4),(5)) AS t(n)
      ) m
      LEFT JOIN (
        SELECT FORMAT([date], 'yyyy-MM') AS month, SUM(amount) AS total
        FROM [${s}].[expenses] WHERE status NOT IN ('CANCELLED','REJECTED')
        GROUP BY FORMAT([date], 'yyyy-MM')
      ) e ON e.month = m.month
      LEFT JOIN (
        SELECT FORMAT(created_at, 'yyyy-MM') AS month, SUM(total) AS total
        FROM [${s}].[sales] WHERE status != 'CANCELLED'
        GROUP BY FORMAT(created_at, 'yyyy-MM')
      ) sv ON sv.month = m.month
      ORDER BY m.month
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({
        month: r.month,
        expenses: Number(r.expenses),
        revenue: Number(r.revenue),
      })),
    );
  }

  /* ── Expense categories breakdown (/dashboard/expense-categories) */
  async getExpenseCategories(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT c.name, COALESCE(SUM(e.amount), 0) AS value
      FROM [${s}].[expense_categories] c
      LEFT JOIN [${s}].[expenses] e ON e.category_id = c.id
        AND MONTH(e.[date]) = MONTH(GETDATE()) AND YEAR(e.[date]) = YEAR(GETDATE())
        AND e.status NOT IN ('CANCELLED','REJECTED')
      WHERE c.is_active = 1
      GROUP BY c.name
      ORDER BY value DESC
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({ name: r.name, value: Number(r.value) })),
    );
  }

  /* ── Top clients (/dashboard/top-clients) ──────────── */
  async getTopClients(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT TOP 5 c.id AS clientId, c.name AS clientName, COALESCE(SUM(sv.total), 0) AS revenue
      FROM [${s}].[clients] c
      LEFT JOIN [${s}].[sales] sv ON sv.client_id = c.id AND sv.status != 'CANCELLED'
      WHERE c.is_active = 1
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({
        clientId: r.clientId,
        clientName: r.clientName,
        revenue: Number(r.revenue),
      })),
    );
  }

  /* ── Expense module KPIs (/dashboard/expense/kpis) ─── */
  async getExpenseKpis(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const thisMonth = new Date().getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [row] = await ds.query(
      `
      SELECT
        COALESCE((SELECT SUM(amount) FROM [${s}].[expenses] WHERE MONTH([date])=@0 AND YEAR([date])=@1 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS totalExpenses,
        COALESCE((SELECT COUNT(*) FROM [${s}].[expenses] WHERE status = 'PENDING'), 0) AS pendingApprovals,
        COALESCE((SELECT COUNT(*) FROM [${s}].[expenses] WHERE status = 'APPROVED_L2' AND DATEDIFF(DAY, [date], GETDATE()) > 30), 0) AS overduePayments,
        COALESCE((SELECT SUM(amount) FROM [${s}].[expenses] WHERE MONTH([date])=@2 AND YEAR([date])=@3 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS prevTotal,
        COALESCE((SELECT COUNT(*) FROM [${s}].[expenses] WHERE status = 'PENDING' AND MONTH([date])=@2 AND YEAR([date])=@3), 0) AS prevPending
    `,
      [thisMonth, thisYear, lastMonth, lastYear],
    );

    const trend = (cur: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

    return this.wrap({
      totalExpenses: Number(row.totalExpenses),
      pendingApprovals: Number(row.pendingApprovals),
      overduePayments: Number(row.overduePayments),
      totalExpensesTrend: trend(Number(row.totalExpenses), Number(row.prevTotal)),
      pendingTrend: trend(Number(row.pendingApprovals), Number(row.prevPending)),
      overdueTrend: 0,
    });
  }

  /* ── Expense monthly trend (/dashboard/expense/monthly-trend) */
  async getExpenseMonthlyTrend(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT FORMAT([date], 'yyyy-MM') AS month, SUM(amount) AS amount
      FROM [${s}].[expenses]
      WHERE status NOT IN ('CANCELLED','REJECTED')
        AND [date] >= DATEADD(MONTH, -11, CAST(CAST(YEAR(GETDATE()) AS VARCHAR) + '-' + RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR),2) + '-01' AS DATE))
      GROUP BY FORMAT([date], 'yyyy-MM')
      ORDER BY month
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({ month: r.month, amount: Number(r.amount) })),
    );
  }

  /* ── Recent expenses (/dashboard/expense/recent) ───── */
  async getRecentExpenses(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const s = tenantSchema(tenantId);
    const rows = await ds.query(`
      SELECT TOP 10 e.id, e.reference, e.[date], e.amount, c.name AS categoryName, e.status, e.beneficiary
      FROM [${s}].[expenses] e
      LEFT JOIN [${s}].[expense_categories] c ON c.id = e.category_id
      ORDER BY e.created_at DESC
    `);
    return this.wrap(
      rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        reference: r.reference,
        date: r.date,
        amount: Number(r.amount),
        categoryName: r.categoryName,
        status: r.status,
        beneficiary: r.beneficiary || null,
      })),
    );
  }
}
