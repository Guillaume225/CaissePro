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
import { AdvancesService } from './advances.service';
import { Permissions } from '../common/decorators';
import { CurrentUser } from '../common/decorators';
import { EXPENSE_PERMISSIONS } from '../common/permissions';
import { CreateAdvanceDto, UpdateAdvanceDto, JustifyAdvanceDto, ListAdvancesQueryDto } from './dto';

@Controller('advances')
export class AdvancesController {
  constructor(private readonly advancesService: AdvancesService) {}

  @Get()
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findAll(@Query() query: ListAdvancesQueryDto) {
    return this.advancesService.findAll(query);
  }

  @Get(':id')
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.advancesService.findById(id);
  }

  @Post()
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateAdvanceDto, @CurrentUser('id') userId: string) {
    return this.advancesService.create(dto, userId);
  }

  @Patch(':id')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdvanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.advancesService.update(id, dto, userId);
  }

  @Post(':id/justify')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  justify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JustifyAdvanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.advancesService.justify(id, dto, userId);
  }
}
