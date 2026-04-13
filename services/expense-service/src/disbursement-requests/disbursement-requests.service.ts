import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { DisbursementRequestStatus } from '../entities/enums';

@Injectable()
export class DisbursementRequestsService {
  constructor(
    @InjectRepository(DisbursementRequest)
    private readonly repo: Repository<DisbursementRequest>,
  ) {}

  /** List all requests for a tenant, optionally filtered by status */
  async findAll(
    tenantId: string,
    status?: DisbursementRequestStatus,
  ): Promise<DisbursementRequest[]> {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  /** List actionable requests (PENDING + APPROVED) — excludes VALIDATING, VALIDATED, REJECTED */
  async findPending(tenantId: string): Promise<DisbursementRequest[]> {
    return this.repo.find({
      where: {
        tenantId,
        status: In([DisbursementRequestStatus.PENDING, DisbursementRequestStatus.APPROVED]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Find one by ID */
  async findOne(id: string, tenantId: string): Promise<DisbursementRequest> {
    const req = await this.repo.findOne({ where: { id, tenantId } });
    if (!req) throw new NotFoundException('Disbursement request not found');
    return req;
  }

  /** Track by reference (public — no auth needed) */
  async trackByReference(reference: string): Promise<DisbursementRequest | null> {
    return this.repo.findOne({ where: { reference } });
  }

  /** Find all requests for a given matricule (public — employee portal) */
  async findByMatricule(matricule: string): Promise<DisbursementRequest[]> {
    return this.repo.find({
      where: { matricule },
      order: { createdAt: 'DESC' },
    });
  }

  /** Create a new request (from employee portal) */
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
    const entity = this.repo.create({
      tenantId,
      reference: '', // trigger will auto-generate
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
    const saved = await this.repo.save(entity);
    // Reload to get trigger-generated reference
    return this.repo.findOneOrFail({ where: { id: saved.id } });
  }

  /** Approve a request */
  async approve(id: string, tenantId: string, userId: string): Promise<DisbursementRequest> {
    const req = await this.findOne(id, tenantId);
    req.status = DisbursementRequestStatus.APPROVED;
    req.processedById = userId;
    return this.repo.save(req);
  }

  /** Reject a request */
  async reject(
    id: string,
    tenantId: string,
    userId: string,
    comment?: string,
  ): Promise<DisbursementRequest> {
    const req = await this.findOne(id, tenantId);
    req.status = DisbursementRequestStatus.REJECTED;
    req.processedById = userId;
    if (comment) req.comment = comment;
    return this.repo.save(req);
  }

  /** Mark as processed (linked to expense) — sets VALIDATING */
  async markProcessed(
    id: string,
    tenantId: string,
    userId: string,
    linkedExpenseId?: string,
  ): Promise<DisbursementRequest> {
    const req = await this.findOne(id, tenantId);
    if (req.status !== DisbursementRequestStatus.APPROVED) {
      throw new BadRequestException(
        `Cette demande ne peut pas être traitée (statut actuel : ${req.status}). Seules les demandes approuvées peuvent être traitées.`,
      );
    }
    req.status = DisbursementRequestStatus.VALIDATING;
    req.processedById = userId;
    if (linkedExpenseId) req.linkedExpenseId = linkedExpenseId;
    return this.repo.save(req);
  }

  /** Mark as validated — expense completed validation circuit */
  async markValidated(linkedExpenseId: string): Promise<void> {
    const req = await this.repo.findOne({ where: { linkedExpenseId } });
    if (req && req.status === DisbursementRequestStatus.VALIDATING) {
      req.status = DisbursementRequestStatus.VALIDATED;
      await this.repo.save(req);
    }
  }
}
