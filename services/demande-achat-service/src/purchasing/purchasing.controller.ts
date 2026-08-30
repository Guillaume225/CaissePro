import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { PurchaseRequestsService, WorkflowUser } from '../purchase-requests/purchase-requests.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { DA_PERMISSIONS } from '../common/permissions';
import { ProcessPurchaseRequestDto, PurchasingListQueryDto } from '../purchase-requests/dto';
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

  /** TRANSMITTED ("Proposition d'achat") -> PROCESSED ("Bon de commande généré"), en une seule étape. */
  @Post(':id/process')
  @Permissions(DA_PERMISSIONS.PROCESS)
  process(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: ProcessPurchaseRequestDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.process(user.tenantId, id, dto, user);
  }

  /** Renvoie manuellement vers Sage un bon de commande dont l'envoi automatique a échoué. */
  @Post(':id/retry-sage')
  @Permissions(DA_PERMISSIONS.PROCESS)
  retrySage(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.service.retrySage(tenantId, id);
  }
}
