import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { PAYMENT_PERMISSIONS } from '../common/permissions';
import { CreatePaymentDto } from '../sales/dto';
import { ListPaymentsQueryDto } from './dto';
import { CashClosingRequiredGuard } from '../cash-closing/guards/cash-closing-required.guard';

@Controller('payments')
@UseGuards(CashClosingRequiredGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Permissions(PAYMENT_PERMISSIONS.READ)
  findAll(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get(':id')
  @Permissions(PAYMENT_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findById(id);
  }

  @Post()
  @Permissions(PAYMENT_PERMISSIONS.CREATE)
  create(@Body() dto: CreatePaymentDto, @CurrentUser('id') userId: string) {
    return this.paymentsService.create(dto, userId);
  }
}
