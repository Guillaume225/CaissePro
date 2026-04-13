import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
} from '@nestjs/common';
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
  getCurrent() {
    return this.cashClosingService.getCurrent();
  }

  @Get('state')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getState() {
    return this.cashClosingService.getState();
  }

  @Get('operations')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getOperations() {
    return this.cashClosingService.getOperations();
  }

  @Post('movements')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  addMovement(@Body() dto: { type: string; category: string; amount: number; reference?: string; description: string }, @CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.addMovement(dto, user);
  }

  @Post('lock')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  lock(@CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.lockForClose(user);
  }

  @Post('unlock')
  @Permissions(CASH_CLOSING_PERMISSIONS.OPEN)
  unlock() {
    return this.cashClosingService.unlock();
  }

  @Get('accounting-entries')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getAccountingEntries(@Query('cashDayId') cashDayId?: string) {
    return this.cashClosingService.getAccountingEntries(cashDayId);
  }

  @Post('accounting-entries/process')
  @Permissions(CASH_CLOSING_PERMISSIONS.CLOSE)
  processAccounting(@Body() dto: { cashDayId: string }, @CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.processAccountingEntries(dto.cashDayId, user);
  }

  @Post('accounting-entries/cancel')
  @Permissions(CASH_CLOSING_PERMISSIONS.CLOSE)
  cancelAccounting(@Body() dto: { cashDayId: string }) {
    return this.cashClosingService.cancelAccountingProcessing(dto.cashDayId);
  }

  @Post('close')
  @Permissions(CASH_CLOSING_PERMISSIONS.CLOSE)
  close(@Body() dto: CloseCashClosingDto, @CurrentUser() user: CashClosingUser) {
    return this.cashClosingService.close(dto, user);
  }

  @Get('history')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  history(@Query() query: ListCashClosingsQueryDto) {
    return this.cashClosingService.findAll(query);
  }

  @Get(':id')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  findOne(@Param('id') id: string) {
    return this.cashClosingService.findOne(id);
  }

  @Get(':id/operations')
  @Permissions(CASH_CLOSING_PERMISSIONS.READ)
  getOperationsByDay(@Param('id') id: string) {
    return this.cashClosingService.getOperationsByDay(id);
  }
}
