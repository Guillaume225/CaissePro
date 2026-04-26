import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { CashClosingService, CashClosingUser } from './cash-closing.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { CASH_CLOSING_PERMISSIONS } from '../common/permissions';
import { OpenCashClosingDto, CloseCashClosingDto, ListCashClosingsQueryDto } from './dto';

@Controller('cash-closing')
export class CashClosingController {
  constructor(private readonly cashClosingService: CashClosingService) {}

  @Post('open')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  open(@Body() dto: OpenCashClosingDto, @CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.open(dto, user);
  }

  @Get('current')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getCurrent(@CurrentUser('tenantId') tenantId: string) {
    return this.cashClosingService.getCurrent(tenantId);
  }

  @Get('state')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getState(@CurrentUser('tenantId') tenantId: string) {
    return this.cashClosingService.getState(tenantId);
  }

  @Get('operations')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getOperations(@CurrentUser('tenantId') tenantId: string) {
    return this.cashClosingService.getOperations(tenantId);
  }

  @Post('movements')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  addMovement(
    @Body()
    dto: {
      type: string;
      category: string;
      amount: number;
      reference?: string;
      description: string;
    },
    @CurrentUser() user: CashClosingUser,
  ) {
    return this.cashClosingService.addMovement(dto, user);
  }

  @Post('lock')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  lock(@CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.lockForClose(user);
  }

  @Post('unlock')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  unlock(@CurrentUser('tenantId') tenantId: string) {
    return this.cashClosingService.unlock(tenantId);
  }

  @Get('accounting-entries')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getAccountingEntries(
    @CurrentUser('tenantId') tenantId: string,
    @Query('cashDayId') cashDayId?: string,
  ) {
    return this.cashClosingService.getAccountingEntries(tenantId, cashDayId);
  }

  @Post('accounting-entries/process')
  @Permissions(CASH_CLOSING_PERMISSIONS.CLOSE)
  processAccounting(@Body() dto: { cashDayId: string }, @CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.processAccountingEntries(user.tenantId, dto.cashDayId, user);
  }

  @Post('accounting-entries/cancel')
  @Permissions(CASH_CLOSING_PERMISSIONS.CLOSE)
  cancelAccounting(
    @Body() dto: { cashDayId: string },
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.cashClosingService.cancelAccountingProcessing(tenantId, dto.cashDayId);
  }

  @Post('accounting-entries/post-to-sage')
  @Permissions(CASH_CLOSING_PERMISSIONS.CLOSE)
  postToSage(
    @Body() dto: { cashDayId: string },
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.cashClosingService.postAccountingToSage(tenantId, dto.cashDayId);
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

  @Get(':id')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  findOne(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.cashClosingService.findOne(tenantId, id);
  }

  @Get(':id/operations')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getOperationsByDay(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.cashClosingService.getOperationsByDay(tenantId, id);
  }
}
