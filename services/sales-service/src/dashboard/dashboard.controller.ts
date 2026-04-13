import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('sales/kpis')
  getSalesKpis() {
    return this.dashboardService.getSalesKpis();
  }

  @Get('sales/monthly-trend')
  getSalesMonthlyTrend() {
    return this.dashboardService.getSalesMonthlyTrend();
  }

  @Get('fne/kpis')
  getFneKpis() {
    return this.dashboardService.getFneKpis();
  }

  @Get('fne/monthly-trend')
  getFneMonthlyTrend() {
    return this.dashboardService.getFneMonthlyTrend();
  }

  @Get('fne/top-clients')
  getFneTopClients() {
    return this.dashboardService.getFneTopClients();
  }

  @Get('fne/status-breakdown')
  getFneStatusBreakdown() {
    return this.dashboardService.getFneStatusBreakdown();
  }
}
