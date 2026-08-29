import { Controller, Get } from '@nestjs/common';
import { Permissions, CurrentUser } from '../common/decorators';
import { DA_PERMISSIONS } from '../common/permissions';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Permissions(DA_PERMISSIONS.VIEW_REPORT)
  getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getStats(tenantId);
  }
}
