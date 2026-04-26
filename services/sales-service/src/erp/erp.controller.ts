import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { SageErpService, ErpPostResult, RawSageEntry } from './sage-erp.service';
import { ErpSettingsService } from './erp-settings.service';
import { Permissions, CurrentUser, Public } from '../common/decorators';
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
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { invoiceIds: string[] },
    @CurrentUser('companyId') companyId: string,
  ): Promise<ErpPostResult> {
    return this.sageErpService.postEntries(tenantId, dto.invoiceIds, companyId);
  }

  /** Post all unposted entries to ERP */
  @Post('post-all')
  @Permissions(FNE_PERMISSIONS.CREATE)
  postAllUnposted(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('companyId') companyId: string,
  ): Promise<ErpPostResult> {
    return this.sageErpService.postAllUnposted(tenantId, companyId);
  }

  /** Post raw/generic accounting entries (cash closing, expenses, etc.) to Sage */
  @Post('post-cash-entries')
  @Public()
  postCashEntries(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { entries: RawSageEntry[] },
  ): Promise<ErpPostResult> {
    return this.sageErpService.postRawEntries(tenantId, dto.entries);
  }
}
