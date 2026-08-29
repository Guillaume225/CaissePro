import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { PurchaseRequest } from '../entities/purchase-request.entity';
import { PurchaseRequestLine } from '../entities/purchase-request-line.entity';
import { PurchaseRequestAttachment } from '../entities/purchase-request-attachment.entity';
import { PurchaseRequestApproval } from '../entities/purchase-request-approval.entity';
import { PurchaseRequestHistory } from '../entities/purchase-request-history.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { DA_PERMISSIONS } from '../common/permissions';
import {
  PurchaseRequestPriority,
  PurchaseRequestStatus,
  PurchaseRequestApprovalStatus,
  PurchaseRequestHistoryAction,
  PurchaseRequestDocumentType,
} from '../entities/enums';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';
import { EventsService, DemandeAchatEvent } from '../events/events.service';
import {
  CreatePurchaseRequestDto,
  UpdatePurchaseRequestDto,
  ApprovalActionDto,
  RejectReturnDto,
  CancelPurchaseRequestDto,
  ProcessPurchaseRequestDto,
  ClosePurchaseRequestDto,
  AddCommentDto,
  ListPurchaseRequestsQueryDto,
  PurchasingListQueryDto,
  UpdateLinePricingDto,
} from './dto';

/** Shape produced by JwtStrategy.validate() */
export interface WorkflowUser {
  id: string;
  email: string;
  roleName: string;
  permissions: string[];
  tenantId: string;
  departmentId: string | null;
}

const CANCELLABLE_STATUSES = [
  PurchaseRequestStatus.DRAFT,
  PurchaseRequestStatus.SUBMITTED,
  PurchaseRequestStatus.IN_VALIDATION,
  PurchaseRequestStatus.VALIDATED,
  PurchaseRequestStatus.RETURNED,
];

const PURCHASING_STATUSES = [
  PurchaseRequestStatus.TRANSMITTED,
  PurchaseRequestStatus.TAKEN_OVER,
  PurchaseRequestStatus.IN_PROCESS,
];

/** Informational label only — actual purchasing recipients are resolved by DA_PERMISSIONS.PROCESS, not this name. */
const PURCHASING_ROLE = process.env.PURCHASING_ROLE || 'ACHATS';

