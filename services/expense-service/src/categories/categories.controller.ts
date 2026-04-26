import { Controller, Get, Post, Patch, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { Permissions, CurrentUser } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Permissions(PERMISSIONS.EXPENSE_READ)
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const data = await this.categoriesService.findAll(tenantId, includeInactive === 'true');
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.EXPENSE_READ)
  async findById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.categoriesService.findById(tenantId, id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @Permissions(PERMISSIONS.EXPENSE_CREATE)
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.categoriesService.create(tenantId, dto, userId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.EXPENSE_UPDATE)
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.categoriesService.update(tenantId, id, dto, userId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
