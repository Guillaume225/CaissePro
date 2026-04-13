import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/kpis')
  getAdminKpis() {
    return this.dashboardService.getAdminKpis();
  }

  @Get('admin/recent-logs')
  getRecentLogs() {
    return this.dashboardService.getRecentLogs();
  }

  @Get('admin/role-distribution')
  getRoleDistribution() {
    return this.dashboardService.getRoleDistribution();
  }

  @Get('admin/hourly-activity')
  getHourlyActivity() {
    return this.dashboardService.getHourlyActivity();
  }
}
