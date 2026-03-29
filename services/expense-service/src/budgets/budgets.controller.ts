import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { Permissions } from '../common/decorators';
import { CurrentUser } from '../common/decorators';
import { BUDGET_PERMISSIONS } from '../common/permissions';
import { CreateBudgetDto, UpdateBudgetDto } from './dto';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('consumption')
  @Permissions(BUDGET_PERMISSIONS.READ)
  getConsumption(@Query('categoryId') categoryId?: string) {
    return this.budgetsService.getConsumption(categoryId);
  }

  @Get()
  @Permissions(BUDGET_PERMISSIONS.READ)
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('active') active?: string,
  ) {
    return this.budgetsService.findAll({
      categoryId,
      departmentId,
      active: active === 'true',
    });
  }

  @Get(':id')
  @Permissions(BUDGET_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.budgetsService.findById(id);
  }

  @Post()
  @Permissions(BUDGET_PERMISSIONS.CREATE)
  create(@Body() dto: CreateBudgetDto, @CurrentUser('id') userId: string) {
    return this.budgetsService.create(dto, userId);
  }

  @Patch(':id')
  @Permissions(BUDGET_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.budgetsService.update(id, dto, userId);
  }
}
