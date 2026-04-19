import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { SageErpService, ErpPostResult } from './sage-erp.service';
import { ErpSettingsService } from './erp-settings.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('erp')
export class ErpController {
  constructor(
    private readonly sageErpService: SageErpService,
    private readonly erpSettingsService: ErpSettingsService,
  ) {}

  /** Manually post specific invoice entries to ERP */
  @Post('post-entries')
  @Permissions(FNE_PERMISSIONS.CREATE)
  postEntries(
    @Body() dto: { invoiceIds: string[] },
    @CurrentUser('companyId') companyId: string,
  ): Promise<ErpPostResult> {
    return this.sageErpService.postEntries(dto.invoiceIds, companyId);
  }

  /** Post all unposted entries to ERP */
  @Post('post-all')
  @Permissions(FNE_PERMISSIONS.CREATE)
  postAllUnposted(@CurrentUser('companyId') companyId: string): Promise<ErpPostResult> {
    return this.sageErpService.postAllUnposted(companyId);
  }
}
