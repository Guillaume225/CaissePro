import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../common/decorators';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('sales/kpis')
  getSalesKpis(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getSalesKpis(tenantId);
  }

  @Get('sales/monthly-trend')
  getSalesMonthlyTrend(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getSalesMonthlyTrend(tenantId);
  }

  @Get('fne/kpis')
  getFneKpis(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getFneKpis(tenantId);
  }

  @Get('fne/monthly-trend')
  getFneMonthlyTrend(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getFneMonthlyTrend(tenantId);
  }

  @Get('fne/top-clients')
  getFneTopClients(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getFneTopClients(tenantId);
  }

  @Get('fne/status-breakdown')
  getFneStatusBreakdown(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getFneStatusBreakdown(tenantId);
  }
}
