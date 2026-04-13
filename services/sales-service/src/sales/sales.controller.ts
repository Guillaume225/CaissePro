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
  findAll(@Query() query: ListSalesQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  @Permissions(SALE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findById(id);
  }

  @Post()
  @Permissions(SALE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: SalesUser) {
    return this.salesService.create(dto, user);
  }

  @Patch(':id')
  @Permissions(SALE_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSaleDto,
    @CurrentUser() user: SalesUser,
  ) {
    return this.salesService.update(id, dto, user);
  }

  @Post(':id/confirm')
  @Permissions(SALE_PERMISSIONS.CONFIRM)
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SalesUser,
  ) {
    return this.salesService.confirm(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(SALE_PERMISSIONS.DELETE)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.salesService.remove(id, userId);
  }
}
