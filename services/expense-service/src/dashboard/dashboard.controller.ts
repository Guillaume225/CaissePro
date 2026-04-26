import { Controller, Get } from '@nestjs/common';
import { Permissions, CurrentUser } from '../common/decorators';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @Permissions('expense.read')
  getKpis(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getKpis(tenantId);
  }

  @Get('treasury')
  @Permissions('expense.read')
  getTreasury(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getTreasury(tenantId);
  }

  @Get('monthly-comparison')
  @Permissions('expense.read')
  getMonthlyComparison(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getMonthlyComparison(tenantId);
  }

  @Get('expense-categories')
  @Permissions('expense.read')
  getExpenseCategories(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getExpenseCategories(tenantId);
  }

  @Get('top-clients')
  @Permissions('expense.read')
  getTopClients(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getTopClients(tenantId);
  }

  @Get('expense/kpis')
  @Permissions('expense.read')
  getExpenseKpis(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getExpenseKpis(tenantId);
  }

  @Get('expense/monthly-trend')
  @Permissions('expense.read')
  getExpenseMonthlyTrend(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getExpenseMonthlyTrend(tenantId);
  }

  @Get('expense/recent')
  @Permissions('expense.read')
  getRecentExpenses(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getRecentExpenses(tenantId);
  }
}