@Injectable()
export class PurchaseRequestsService {
  private readonly logger = new Logger(PurchaseRequestsService.name);

  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly eventsService: EventsService,
  ) {}

  /* ─────────────────────────────────────────────────────────── */
  /*  Read                                                        */
  /* ─────────────────────────────────────────────────────────── */

  private async resolveRequesterNames(
    ds: DataSource,
    requests: PurchaseRequest[],
  ): Promise<Map<string, string>> {
    return this.resolveUserNames(ds, requests.map((r) => r.requesterId));
  }

  private async resolveUserNames(ds: DataSource, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))];
    if (uniqueIds.length === 0) return new Map();
    const users = await ds.getRepository(User).find({ where: { id: In(uniqueIds) } });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  }

  /** Active user IDs whose role name matches one of `roleNames`. */
  private async resolveUserIdsByRoleNames(ds: DataSource, roleNames: string[]): Promise<string[]> {
    const uniqueNames = [...new Set(roleNames.filter((n): n is string => !!n))];
    if (uniqueNames.length === 0) return [];
    const roles = await ds.getRepository(Role).find({ where: { name: In(uniqueNames) } });
    if (roles.length === 0) return [];
    const users = await ds
      .getRepository(User)
      .find({ where: { roleId: In(roles.map((r) => r.id)), isActive: true } });
    return users.map((u) => u.id);
  }

  /**
   * Recipient IDs for a set of approval steps: approvers with an explicit
   * `approverId` are used directly, and steps left generic (`approverId`
   * null, resolved by role at approval time) are expanded to every active
   * user currently holding that role.
   */
  private async resolveApproverIds(
    ds: DataSource,
    approvals: PurchaseRequestApproval[],
  ): Promise<string[]> {
    const explicit = approvals.map((a) => a.approverId).filter((v): v is string => !!v);
    const roleNames = approvals.filter((a) => !a.approverId).map((a) => a.role);
    const byRole = await this.resolveUserIdsByRoleNames(ds, roleNames);
    return [...new Set([...explicit, ...byRole])];
  }

  /** Active user IDs entitled to handle purchasing (pricing, take-over, processing). */
  private async resolvePurchasingUserIds(ds: DataSource): Promise<string[]> {
    const roles = await ds.getRepository(Role).find();
    const roleIds = roles.filter((r) => r.permissions.includes(DA_PERMISSIONS.PROCESS)).map((r) => r.id);
    if (roleIds.length === 0) return [];
    const users = await ds.getRepository(User).find({ where: { roleId: In(roleIds), isActive: true } });
    return users.map((u) => u.id);
  }

  async findAll(
    tenantId: string,
    query: ListPurchaseRequestsQueryDto,
    forcedRequesterId?: string,
  ) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = requestRepo.createQueryBuilder('pr');

    if (forcedRequesterId) {
      qb.andWhere('pr.requesterId = :forcedRequesterId', { forcedRequesterId });
    } else if (query.requesterId) {
      qb.andWhere('pr.requesterId = :requesterId', { requesterId: query.requesterId });
    }
    this.applyCommonFilters(qb, query);

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    const allowedSort = ['createdAt', 'desiredDate', 'totalEstimatedAmount', 'status', 'number'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`pr.${sortField}`, sortOrder);

    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();
    const requesterNames = await this.resolveRequesterNames(ds, items);

    return {
      data: items.map((r) => this.toResponseDto(r, [], [], [], [], requesterNames)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: page * perPage < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const request = await ds.getRepository(PurchaseRequest).findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');

    const [lines, attachments, approvals, history] = await Promise.all([
      ds
        .getRepository(PurchaseRequestLine)
        .find({ where: { purchaseRequestId: id }, order: { createdAt: 'ASC' } }),
      ds
        .getRepository(PurchaseRequestAttachment)
        .find({ where: { purchaseRequestId: id }, order: { uploadedAt: 'ASC' } }),
      ds
        .getRepository(PurchaseRequestApproval)
        .find({ where: { purchaseRequestId: id }, order: { cycle: 'ASC', level: 'ASC' } }),
      ds
        .getRepository(PurchaseRequestHistory)
        .find({ where: { purchaseRequestId: id }, order: { createdAt: 'ASC' } }),
    ]);

    const userNames = await this.resolveUserNames(ds, [
      request.requesterId,
      request.takenOverById,
      ...attachments.map((a) => a.uploadedById),
      ...history.map((h) => h.actorId),
    ]);

    return this.toResponseDto(request, lines, attachments, approvals, history, userNames);
  }

  /**
   * Pending approvals actionable by the current user (their role/id matches
   * a PENDING approval row sitting at the request's current level/cycle).
   */
  async findToValidate(tenantId: string, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const approvalRepo = ds.getRepository(PurchaseRequestApproval);
    const requestRepo = ds.getRepository(PurchaseRequest);

    const pending = await approvalRepo.find({
      where: { status: PurchaseRequestApprovalStatus.PENDING },
    });

    const actionable = pending.filter(
      (a) => a.approverId === user.id || (!a.approverId && a.role === user.roleName),
    );
    if (actionable.length === 0) return { data: [], meta: { total: 0 } };

    const requestIds = [...new Set(actionable.map((a) => a.purchaseRequestId))];
    const requests = await requestRepo.find({
      where: { id: In(requestIds), status: PurchaseRequestStatus.IN_VALIDATION },
    });

    const matched = requests.filter(
      (r) =>
        r.createdById !== user.id &&
        actionable.some(
          (a) =>
            a.purchaseRequestId === r.id && a.cycle === r.cycle && a.level === r.currentApprovalLevel,
        ),
    );

    const requesterNames = await this.resolveRequesterNames(ds, matched);

    return {
      data: matched.map((r) => this.toResponseDto(r, [], [], [], [], requesterNames)),
      meta: { total: matched.length },
    };
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Create / Update / Delete                                    */
  /* ─────────────────────────────────────────────────────────── */

  async create(tenantId: string, dto: CreatePurchaseRequestDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const lineRepo = ds.getRepository(PurchaseRequestLine);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const saved = await requestRepo.save(
      requestRepo.create({
        number: null,
        requesterId: user.id,
        service: dto.service,
        department: dto.department,
        subject: dto.subject,
        justification: dto.justification,
        desiredDate: dto.desiredDate,
        priority: dto.priority || PurchaseRequestPriority.NORMAL,
        urgencyReason: dto.urgencyReason || null,
        project: dto.project || null,
        costCenter: dto.costCenter || null,
        budget: dto.budget || null,
        site: dto.site || null,
        generalComment: dto.generalComment || null,
        status: PurchaseRequestStatus.DRAFT,
        totalEstimatedAmount: 0,
        cycle: 1,
        createdById: user.id,
      }),
    );

    if (dto.lines?.length) {
      const total = await this.replaceLines(lineRepo, saved.id, dto.lines);
      saved.totalEstimatedAmount = total;
      await requestRepo.save(saved);
    }

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: saved.id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.CREATED,
        fromStatus: null,
        toStatus: PurchaseRequestStatus.DRAFT,
        comment: null,
      }),
    );

    return this.findById(tenantId, saved.id);
  }

  /** RG03: only the creator can edit, and only while DRAFT or RETURNED. */
  async update(tenantId: string, id: string, dto: UpdatePurchaseRequestDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const lineRepo = ds.getRepository(PurchaseRequestLine);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.createdById !== user.id) {
      throw new ForbiddenException('Only the creator can update this request');
    }
    if (![PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.RETURNED].includes(request.status)) {
      throw new BadRequestException('Only DRAFT or RETURNED requests can be edited');
    }

    if (dto.service !== undefined) request.service = dto.service;
    if (dto.department !== undefined) request.department = dto.department;
    if (dto.subject !== undefined) request.subject = dto.subject;
    if (dto.justification !== undefined) request.justification = dto.justification;
    if (dto.desiredDate !== undefined) request.desiredDate = dto.desiredDate;
    if (dto.project !== undefined) request.project = dto.project || null;
    if (dto.costCenter !== undefined) request.costCenter = dto.costCenter || null;
    if (dto.budget !== undefined) request.budget = dto.budget || null;
    if (dto.site !== undefined) request.site = dto.site || null;
    if (dto.generalComment !== undefined) request.generalComment = dto.generalComment || null;

    const priority = dto.priority ?? request.priority;
    const urgencyReason = dto.urgencyReason !== undefined ? dto.urgencyReason : request.urgencyReason;
    if (priority !== PurchaseRequestPriority.NORMAL && !urgencyReason) {
      throw new BadRequestException('urgencyReason is required when priority is not NORMAL');
    }
    request.priority = priority;
    request.urgencyReason = priority === PurchaseRequestPriority.NORMAL ? urgencyReason || null : urgencyReason;

    if (dto.lines) {
      const total = await this.replaceLines(lineRepo, id, dto.lines);
      request.totalEstimatedAmount = total;
    }

    await requestRepo.save(request);
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string, user: WorkflowUser): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.createdById !== user.id) {
      throw new ForbiddenException('Only the creator can delete this request');
    }
    if (request.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT requests can be deleted');
    }
    await requestRepo.softDelete(id);
  }

  private async replaceLines(
    lineRepo: Repository<PurchaseRequestLine>,
    purchaseRequestId: string,
    lines: CreatePurchaseRequestDto['lines'],
  ): Promise<number> {
    await lineRepo.delete({ purchaseRequestId });
    let total = 0;
    for (const l of lines || []) {
      if (l.isOffCatalog && !l.description) {
        throw new BadRequestException(
          `Line "${l.designation}" is off-catalog and requires a description`,
        );
      }
      // Le prix n'est jamais fourni par le demandeur (réservé au chiffrage
      // par le service achats, cf. updateLinePricing) : toujours 0 ici.
      const unitPrice = Number(l.estimatedUnitPrice) || 0;
      const amount = Number(l.quantity) * unitPrice;
      total += amount;
      await lineRepo.save(
        lineRepo.create({
          purchaseRequestId,
          articleReference: l.articleReference || null,
          designation: l.designation,
          description: l.description || null,
          isOffCatalog: !!l.isOffCatalog,
          quantity: l.quantity,
          unit: l.unit,
          estimatedUnitPrice: unitPrice,
          estimatedAmount: amount,
          desiredDate: l.desiredDate || null,
          comment: l.comment || null,
        }),
      );
    }
    return total;
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Submit (RG01/RG02) — generates the DA number & materializes  */
  /*  the approval circuit inside a single transaction.            */
  /* ─────────────────────────────────────────────────────────── */

  async submit(tenantId: string, id: string, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);

    const result = await ds.transaction(async (manager: EntityManager) => {
      const requestRepo = manager.getRepository(PurchaseRequest);
      const lineRepo = manager.getRepository(PurchaseRequestLine);
      const historyRepo = manager.getRepository(PurchaseRequestHistory);

      const request = await requestRepo.findOne({ where: { id } });
      if (!request) throw new NotFoundException('Purchase request not found');
      if (request.createdById !== user.id) {
        throw new ForbiddenException('Only the creator can submit this request');
      }
      if (![PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.RETURNED].includes(request.status)) {
        throw new BadRequestException('Only DRAFT or RETURNED requests can be submitted');
      }

      // RG02 — required header fields
      const missing: string[] = [];
      if (!request.service) missing.push('service');
      if (!request.department) missing.push('department');
      if (!request.subject) missing.push('subject');
      if (!request.justification) missing.push('justification');
      if (!request.desiredDate) missing.push('desiredDate');
      if (!request.priority) missing.push('priority');
      if (request.priority !== PurchaseRequestPriority.NORMAL && !request.urgencyReason) {
        missing.push('urgencyReason');
      }
      if (missing.length > 0) {
        throw new BadRequestException(`Missing required field(s): ${missing.join(', ')}`);
      }

      // RG01 — at least one line, and off-catalog lines need a description
      const lines = await lineRepo.find({ where: { purchaseRequestId: id } });
      if (lines.length === 0) {
        throw new BadRequestException('At least one line item is required before submission');
      }
      for (const l of lines) {
        if (l.isOffCatalog && !l.description) {
          throw new BadRequestException(
            `Line "${l.designation}" is off-catalog and requires a description`,
          );
        }
      }
      const total = lines.reduce((sum, l) => sum + Number(l.estimatedAmount), 0);

      const fromStatus = request.status;
      const wasReturned = fromStatus === PurchaseRequestStatus.RETURNED;
      const cycle = wasReturned ? request.cycle + 1 : request.cycle;

      // Generate DA-YYYY-NNNNNN once (kept stable across resubmissions)
      let number = request.number;
      if (!number) {
        const year = new Date().getFullYear();
        const prefix = `DA-${year}-`;
        const rows: { maxSeq: number | null }[] = await manager.query(
          `SELECT MAX(CAST(RIGHT([number], 6) AS INT)) AS maxSeq
             FROM [${schema}].[purchase_requests] WITH (UPDLOCK, HOLDLOCK)
            WHERE [number] LIKE @0 AND LEN([number]) = @1`,
          [`${prefix}%`, prefix.length + 6],
        );
        const seq = (rows[0]?.maxSeq ?? 0) + 1;
        number = `${prefix}${String(seq).padStart(6, '0')}`;
      }

      // Le prix est réservé au chiffrage par le service achats (cf.
      // updateLinePricing/submitToCircuit ci-dessous) : le circuit de
      // validation n'est donc PAS sélectionné ici — le montant total n'est
      // pas encore connu. La demande reste en IN_VALIDATION avec
      // currentApprovalLevel = null tant que le chiffrage n'est pas terminé
      // (ce sentinel est le même que celui utilisé après TRANSMITTED, mais
      // sans ambiguïté puisqu'il est toujours interprété avec le statut).
      request.number = number;
      request.cycle = cycle;
      request.totalEstimatedAmount = total;
      request.status = PurchaseRequestStatus.IN_VALIDATION;
      request.currentApprovalLevel = null;
      request.submittedAt = new Date();
      await requestRepo.save(request);

      await historyRepo.save(
        historyRepo.create({
          purchaseRequestId: id,
          actorId: user.id,
          action: PurchaseRequestHistoryAction.SUBMITTED,
          fromStatus,
          toStatus: PurchaseRequestStatus.IN_VALIDATION,
          comment: null,
        }),
      );

      return { request };
    });

    await this.eventsService.publish(
      DemandeAchatEvent.SUBMITTED,
      this.basePayload(tenantId, result.request, { actorId: user.id }),
    );
    await this.eventsService.publish(DemandeAchatEvent.TO_PRICE, {
      ...this.basePayload(tenantId, result.request, { actorId: user.id }),
      purchasingRole: PURCHASING_ROLE,
      purchasingUserIds: await this.resolvePurchasingUserIds(ds),
    });

    return this.findById(tenantId, id);
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Chiffrage (service achats) — avant entrée dans le circuit    */
  /* ─────────────────────────────────────────────────────────── */

  /**
   * Le demandeur ne renseigne que les quantités : le prix de chaque ligne
   * est saisi par le service achats une fois la demande soumise, avant
   * qu'elle n'entre dans le circuit de validation (cf. submitToCircuit).
   * Peut être appelé plusieurs fois (sauvegarde partielle) tant que le
   * chiffrage n'a pas été verrouillé.
   */
  async updateLinePricing(
    tenantId: string,
    id: string,
    dto: UpdateLinePricingDto,
    user: WorkflowUser,
  ) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const lineRepo = ds.getRepository(PurchaseRequestLine);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (
      request.status !== PurchaseRequestStatus.IN_VALIDATION ||
      request.currentApprovalLevel !== null
    ) {
      throw new BadRequestException('This request is not awaiting pricing');
    }

    const lines = await lineRepo.find({ where: { purchaseRequestId: id } });
    const linesById = new Map(lines.map((l) => [l.id, l]));

    for (const priced of dto.lines) {
      const line = linesById.get(priced.lineId);
      if (!line) throw new NotFoundException(`Line ${priced.lineId} not found on this request`);
      line.estimatedUnitPrice = priced.estimatedUnitPrice;
      line.estimatedAmount = Number(line.quantity) * priced.estimatedUnitPrice;
      await lineRepo.save(line);
    }

    const total = [...linesById.values()].reduce((sum, l) => sum + Number(l.estimatedAmount), 0);
    request.totalEstimatedAmount = total;
    await requestRepo.save(request);

    await this.eventsService.publish(
      DemandeAchatEvent.PRICED,
      this.basePayload(tenantId, request, { actorId: user.id }),
    );

    return this.findById(tenantId, id);
  }

  /**
   * Verrouille le chiffrage et fait entrer la demande dans le circuit de
   * validation, sélectionnable maintenant que le montant total est connu.
   * Exige que chaque ligne soit chiffrée et qu'au moins un devis fournisseur
   * soit joint. Reprend la logique de sélection de circuit qui vivait
   * auparavant dans submit() (déplacée ici puisque le montant n'est plus
   * connu à la soumission).
   */
  async submitToCircuit(tenantId: string, id: string, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);

    const result = await ds.transaction(async (manager: EntityManager) => {
      const requestRepo = manager.getRepository(PurchaseRequest);
      const lineRepo = manager.getRepository(PurchaseRequestLine);
      const attachmentRepo = manager.getRepository(PurchaseRequestAttachment);
      const approvalRepo = manager.getRepository(PurchaseRequestApproval);
      const historyRepo = manager.getRepository(PurchaseRequestHistory);

      const request = await requestRepo.findOne({ where: { id } });
      if (!request) throw new NotFoundException('Purchase request not found');
      if (
        request.status !== PurchaseRequestStatus.IN_VALIDATION ||
        request.currentApprovalLevel !== null
      ) {
        throw new BadRequestException('This request is not awaiting pricing');
      }

      const lines = await lineRepo.find({ where: { purchaseRequestId: id } });
      if (lines.length === 0 || lines.some((l) => Number(l.estimatedUnitPrice) <= 0)) {
        throw new BadRequestException(
          'Every line must have a price before entering the validation circuit',
        );
      }

      const attachments = await attachmentRepo.find({ where: { purchaseRequestId: id } });
      const hasQuote = attachments.some(
        (a) =>
          a.documentType === PurchaseRequestDocumentType.DEVIS ||
          a.documentType === PurchaseRequestDocumentType.FACTURE_PROFORMA,
      );
      if (!hasQuote) {
        throw new BadRequestException(
          'At least one supplier quote (devis) must be attached before entering the validation circuit',
        );
      }

      const total = lines.reduce((sum, l) => sum + Number(l.estimatedAmount), 0);

      // Match the active approval circuit by amount range (narrowest / highest min_amount)
      const circuitRows: { id: string }[] = await manager.query(
        `SELECT TOP 1 id
           FROM [${schema}].[purchase_request_approval_circuits]
          WHERE is_active = 1
            AND min_amount <= @0
            AND (max_amount IS NULL OR max_amount >= @0)
          ORDER BY min_amount DESC`,
        [total],
      );
      const circuit = circuitRows[0];

      let steps: { level: number; role: string; approver_id: string | null }[] = [];
      if (circuit) {
        steps = await manager.query(
          `SELECT level, role, approver_id
             FROM [${schema}].[purchase_request_approval_circuit_steps]
            WHERE circuit_id = @0
            ORDER BY level ASC`,
          [circuit.id],
        );
      }

      const createdApprovals: PurchaseRequestApproval[] = [];
      if (steps.length > 0) {
        for (const step of steps) {
          createdApprovals.push(
            await approvalRepo.save(
              approvalRepo.create({
                purchaseRequestId: id,
                circuitId: circuit.id,
                cycle: request.cycle,
                level: step.level,
                role: step.role,
                approverId: step.approver_id,
                status: PurchaseRequestApprovalStatus.PENDING,
              }),
            ),
          );
        }
      } else {
        this.logger.warn(
          `No active approval circuit matched amount=${total} for request ${id} — falling back to a single ADMIN-level approval`,
        );
        createdApprovals.push(
          await approvalRepo.save(
            approvalRepo.create({
              purchaseRequestId: id,
              circuitId: null,
              cycle: request.cycle,
              level: 1,
              role: 'ADMIN',
              approverId: null,
              status: PurchaseRequestApprovalStatus.PENDING,
            }),
          ),
        );
      }

      const minLevel = Math.min(...createdApprovals.map((a) => a.level));

      request.totalEstimatedAmount = total;
      request.currentApprovalLevel = minLevel;
      await requestRepo.save(request);

      await historyRepo.save(
        historyRepo.create({
          purchaseRequestId: id,
          actorId: user.id,
          action: PurchaseRequestHistoryAction.SUBMITTED_TO_CIRCUIT,
          fromStatus: PurchaseRequestStatus.IN_VALIDATION,
          toStatus: PurchaseRequestStatus.IN_VALIDATION,
          comment: null,
        }),
      );

      const firstLevelApprovers = createdApprovals.filter((a) => a.level === minLevel);
      return { request, minLevel, firstLevelApprovers };
    });

    const approverIds = await this.resolveApproverIds(ds, result.firstLevelApprovers);
    await this.eventsService.publish(DemandeAchatEvent.TO_VALIDATE, {
      ...this.basePayload(tenantId, result.request, { actorId: user.id }),
      currentApprovalLevel: result.minLevel,
      approverIds,
      role: result.firstLevelApprovers[0]?.role ?? null,
    });

    return this.findById(tenantId, id);
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Approval engine — generic N-level sequential walker          */
  /* ─────────────────────────────────────────────────────────── */

  async approve(tenantId: string, id: string, dto: ApprovalActionDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const approvalRepo = ds.getRepository(PurchaseRequestApproval);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');

    const approval = await this.resolveApproval(ds, request, user);

    approval.status = PurchaseRequestApprovalStatus.APPROVED;
    approval.actionById = user.id;
    approval.actionAt = new Date();
    approval.comment = dto.comment || null;
    await approvalRepo.save(approval);

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.APPROVED,
        fromStatus: request.status,
        toStatus: request.status,
        comment: dto.comment || null,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.APPROVED,
      this.basePayload(tenantId, request, { actorId: user.id, currentApprovalLevel: approval.level }),
    );

    const pending = await approvalRepo.find({
      where: {
        purchaseRequestId: id,
        cycle: request.cycle,
        status: PurchaseRequestApprovalStatus.PENDING,
      },
      order: { level: 'ASC' },
    });

    if (pending.length > 0) {
      const nextLevel = pending[0].level;
      request.currentApprovalLevel = nextLevel;
      await requestRepo.save(request);

      const nextApprovers = pending.filter((a) => a.level === nextLevel);
      const approverIds = await this.resolveApproverIds(ds, nextApprovers);
      await this.eventsService.publish(DemandeAchatEvent.TO_VALIDATE, {
        ...this.basePayload(tenantId, request, { actorId: user.id }),
        currentApprovalLevel: nextLevel,
        approverIds,
        role: nextApprovers[0]?.role ?? null,
      });
    } else {
      request.status = PurchaseRequestStatus.VALIDATED;
      request.validatedAt = new Date();
      await requestRepo.save(request);
      await historyRepo.save(
        historyRepo.create({
          purchaseRequestId: id,
          actorId: user.id,
          action: PurchaseRequestHistoryAction.VALIDATED,
          fromStatus: PurchaseRequestStatus.IN_VALIDATION,
          toStatus: PurchaseRequestStatus.VALIDATED,
          comment: null,
        }),
      );

      // RG07 — a validated request is automatically transmitted to purchasing
      request.status = PurchaseRequestStatus.TRANSMITTED;
      request.transmittedAt = new Date();
      request.currentApprovalLevel = null;
      await requestRepo.save(request);
      await historyRepo.save(
        historyRepo.create({
          purchaseRequestId: id,
          actorId: user.id,
          action: PurchaseRequestHistoryAction.TRANSMITTED,
          fromStatus: PurchaseRequestStatus.VALIDATED,
          toStatus: PurchaseRequestStatus.TRANSMITTED,
          comment: null,
        }),
      );

      await this.eventsService.publish(
        DemandeAchatEvent.VALIDATED_TRANSMITTED,
        this.basePayload(tenantId, request, {
          actorId: user.id,
          purchasingRole: PURCHASING_ROLE,
          purchasingUserIds: await this.resolvePurchasingUserIds(ds),
        }),
      );
    }

    return this.findById(tenantId, id);
  }

  async reject(tenantId: string, id: string, dto: RejectReturnDto, user: WorkflowUser) {
    if (!dto.motif?.trim()) {
      throw new BadRequestException('A motif/comment is required to reject a request');
    }
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const approvalRepo = ds.getRepository(PurchaseRequestApproval);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');

    const approval = await this.resolveApproval(ds, request, user);

    approval.status = PurchaseRequestApprovalStatus.REJECTED;
    approval.actionById = user.id;
    approval.actionAt = new Date();
    approval.comment = dto.motif;
    await approvalRepo.save(approval);

    const fromStatus = request.status;
    request.status = PurchaseRequestStatus.REJECTED;
    request.currentApprovalLevel = null;
    await requestRepo.save(request);

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.REJECTED,
        fromStatus,
        toStatus: PurchaseRequestStatus.REJECTED,
        comment: dto.motif,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.REJECTED,
      this.basePayload(tenantId, request, { actorId: user.id, comment: dto.motif }),
    );

    return this.findById(tenantId, id);
  }

  async returnToRequester(tenantId: string, id: string, dto: RejectReturnDto, user: WorkflowUser) {
    if (!dto.motif?.trim()) {
      throw new BadRequestException('A motif/comment is required to return a request');
    }
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const approvalRepo = ds.getRepository(PurchaseRequestApproval);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');

    const approval = await this.resolveApproval(ds, request, user);

    approval.status = PurchaseRequestApprovalStatus.RETURNED;
    approval.actionById = user.id;
    approval.actionAt = new Date();
    approval.comment = dto.motif;
    await approvalRepo.save(approval);

    const fromStatus = request.status;
    request.status = PurchaseRequestStatus.RETURNED;
    request.currentApprovalLevel = null;
    await requestRepo.save(request);

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.RETURNED,
        fromStatus,
        toStatus: PurchaseRequestStatus.RETURNED,
        comment: dto.motif,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.RETURNED,
      this.basePayload(tenantId, request, { actorId: user.id, comment: dto.motif }),
    );

    return this.findById(tenantId, id);
  }

  /**
   * Resolves the approval row the calling user is entitled to act on right
   * now: PENDING, at the request's current cycle/level, and matching the
   * user either by explicit approverId or by role (when approverId is
   * unset). Returns 403 for every failure mode, including RG13 (a
   * requester can never act on their own request).
   */
  private async resolveApproval(
    ds: DataSource,
    request: PurchaseRequest,
    user: WorkflowUser,
  ): Promise<PurchaseRequestApproval> {
    if (user.id === request.createdById) {
      throw new ForbiddenException('You cannot validate, reject or return your own request');
    }
    if (request.status !== PurchaseRequestStatus.IN_VALIDATION || request.currentApprovalLevel == null) {
      throw new ForbiddenException('This request is not currently awaiting validation');
    }
    const approvalRepo = ds.getRepository(PurchaseRequestApproval);
    const candidates = await approvalRepo.find({
      where: {
        purchaseRequestId: request.id,
        cycle: request.cycle,
        level: request.currentApprovalLevel,
        status: PurchaseRequestApprovalStatus.PENDING,
      },
    });
    const approval = candidates.find(
      (a) => a.approverId === user.id || (!a.approverId && a.role === user.roleName),
    );
    if (!approval) {
      throw new ForbiddenException('You are not authorized to act on this approval');
    }
    return approval;
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Cancel                                                       */
  /* ─────────────────────────────────────────────────────────── */

  async cancel(tenantId: string, id: string, dto: CancelPurchaseRequestDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException(
        `A request with status ${request.status} can no longer be cancelled`,
      );
    }

    const fromStatus = request.status;
    request.status = PurchaseRequestStatus.CANCELLED;
    request.cancelledAt = new Date();
    request.cancelReason = dto.reason || null;
    request.currentApprovalLevel = null;
    await requestRepo.save(request);

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.CANCELLED,
        fromStatus,
        toStatus: PurchaseRequestStatus.CANCELLED,
        comment: dto.reason || null,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.CANCELLED,
      this.basePayload(tenantId, request, { actorId: user.id, comment: dto.reason || null }),
    );

    return this.findById(tenantId, id);
  }

  /**
   * Réouvre une demande annulée par erreur et la remet au stade chiffrage
   * (comme si elle venait d'être soumise) : le service achats peut corriger
   * les prix / devis et resoumettre au circuit. Les paliers d'approbation
   * laissés par une précédente tentative de soumission au circuit sont
   * purgés pour repartir sur une base propre.
   */
  async reopenToPricing(tenantId: string, id: string, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const approvalRepo = ds.getRepository(PurchaseRequestApproval);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.status !== PurchaseRequestStatus.CANCELLED) {
      throw new BadRequestException('Only a cancelled request can be reopened for pricing');
    }

    await approvalRepo.delete({ purchaseRequestId: id, cycle: request.cycle });

    const fromStatus = request.status;
    request.status = PurchaseRequestStatus.IN_VALIDATION;
    request.currentApprovalLevel = null;
    request.cancelledAt = null;
    request.cancelReason = null;
    await requestRepo.save(request);

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.REOPENED,
        fromStatus,
        toStatus: PurchaseRequestStatus.IN_VALIDATION,
        comment: null,
      }),
    );

    await this.eventsService.publish(DemandeAchatEvent.TO_PRICE, {
      ...this.basePayload(tenantId, request, { actorId: user.id }),
      purchasingRole: PURCHASING_ROLE,
      purchasingUserIds: await this.resolvePurchasingUserIds(ds),
    });

    return this.findById(tenantId, id);
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Purchasing flow                                              */
  /* ─────────────────────────────────────────────────────────── */

  /** Requests submitted and awaiting pricing by the service achats (§ chiffrage). */
  async findToPrice(tenantId: string, query: PurchasingListQueryDto) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = requestRepo
      .createQueryBuilder('pr')
      .where('pr.status = :status', { status: PurchaseRequestStatus.IN_VALIDATION })
      .andWhere('pr.currentApprovalLevel IS NULL');
    this.applyCommonFilters(qb, query, true);

    qb.orderBy('pr.submittedAt', 'ASC');
    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();
    const requesterNames = await this.resolveRequesterNames(ds, items);

    return {
      data: items.map((r) => this.toResponseDto(r, [], [], [], [], requesterNames)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: page * perPage < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findToProcess(tenantId: string, query: PurchasingListQueryDto) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = requestRepo.createQueryBuilder('pr');
    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim());
      qb.andWhere('pr.status IN (:...statuses)', { statuses });
    } else {
      qb.andWhere('pr.status IN (:...statuses)', { statuses: PURCHASING_STATUSES });
    }
    this.applyCommonFilters(qb, query, true);

    qb.orderBy('pr.transmittedAt', 'ASC');
    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();
    const requesterNames = await this.resolveRequesterNames(ds, items);

    return {
      data: items.map((r) => this.toResponseDto(r, [], [], [], [], requesterNames)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: page * perPage < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /** RG08 */
  async takeover(tenantId: string, id: string, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.status !== PurchaseRequestStatus.TRANSMITTED) {
      throw new BadRequestException('Only TRANSMITTED requests can be taken over');
    }

    const fromStatus = request.status;
    request.status = PurchaseRequestStatus.TAKEN_OVER;
    request.takenOverById = user.id;
    request.takenOverAt = new Date();
    await requestRepo.save(request);

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.TAKEN_OVER,
        fromStatus,
        toStatus: PurchaseRequestStatus.TAKEN_OVER,
        comment: null,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.TAKEN_OVER,
      this.basePayload(tenantId, request, { actorId: user.id }),
    );

    return this.findById(tenantId, id);
  }

  async process(tenantId: string, id: string, dto: ProcessPurchaseRequestDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.status !== PurchaseRequestStatus.TAKEN_OVER) {
      throw new BadRequestException('Only TAKEN_OVER requests can be moved to processing');
    }

    const fromStatus = request.status;
    request.status = PurchaseRequestStatus.IN_PROCESS;
    request.processingComment = dto.comment || null;
    request.additionalInfo = dto.additionalInfo || null;
    request.expectedProcessingDate = dto.expectedDate || null;
    request.observation = dto.observation || null;
    await requestRepo.save(request);

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.PROCESSING,
        fromStatus,
        toStatus: PurchaseRequestStatus.IN_PROCESS,
        comment: dto.comment || null,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.PROCESSING,
      this.basePayload(tenantId, request, { actorId: user.id }),
    );

    return this.findById(tenantId, id);
  }

  /** RG09 */
  async close(tenantId: string, id: string, dto: ClosePurchaseRequestDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');
    if (request.status !== PurchaseRequestStatus.IN_PROCESS) {
      throw new BadRequestException('Only IN_PROCESS requests can be closed');
    }

    const now = new Date();

    request.status = PurchaseRequestStatus.PROCESSED;
    request.processedAt = now;
    await requestRepo.save(request);
    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.PROCESSED,
        fromStatus: PurchaseRequestStatus.IN_PROCESS,
        toStatus: PurchaseRequestStatus.PROCESSED,
        comment: null,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.PROCESSED,
      this.basePayload(tenantId, request, { actorId: user.id }),
    );

    request.status = PurchaseRequestStatus.CLOSED;
    request.closedAt = now;
    request.closeComment = dto.comment;
    await requestRepo.save(request);
    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.CLOSED,
        fromStatus: PurchaseRequestStatus.PROCESSED,
        toStatus: PurchaseRequestStatus.CLOSED,
        comment: dto.comment,
      }),
    );
    await this.eventsService.publish(
      DemandeAchatEvent.CLOSED,
      this.basePayload(tenantId, request, { actorId: user.id, comment: dto.comment }),
    );

    return this.findById(tenantId, id);
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Comments (journal + thread — same table as history)          */
  /* ─────────────────────────────────────────────────────────── */

  async addComment(tenantId: string, id: string, dto: AddCommentDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const historyRepo = ds.getRepository(PurchaseRequestHistory);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');

    await historyRepo.save(
      historyRepo.create({
        purchaseRequestId: id,
        actorId: user.id,
        action: PurchaseRequestHistoryAction.COMMENT,
        fromStatus: null,
        toStatus: null,
        comment: dto.message,
      }),
    );

    return this.findById(tenantId, id);
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Attachments                                                  */
  /* ─────────────────────────────────────────────────────────── */

  async addAttachments(
    tenantId: string,
    id: string,
    files: Express.Multer.File[],
    documentType: PurchaseRequestDocumentType | undefined,
    userId: string,
  ) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const requestRepo = ds.getRepository(PurchaseRequest);
    const attachRepo = ds.getRepository(PurchaseRequestAttachment);

    const request = await requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Purchase request not found');

    const currentCount = await attachRepo.count({ where: { purchaseRequestId: id } });
    if (currentCount + files.length > 5) {
      throw new BadRequestException(`Maximum 5 attachments allowed (current: ${currentCount})`);
    }

    const now = new Date();
    const attachments = files.map((f) =>
      attachRepo.create({
        purchaseRequestId: id,
        fileId: f.filename,
        fileName: f.originalname,
        documentType: documentType || PurchaseRequestDocumentType.AUTRE,
        uploadedById: userId,
        uploadedAt: now,
      }),
    );
    await attachRepo.save(attachments);

    return this.findById(tenantId, id);
  }

  async getAttachmentFile(
    tenantId: string,
    id: string,
    attachmentId: string,
  ): Promise<{ path: string; fileName: string }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const attachment = await ds
      .getRepository(PurchaseRequestAttachment)
      .findOne({ where: { id: attachmentId, purchaseRequestId: id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const path = join(uploadDir, attachment.fileId);
    if (!existsSync(path)) throw new NotFoundException('File not found on disk');

    return { path, fileName: attachment.fileName };
  }

  async removeAttachment(tenantId: string, id: string, attachmentId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const attachRepo = ds.getRepository(PurchaseRequestAttachment);

    const attachment = await attachRepo.findOne({ where: { id: attachmentId, purchaseRequestId: id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    await attachRepo.delete({ id: attachmentId });

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    try {
      await unlink(join(uploadDir, attachment.fileId));
    } catch (err) {
      this.logger.warn(`Could not delete attachment file ${attachment.fileId}: ${(err as Error).message}`);
    }

    return this.findById(tenantId, id);
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Helpers                                                      */
  /* ─────────────────────────────────────────────────────────── */

  private applyCommonFilters(
    qb: SelectQueryBuilder<PurchaseRequest>,
    query: ListPurchaseRequestsQueryDto,
    skipStatusFilter = false,
  ) {
    if (!skipStatusFilter && query.status) {
      const statuses = query.status.split(',').map((s) => s.trim());
      if (statuses.length === 1) qb.andWhere('pr.status = :status', { status: statuses[0] });
      else qb.andWhere('pr.status IN (:...statuses)', { statuses });
    }
    if (query.priority) qb.andWhere('pr.priority = :priority', { priority: query.priority });
    if (query.service) qb.andWhere('pr.service = :service', { service: query.service });
    if (skipStatusFilter && query.requesterId) {
      qb.andWhere('pr.requesterId = :requesterId', { requesterId: query.requesterId });
    }
    if (query.dateFrom) qb.andWhere('pr.desiredDate >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('pr.desiredDate <= :dateTo', { dateTo: query.dateTo });
    if (query.amountMin !== undefined)
      qb.andWhere('pr.totalEstimatedAmount >= :amountMin', { amountMin: query.amountMin });
    if (query.amountMax !== undefined)
      qb.andWhere('pr.totalEstimatedAmount <= :amountMax', { amountMax: query.amountMax });
    if (query.search) {
      qb.andWhere('(pr.number LIKE :search OR pr.subject LIKE :search)', {
        search: `%${query.search}%`,
      });
    }
  }

  private basePayload(
    tenantId: string,
    request: PurchaseRequest,
    extra: Record<string, unknown> = {},
  ) {
    return {
      tenantId,
      purchaseRequestId: request.id,
      number: request.number,
      requesterId: request.requesterId,
      currentApprovalLevel: request.currentApprovalLevel,
      amount: Number(request.totalEstimatedAmount),
      subject: request.subject,
      ...extra,
    };
  }

  private toResponseDto(
    request: PurchaseRequest,
    lines: PurchaseRequestLine[] = [],
    attachments: PurchaseRequestAttachment[] = [],
    approvals: PurchaseRequestApproval[] = [],
    history: PurchaseRequestHistory[] = [],
    userNames: Map<string, string> = new Map(),
  ) {
    return {
      id: request.id,
      number: request.number,
      requesterId: request.requesterId,
      requesterName: userNames.get(request.requesterId) ?? null,
      service: request.service,
      department: request.department,
      subject: request.subject,
      justification: request.justification,
      desiredDate: request.desiredDate,
      priority: request.priority,
      urgencyReason: request.urgencyReason,
      project: request.project,
      costCenter: request.costCenter,
      budget: request.budget,
      site: request.site,
      generalComment: request.generalComment,
      status: request.status,
      totalEstimatedAmount: Number(request.totalEstimatedAmount),
      currentApprovalLevel: request.currentApprovalLevel,
      cycle: request.cycle,
      submittedAt: request.submittedAt?.toISOString() || null,
      validatedAt: request.validatedAt?.toISOString() || null,
      transmittedAt: request.transmittedAt?.toISOString() || null,
      takenOverAt: request.takenOverAt?.toISOString() || null,
      takenOverById: request.takenOverById,
      takenOverByName: request.takenOverById ? (userNames.get(request.takenOverById) ?? null) : null,
      processingComment: request.processingComment,
      additionalInfo: request.additionalInfo,
      expectedProcessingDate: request.expectedProcessingDate,
      observation: request.observation,
      processedAt: request.processedAt?.toISOString() || null,
      closedAt: request.closedAt?.toISOString() || null,
      closeComment: request.closeComment,
      cancelledAt: request.cancelledAt?.toISOString() || null,
      cancelReason: request.cancelReason,
      createdById: request.createdById,
      createdAt: request.createdAt?.toISOString(),
      updatedAt: request.updatedAt?.toISOString(),
      lines: lines.map((l) => ({
        id: l.id,
        articleReference: l.articleReference,
        designation: l.designation,
        description: l.description,
        isOffCatalog: l.isOffCatalog,
        quantity: Number(l.quantity),
        unit: l.unit,
        estimatedUnitPrice: Number(l.estimatedUnitPrice),
        estimatedAmount: Number(l.estimatedAmount),
        desiredDate: l.desiredDate,
        comment: l.comment,
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        fileId: a.fileId,
        fileName: a.fileName,
        documentType: a.documentType,
        uploadedById: a.uploadedById,
        uploadedByName: userNames.get(a.uploadedById) ?? null,
        uploadedAt: a.uploadedAt?.toISOString(),
      })),
      approvals: approvals.map((a) => ({
        id: a.id,
        circuitId: a.circuitId,
        cycle: a.cycle,
        level: a.level,
        role: a.role,
        approverId: a.approverId,
        status: a.status,
        actionById: a.actionById,
        actionAt: a.actionAt?.toISOString() || null,
        comment: a.comment,
      })),
      history: history.map((h) => ({
        id: h.id,
        actorId: h.actorId,
        actorName: h.actorId ? (userNames.get(h.actorId) ?? null) : null,
        action: h.action,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        comment: h.comment,
        createdAt: h.createdAt?.toISOString(),
      })),
    };
  }
}
