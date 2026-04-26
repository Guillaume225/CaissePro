import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../common/decorators';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/kpis')
  getAdminKpis(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getAdminKpis(tenantId);
  }

  @Get('admin/recent-logs')
  getRecentLogs(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getRecentLogs(tenantId);
  }

  @Get('admin/role-distribution')
  getRoleDistribution(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getRoleDistribution(tenantId);
  }

  @Get('admin/hourly-activity')
  getHourlyActivity(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getHourlyActivity(tenantId);
  }
}
