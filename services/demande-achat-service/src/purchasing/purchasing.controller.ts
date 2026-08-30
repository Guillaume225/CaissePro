import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { PurchaseRequestsService, WorkflowUser } from '../purchase-requests/purchase-requests.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { DA_PERMISSIONS } from '../common/permissions';
import { ProcessPurchaseRequestDto, ClosePurchaseRequestDto, PurchasingListQueryDto } from '../purchase-requests/dto';
import { ParseLooseUUIDPipe } from '../common/pipes/parse-loose-uuid.pipe';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly service: PurchaseRequestsService) {}

  /** Requests submitted and awaiting pricing by the service achats. */
  @Get('to-price')
  @Permissions(DA_PERMISSIONS.PROCESS)
  findToPrice(@CurrentUser('tenantId') tenantId: string, @Query() query: PurchasingListQueryDto) {
    return this.service.findToPrice(tenantId, query);
  }

  /** Requests currently mid-circuit, awaiting a validator's decision. */
  @Get('in-circuit')
  @Permissions(DA_PERMISSIONS.PROCESS)
  findInCircuit(@CurrentUser('tenantId') tenantId: string, @Query() query: PurchasingListQueryDto) {
    return this.service.findInCircuit(tenantId, query);
  }

  /** RG08 — list requests owned by purchasing, gated by da.takeover. */
  @Get('to-process')
  @Permissions(DA_PERMISSIONS.TAKEOVER)
  findToProcess(@CurrentUser('tenantId') tenantId: string, @Query() query: PurchasingListQueryDto) {
    return this.service.findToProcess(tenantId, query);
  }

  @Post(':id/takeover')
  @Permissions(DA_PERMISSIONS.TAKEOVER)
  takeover(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser() user: WorkflowUser) {
    return this.service.takeover(user.tenantId, id, user);
  }

  @Post(':id/process')
  @Permissions(DA_PERMISSIONS.PROCESS)
  process(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: ProcessPurchaseRequestDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.process(user.tenantId, id, dto, user);
  }

  @Post(':id/close')
  @Permissions(DA_PERMISSIONS.CLOSE)
  close(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: ClosePurchaseRequestDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.close(user.tenantId, id, dto, user);
  }
}
