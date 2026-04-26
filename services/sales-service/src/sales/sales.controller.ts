import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SalesService, SalesUser } from './sales.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { SALE_PERMISSIONS } from '../common/permissions';
import { CreateSaleDto, UpdateSaleDto, ListSalesQueryDto } from './dto';
import { CashClosingRequiredGuard } from '../cash-closing/guards/cash-closing-required.guard';

@Controller('sales')
@UseGuards(CashClosingRequiredGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Permissions(SALE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListSalesQueryDto) {
    return this.salesService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(SALE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findById(tenantId, id);
  }

  @Post()
  @Permissions(SALE_PERMISSIONS.CREATE)
  create(@CurrentUser() user: SalesUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.tenantId, dto, user);
  }

  @Patch(':id')
  @Permissions(SALE_PERMISSIONS.UPDATE)
  update(
    @CurrentUser() user: SalesUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.salesService.update(user.tenantId, id, dto, user);
  }

  @Post(':id/confirm')
  @Permissions(SALE_PERMISSIONS.CONFIRM)
  confirm(@CurrentUser() user: SalesUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.confirm(user.tenantId, id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(SALE_PERMISSIONS.DELETE)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.salesService.remove(tenantId, id, userId);
  }
}
