import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CashClosingService, CashClosingUser } from './cash-closing.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { CASH_CLOSING_PERMISSIONS } from '../common/permissions';
import { RequireFeature, RequireLimit } from '../subscription/subscription.decorator';
import { OpenCashClosingDto, CloseCashClosingDto, ListCashClosingsQueryDto } from './dto';

@Controller('cash-closing')
export class CashClosingController {
  constructor(private readonly cashClosingService: CashClosingService) {}

  @Post('open')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  @RequireFeature('caisse')
  @RequireLimit('maxCaisses')
  open(@Body() dto: OpenCashClosingDto, @CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.open(dto, user);
  }

  @Get('current')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getCurrent(@CurrentUser('tenantId') tenantId: string) {
    return this.cashClosingService.getCurrent(tenantId);
  }

  @Post('close')
  @Permissions(CASH_CLOSING_PERMISSIONS.CLOSE)
  close(@Body() dto: CloseCashClosingDto, @CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.close(dto, user);
  }

  @Get('history')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  history(@CurrentUser('tenantId') tenantId: string, @Query() query: ListCashClosingsQueryDto) {
    return this.cashClosingService.findAll(tenantId, query);
  }
}
