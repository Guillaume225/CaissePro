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

  /** GET /disbursement-requests — list all (optional ?status=PENDING) */
  @Get()
  async findAll(
    @CurrentUser() user: CashClosingUser,
    @Query('status') status?: DisbursementRequestStatus,
  ) {
    const data = await this.service.findAll(user.tenantId, status);
    return { data };
  }

  /** GET /disbursement-requests/pending — pending only */
  @Get('pending')
  async findPending(@CurrentUser() user: CashClosingUser) {
    const data = await this.service.findPending(user.tenantId);
    return { data };
  }

  /** GET /disbursement-requests/track/:reference — public tracking */
  @Public()
  @Get('track/:reference')
  async track(@Param('reference') reference: string) {
    const data = await this.service.trackByReference(reference);
    return { data };
  }

  /** GET /disbursement-requests/my/:matricule — public, list employee's own requests */
  @Public()
  @Get('my/:matricule')
  async findByMatricule(@Param('matricule') matricule: string) {
    const data = await this.service.findByMatricule(matricule);
    return { data };
  }

  /** GET /disbursement-requests/:id — single request by ID */
  @Get(':id')
  async findOne(@CurrentUser() user: CashClosingUser, @Param('id') id: string) {
    const data = await this.service.findOne(id, user.tenantId);
    return { data };
  }

  /** POST /disbursement-requests — create (public, from employee portal) */
  @Public()
  @Post()
  async create(
    @Body()
    dto: {
      tenantId?: string;
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
    const tenantId = dto.tenantId || '00000000-0000-4000-a000-000000000001';
    const data = await this.service.create(tenantId, dto);
    return { data };
  }

  /** PATCH /disbursement-requests/:id/approve */
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: CashClosingUser) {
    const data = await this.service.approve(id, user.tenantId, user.userId);
    return { data };
  }

  /** PATCH /disbursement-requests/:id/reject */
  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: CashClosingUser,
    @Body('comment') comment?: string,
  ) {
    const data = await this.service.reject(id, user.tenantId, user.userId, comment);
    return { data };
  }

  /** PATCH /disbursement-requests/:id/process */
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
