import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, LoginEmployeeDto } from './dto';
import { CurrentUser, Public } from '../common/decorators';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /** Public — requires ?tenantId= for schema routing */
  @Public()
  @Get('disbursement-limit')
  async getDisbursementLimit(@Query('tenantId') tenantId: string) {
    const maxAmount = await this.employeesService.getDisbursementLimit(tenantId);
    return {
      success: true,
      data: { maxDisbursementAmount: maxAmount },
      timestamp: new Date().toISOString(),
    };
  }

  /** Public employee login — tenantId must be in body */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginEmployeeDto & { tenantId: string }) {
    const data = await this.employeesService.loginByMatricule(dto.tenantId, dto.matricule, dto.email);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get('all')
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.employeesService.findAll(tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  async findById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.employeesService.findById(tenantId, id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateEmployeeDto) {
    const data = await this.employeesService.create(tenantId, dto);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const data = await this.employeesService.update(tenantId, id, dto);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.employeesService.remove(tenantId, id);
  }
}
