import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { DisbursementRequestsService } from './disbursement-requests.service';
import { CurrentUser, Public } from '../common/decorators';
import { DisbursementRequestStatus } from '../entities/enums';

interface CashClosingUser {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
}

@Controller('disbursement-requests')
export class DisbursementRequestsController {
  constructor(private readonly service: DisbursementRequestsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: CashClosingUser,
    @Query('status') status?: DisbursementRequestStatus,
  ) {
    const data = await this.service.findAll(user.tenantId, status);
    return { data };
  }

  @Get('pending')
  async findPending(@CurrentUser() user: CashClosingUser) {
    const data = await this.service.findPending(user.tenantId);
    return { data };
  }

  /** Public tracking — requires tenantId query param for schema routing */
  @Public()
  @Get('track/:reference')
  async track(@Param('reference') reference: string, @Query('tenantId') tenantId: string) {
    const data = await this.service.trackByReference(reference, tenantId);
    return { data };
  }

  /** Public employee lookup — requires tenantId query param */
  @Public()
  @Get('my/:matricule')
  async findByMatricule(@Param('matricule') matricule: string, @Query('tenantId') tenantId: string) {
    const data = await this.service.findByMatricule(matricule, tenantId);
    return { data };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CashClosingUser, @Param('id') id: string) {
    const data = await this.service.findOne(id, user.tenantId);
    return { data };
  }

  /** Public create — tenantId must be in body */
  @Public()
  @Post()
  async create(
    @Body()
    dto: {
      tenantId: string;
      lastName: string;
      firstName: string;
      position?: string;
      service?: string;
      phone?: string;
      matricule?: string;
      email?: string;
      amount: number;
      reason: string;
    },
  ) {
    const data = await this.service.create(dto.tenantId, dto);
    return { data };
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: CashClosingUser) {
    const data = await this.service.approve(id, user.tenantId, user.userId);
    return { data };
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: CashClosingUser,
    @Body('comment') comment?: string,
  ) {
    const data = await this.service.reject(id, user.tenantId, user.userId, comment);
    return { data };
  }

  @Patch(':id/process')
  async process(
    @Param('id') id: string,
    @CurrentUser() user: CashClosingUser,
    @Body('linkedExpenseId') linkedExpenseId?: string,
  ) {
    const data = await this.service.markProcessed(id, user.tenantId, user.userId, linkedExpenseId);
    return { data };
  }
}
