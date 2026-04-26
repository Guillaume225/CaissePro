import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { DisbursementRequestStatus } from '../entities/enums';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class DisbursementRequestsService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  private repo(tenantId: string) {
    return this.tenantDsService
      .getDataSource(tenantId)
      .then((ds) => ds.getRepository(DisbursementRequest));
  }

  async findAll(tenantId: string, status?: DisbursementRequestStatus): Promise<DisbursementRequest[]> {
    const repo = await this.repo(tenantId);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findPending(tenantId: string): Promise<DisbursementRequest[]> {
    const repo = await this.repo(tenantId);
    return repo.find({
      where: { status: In([DisbursementRequestStatus.PENDING, DisbursementRequestStatus.APPROVED]) },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<DisbursementRequest> {
    const repo = await this.repo(tenantId);
    const req = await repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Disbursement request not found');
    return req;
  }

  async trackByReference(reference: string, tenantId: string): Promise<DisbursementRequest | null> {
    const repo = await this.repo(tenantId);
    return repo.findOne({ where: { reference } });
  }

  async findByMatricule(matricule: string, tenantId: string): Promise<DisbursementRequest[]> {
    const repo = await this.repo(tenantId);
    return repo.find({ where: { matricule }, order: { createdAt: 'DESC' } });
  }

  async create(
    tenantId: string,
    dto: {
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
  ): Promise<DisbursementRequest> {
    const repo = await this.repo(tenantId);
    const entity = repo.create({
      reference: '',
      lastName: dto.lastName,
      firstName: dto.firstName,
      position: dto.position ?? null,
      service: dto.service ?? null,
      phone: dto.phone ?? null,
      matricule: dto.matricule ?? null,
      email: dto.email ?? null,
      amount: dto.amount,
      reason: dto.reason,
      status: DisbursementRequestStatus.PENDING,
    });
    const saved = await repo.save(entity);
    return repo.findOneOrFail({ where: { id: saved.id } });
  }

  async approve(id: string, tenantId: string, userId: string): Promise<DisbursementRequest> {
    const repo = await this.repo(tenantId);
    const req = await this.findOne(id, tenantId);
    req.status = DisbursementRequestStatus.APPROVED;
    req.processedById = userId;
    return repo.save(req);
  }

  async reject(id: string, tenantId: string, userId: string, comment?: string): Promise<DisbursementRequest> {
    const repo = await this.repo(tenantId);
    const req = await this.findOne(id, tenantId);
    req.status = DisbursementRequestStatus.REJECTED;
    req.processedById = userId;
    if (comment) req.comment = comment;
    return repo.save(req);
  }

  async markProcessed(
    id: string,
    tenantId: string,
    userId: string,
    linkedExpenseId?: string,
  ): Promise<DisbursementRequest> {
    const repo = await this.repo(tenantId);
    const req = await this.findOne(id, tenantId);
    if (req.status !== DisbursementRequestStatus.APPROVED) {
      throw new BadRequestException(
        `Cette demande ne peut pas être traitée (statut actuel : ${req.status}). Seules les demandes approuvées peuvent être traitées.`,
      );
    }
    req.status = DisbursementRequestStatus.VALIDATING;
    req.processedById = userId;
    if (linkedExpenseId) req.linkedExpenseId = linkedExpenseId;
    return repo.save(req);
  }

  async markValidated(linkedExpenseId: string, tenantId: string): Promise<void> {
    const repo = await this.repo(tenantId);
    const req = await repo.findOne({ where: { linkedExpenseId } });
    if (req && req.status === DisbursementRequestStatus.VALIDATING) {
      req.status = DisbursementRequestStatus.VALIDATED;
      await repo.save(req);
    }
  }
}
