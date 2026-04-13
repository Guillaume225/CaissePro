import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private wrap(data: unknown) {
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /* ── Sales KPIs (/dashboard/sales/kpis) ────────────── */
  async getSalesKpis() {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [row] = await this.dataSource.query(`
      SELECT
        COALESCE((SELECT SUM(total_ttc) FROM sales WHERE CAST(created_at AS DATE) = @0 AND status != 'CANCELLED'), 0) AS todayRevenue,
        COALESCE((SELECT SUM(total_ttc) FROM sales WHERE MONTH(created_at)=@1 AND YEAR(created_at)=@2 AND status != 'CANCELLED'), 0) AS monthRevenue,
        COALESCE((SELECT COUNT(*) FROM sales WHERE CAST(created_at AS DATE) = @0 AND status != 'CANCELLED'), 0) AS todaySalesCount,
        COALESCE((
          SELECT CASE WHEN SUM(total_amount) > 0
            THEN ROUND(SUM(paid_amount) * 100.0 / SUM(total_amount), 0) ELSE 100 END
          FROM receivables WHERE MONTH(created_at)=@1 AND YEAR(created_at)=@2
        ), 100) AS collectionRate,
        COALESCE((SELECT SUM(total_ttc) FROM sales WHERE MONTH(created_at)=@3 AND YEAR(created_at)=@4 AND status != 'CANCELLED'), 0) AS prevMonthRevenue,
        COALESCE((SELECT COUNT(*) FROM sales WHERE CAST(created_at AS DATE) = DATEADD(DAY, -1, @0) AND status != 'CANCELLED'), 0) AS yesterdaySalesCount
    `, [today, thisMonth, thisYear, lastMonth, lastYear]);

    const trend = (cur: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

    return this.wrap({
      todayRevenue: Number(row.todayRevenue),
      monthRevenue: Number(row.monthRevenue),
      todaySalesCount: Number(row.todaySalesCount),
      collectionRate: Number(row.collectionRate),
      todayRevenueTrend: 0,
      monthRevenueTrend: trend(Number(row.monthRevenue), Number(row.prevMonthRevenue)),
      salesCountTrend: trend(Number(row.todaySalesCount), Number(row.yesterdaySalesCount)),
      collectionRateTrend: 0,
    });
  }

  /* ── Sales monthly trend (/dashboard/sales/monthly-trend) */
  async getSalesMonthlyTrend() {
    const rows = await this.dataSource.query(`
      SELECT FORMAT(created_at, 'yyyy-MM') AS month, SUM(total_ttc) AS amount
      FROM sales
      WHERE status != 'CANCELLED'
        AND created_at >= DATEADD(MONTH, -11, CAST(CAST(YEAR(GETDATE()) AS VARCHAR) + '-' + RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR),2) + '-01' AS DATE))
      GROUP BY FORMAT(created_at, 'yyyy-MM')
      ORDER BY month
    `);
    return this.wrap(rows.map((r: Record<string, unknown>) => ({ month: r.month, amount: Number(r.amount) })));
  }

  /* ══════════════════════════════════════════════════════════
     FNE Dashboard
     ══════════════════════════════════════════════════════════ */

  async getFneKpis() {
    const thisMonth = new Date().getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [row] = await this.dataSource.query(`
      SELECT
        /* ── This month ── */
        COALESCE((SELECT COUNT(*) FROM fne_invoices WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1), 0) AS monthInvoices,
        COALESCE((SELECT SUM(total_ttc) FROM fne_invoices WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1 AND status IN ('CERTIFIED','CREDIT_NOTE')), 0) AS monthRevenue,
        COALESCE((SELECT COUNT(*) FROM fne_invoices WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1 AND status='CERTIFIED'), 0) AS monthCertified,
        COALESCE((SELECT COUNT(*) FROM fne_invoices WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1 AND status='CREDIT_NOTE'), 0) AS monthCreditNotes,
        COALESCE((SELECT COUNT(*) FROM fne_invoices WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1 AND status='ERROR'), 0) AS monthErrors,
        COALESCE((SELECT COUNT(*) FROM fne_invoices WHERE MONTH(created_at)=@0 AND YEAR(created_at)=@1 AND status='DRAFT'), 0) AS monthDrafts,
        /* ── Last month for trends ── */
        COALESCE((SELECT COUNT(*) FROM fne_invoices WHERE MONTH(created_at)=@2 AND YEAR(created_at)=@3), 0) AS prevMonthInvoices,
        COALESCE((SELECT SUM(total_ttc) FROM fne_invoices WHERE MONTH(created_at)=@2 AND YEAR(created_at)=@3 AND status IN ('CERTIFIED','CREDIT_NOTE')), 0) AS prevMonthRevenue,
        /* ── All time ── */
        COALESCE((SELECT COUNT(*) FROM fne_invoices), 0) AS totalInvoices,
        COALESCE((SELECT SUM(total_ttc) FROM fne_invoices WHERE status IN ('CERTIFIED','CREDIT_NOTE')), 0) AS totalRevenue
    `, [thisMonth, thisYear, lastMonth, lastYear]);

    const trend = (cur: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

    return this.wrap({
      monthInvoices: Number(row.monthInvoices),
      monthRevenue: Number(row.monthRevenue),
      monthCertified: Number(row.monthCertified),
      monthCreditNotes: Number(row.monthCreditNotes),
      monthErrors: Number(row.monthErrors),
      monthDrafts: Number(row.monthDrafts),
      totalInvoices: Number(row.totalInvoices),
      totalRevenue: Number(row.totalRevenue),
      invoicesTrend: trend(Number(row.monthInvoices), Number(row.prevMonthInvoices)),
      revenueTrend: trend(Number(row.monthRevenue), Number(row.prevMonthRevenue)),
    });
  }

  async getFneMonthlyTrend() {
    const rows = await this.dataSource.query(`
      SELECT FORMAT(created_at, 'yyyy-MM') AS month,
             SUM(total_ttc) AS revenue,
             COUNT(*) AS count
      FROM fne_invoices
      WHERE status IN ('CERTIFIED','CREDIT_NOTE')
        AND created_at >= DATEADD(MONTH, -11, CAST(CAST(YEAR(GETDATE()) AS VARCHAR) + '-' + RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR),2) + '-01' AS DATE))
      GROUP BY FORMAT(created_at, 'yyyy-MM')
      ORDER BY month
    `);
    return this.wrap(rows.map((r: Record<string, unknown>) => ({
      month: r.month,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })));
  }

  async getFneTopClients() {
    const rows = await this.dataSource.query(`
      SELECT TOP 5
        client_company_name AS clientName,
        client_phone AS clientPhone,
        COUNT(*) AS invoiceCount,
        SUM(total_ttc) AS revenue
      FROM fne_invoices
      WHERE status IN ('CERTIFIED','CREDIT_NOTE')
      GROUP BY client_company_name, client_phone
      ORDER BY revenue DESC
    `);
    return this.wrap(rows.map((r: Record<string, unknown>) => ({
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      invoiceCount: Number(r.invoiceCount),
      revenue: Number(r.revenue),
    })));
  }

  async getFneStatusBreakdown() {
    const rows = await this.dataSource.query(`
      SELECT status, COUNT(*) AS count
      FROM fne_invoices
      GROUP BY status
    `);
    return this.wrap(rows.map((r: Record<string, unknown>) => ({
      status: r.status as string,
      count: Number(r.count),
    })));
  }
}
