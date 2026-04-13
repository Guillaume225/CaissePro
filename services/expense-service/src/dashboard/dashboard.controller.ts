import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../common/decorators';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @Permissions('expense.read')
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Get('treasury')
  @Permissions('expense.read')
  getTreasury() {
    return this.dashboardService.getTreasury();
  }

  @Get('monthly-comparison')
  @Permissions('expense.read')
  getMonthlyComparison() {
    return this.dashboardService.getMonthlyComparison();
  }

  @Get('expense-categories')
  @Permissions('expense.read')
  getExpenseCategories() {
    return this.dashboardService.getExpenseCategories();
  }

  @Get('top-clients')
  @Permissions('expense.read')
  getTopClients() {
    return this.dashboardService.getTopClients();
  }

  @Get('expense/kpis')
  @Permissions('expense.read')
  getExpenseKpis() {
    return this.dashboardService.getExpenseKpis();
  }

  @Get('expense/monthly-trend')
  @Permissions('expense.read')
  getExpenseMonthlyTrend() {
    return this.dashboardService.getExpenseMonthlyTrend();
  }

  @Get('expense/recent')
  @Permissions('expense.read')
  getRecentExpenses() {
    return this.dashboardService.getRecentExpenses();
  }
}
