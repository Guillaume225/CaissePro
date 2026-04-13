import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private wrap(data: any) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /* ── General KPIs (/dashboard/kpis) ────────────────── */
  async getKpis() {
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [[row]] = await Promise.all([
      this.dataSource.query(`
        SELECT
          COALESCE((SELECT SUM(CASE WHEN type='ENTRY' THEN amount ELSE -amount END) FROM cash_movements), 0) AS cashBalance,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE MONTH([date])=@0 AND YEAR([date])=@1 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS monthExpenses,
          COALESCE((SELECT SUM(total_ttc) FROM sales WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1 AND status != 'CANCELLED'), 0) AS monthRevenue,
          COALESCE((SELECT SUM(outstanding_amount) FROM receivables WHERE is_settled = 0), 0) AS outstandingReceivables,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE MONTH([date])=@2 AND YEAR([date])=@3 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS prevMonthExpenses,
          COALESCE((SELECT SUM(total_ttc) FROM sales WHERE MONTH(created_at)=@2 AND YEAR(created_at)=@3 AND status != 'CANCELLED'), 0) AS prevMonthRevenue
      `, [thisMonth, thisYear, lastMonth, lastYear]),
    ]);

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
  async getTreasury() {
    const rows = await this.dataSource.query(`
      SELECT
        FORMAT(created_at, 'yyyy-MM') AS month,
        SUM(CASE WHEN type='ENTRY' THEN amount ELSE -amount END) AS amount
      FROM cash_movements
      WHERE created_at >= DATEADD(MONTH, -11, CAST(CAST(YEAR(GETDATE()) AS VARCHAR) + '-' + RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR),2) + '-01' AS DATE))
      GROUP BY FORMAT(created_at, 'yyyy-MM')
      ORDER BY month
    `);
    return this.wrap(rows.map((r: any) => ({ month: r.month, amount: Number(r.amount) })));
  }

  /* ── Monthly comparison (/dashboard/monthly-comparison) */
  async getMonthlyComparison() {
    const rows = await this.dataSource.query(`
      SELECT m.month,
        COALESCE(e.total, 0) AS expenses,
        COALESCE(s.total, 0) AS revenue
      FROM (
        SELECT FORMAT(DATEADD(MONTH, -n, GETDATE()), 'yyyy-MM') AS month
        FROM (VALUES (0),(1),(2),(3),(4),(5)) AS t(n)
      ) m
      LEFT JOIN (
        SELECT FORMAT([date], 'yyyy-MM') AS month, SUM(amount) AS total
        FROM expenses WHERE status NOT IN ('CANCELLED','REJECTED')
        GROUP BY FORMAT([date], 'yyyy-MM')
      ) e ON e.month = m.month
      LEFT JOIN (
        SELECT FORMAT(created_at, 'yyyy-MM') AS month, SUM(total_ttc) AS total
        FROM sales WHERE status != 'CANCELLED'
        GROUP BY FORMAT(created_at, 'yyyy-MM')
      ) s ON s.month = m.month
      ORDER BY m.month
    `);
    return this.wrap(rows.map((r: any) => ({
      month: r.month,
      expenses: Number(r.expenses),
      revenue: Number(r.revenue),
    })));
  }

  /* ── Expense categories breakdown (/dashboard/expense-categories) */
  async getExpenseCategories() {
    const rows = await this.dataSource.query(`
      SELECT c.name, COALESCE(SUM(e.amount), 0) AS value
      FROM expense_categories c
      LEFT JOIN expenses e ON e.category_id = c.id
        AND MONTH(e.[date]) = MONTH(GETDATE()) AND YEAR(e.[date]) = YEAR(GETDATE())
        AND e.status NOT IN ('CANCELLED','REJECTED')
      WHERE c.is_active = 1
      GROUP BY c.name
      ORDER BY value DESC
    `);
    return this.wrap(rows.map((r: any) => ({ name: r.name, value: Number(r.value) })));
  }

  /* ── Top clients (/dashboard/top-clients) ──────────── */
  async getTopClients() {
    const rows = await this.dataSource.query(`
      SELECT TOP 5 c.id AS clientId, c.name AS clientName, COALESCE(SUM(s.total_ttc), 0) AS revenue
      FROM clients c
      LEFT JOIN sales s ON s.client_id = c.id AND s.status != 'CANCELLED'
      WHERE c.is_active = 1
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `);
    return this.wrap(rows.map((r: any) => ({
      clientId: r.clientId,
      clientName: r.clientName,
      revenue: Number(r.revenue),
    })));
  }

  /* ── Expense module KPIs (/dashboard/expense/kpis) ─── */
  async getExpenseKpis() {
    const thisMonth = new Date().getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [row] = await this.dataSource.query(`
      SELECT
        COALESCE((SELECT SUM(amount) FROM expenses WHERE MONTH([date])=@0 AND YEAR([date])=@1 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS totalExpenses,
        COALESCE((SELECT COUNT(*) FROM expenses WHERE status = 'PENDING'), 0) AS pendingApprovals,
        COALESCE((SELECT COUNT(*) FROM expenses WHERE status = 'APPROVED_L2' AND DATEDIFF(DAY, [date], GETDATE()) > 30), 0) AS overduePayments,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE MONTH([date])=@2 AND YEAR([date])=@3 AND status NOT IN ('CANCELLED','REJECTED')), 0) AS prevTotal,
        COALESCE((SELECT COUNT(*) FROM expenses WHERE status = 'PENDING' AND MONTH([date])=@2 AND YEAR([date])=@3), 0) AS prevPending
    `, [thisMonth, thisYear, lastMonth, lastYear]);

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
  async getExpenseMonthlyTrend() {
    const rows = await this.dataSource.query(`
      SELECT FORMAT([date], 'yyyy-MM') AS month, SUM(amount) AS amount
      FROM expenses
      WHERE status NOT IN ('CANCELLED','REJECTED')
        AND [date] >= DATEADD(MONTH, -11, CAST(CAST(YEAR(GETDATE()) AS VARCHAR) + '-' + RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR),2) + '-01' AS DATE))
      GROUP BY FORMAT([date], 'yyyy-MM')
      ORDER BY month
    `);
    return this.wrap(rows.map((r: any) => ({ month: r.month, amount: Number(r.amount) })));
  }

  /* ── Recent expenses (/dashboard/expense/recent) ───── */
  async getRecentExpenses() {
    const rows = await this.dataSource.query(`
      SELECT TOP 10 e.id, e.reference, e.[date], e.amount, c.name AS categoryName, e.status, e.beneficiary
      FROM expenses e
      LEFT JOIN expense_categories c ON c.id = e.category_id
      ORDER BY e.created_at DESC
    `);
    return this.wrap(rows.map((r: any) => ({
      id: r.id,
      reference: r.reference,
      date: r.date,
      amount: Number(r.amount),
      categoryName: r.categoryName,
      status: r.status,
      beneficiary: r.beneficiary || null,
    })));
  }
}
