import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateDepartmentDto, UpdateDepartmentDto, CreateServiceDto, UpdateServiceDto } from './dto';
import { CurrentUser, Permissions } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Permissions(PERMISSIONS.USER_READ)
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.organizationService.findAllDepartments(tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @Permissions(PERMISSIONS.USER_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDepartmentDto, @CurrentUser('tenantId') tenantId: string) {
    const data = await this.organizationService.createDepartment(dto, tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const data = await this.organizationService.updateDepartment(id, dto, tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('tenantId') tenantId: string) {
    await this.organizationService.removeDepartment(id, tenantId);
  }
}

@Controller('services')
export class ServicesController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Permissions(PERMISSIONS.USER_READ)
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.organizationService.findAllServices(tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @Permissions(PERMISSIONS.USER_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateServiceDto, @CurrentUser('tenantId') tenantId: string) {
    const data = await this.organizationService.createService(dto, tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const data = await this.organizationService.updateService(id, dto, tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('tenantId') tenantId: string) {
    await this.organizationService.removeService(id, tenantId);
  }
}
