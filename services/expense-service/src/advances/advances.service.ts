import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Advance } from '../entities/advance.entity';
import { AdvanceStatus } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateAdvanceDto, UpdateAdvanceDto, JustifyAdvanceDto, ListAdvancesQueryDto } from './dto';

@Injectable()
export class AdvancesService {
  private readonly logger = new Logger(AdvancesService.name);

  constructor(
    @InjectRepository(Advance)
    private readonly advanceRepo: Repository<Advance>,
    private readonly auditService: AuditService,
  ) {}

  /* ─── FindAll with pagination ─── */
  async findAll(query: ListAdvancesQueryDto) {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = this.advanceRepo.createQueryBuilder('a');

    if (query.employeeId) qb.andWhere('a.employee_id = :empId', { empId: query.employeeId });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.dateFrom) qb.andWhere('a.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('a.created_at <= :dateTo', { dateTo: query.dateTo });

    qb.orderBy('a.createdAt', 'DESC');
    qb.skip((page - 1) * perPage).take(perPage);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((a) => this.toResponseDto(a)),
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

  /* ─── FindById ─── */
  async findById(id: string) {
    const advance = await this.advanceRepo.findOne({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');
    return this.toResponseDto(advance);
  }

  /* ─── Create ─── */
  async create(dto: CreateAdvanceDto, userId: string) {
    const data: Partial<Advance> = {
      employeeId: dto.employeeId,
      amount: dto.amount,
      reason: dto.reason,
      justifiedAmount: 0,
      status: AdvanceStatus.PENDING,
      dueDate: dto.dueDate || null,
      justificationDeadline: dto.justificationDeadline || null,
    };
    const advance = this.advanceRepo.create(data);

    const saved = await this.advanceRepo.save(advance);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'advance',
      entityId: saved.id,
      newValue: {
        employeeId: dto.employeeId,
        amount: dto.amount,
        reason: dto.reason,
      },
    });

    return this.findById(saved.id);
  }

  /* ─── Update ─── */
  async update(id: string, dto: UpdateAdvanceDto, userId: string) {
    const advance = await this.advanceRepo.findOne({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');

    if (advance.status !== AdvanceStatus.PENDING) {
      throw new BadRequestException('Only PENDING advances can be updated');
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(dto) as (keyof UpdateAdvanceDto)[]) {
      if (dto[key] !== undefined) {
        oldValue[key] = (advance as unknown as Record<string, unknown>)[key];
        newValue[key] = dto[key];
      }
    }

    Object.assign(advance, dto);
    await this.advanceRepo.save(advance);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'advance',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(id);
  }

  /* ─── Justify (partial or total) ─── */
  async justify(id: string, dto: JustifyAdvanceDto, userId: string) {
    const advance = await this.advanceRepo.findOne({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');

    if (advance.status !== AdvanceStatus.PENDING && advance.status !== AdvanceStatus.PARTIAL) {
      throw new BadRequestException('Advance is not in a justifiable state');
    }

    const newJustified = Number(advance.justifiedAmount) + dto.justifiedAmount;
    if (newJustified > Number(advance.amount)) {
      throw new BadRequestException(
        `Justified amount (${newJustified}) exceeds advance amount (${advance.amount})`,
      );
    }

    const oldJustified = Number(advance.justifiedAmount);
    advance.justifiedAmount = newJustified;

    if (newJustified >= Number(advance.amount)) {
      advance.status = AdvanceStatus.JUSTIFIED;
    } else {
      advance.status = AdvanceStatus.PARTIAL;
    }

    await this.advanceRepo.save(advance);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'advance',
      entityId: id,
      oldValue: { justifiedAmount: oldJustified, status: advance.status },
      newValue: {
        justifiedAmount: newJustified,
        status: advance.status,
        note: dto.justificationNote,
      },
    });

    return this.findById(id);
  }

  /* ─── Check overdue advances ─── */
  async checkOverdue(): Promise<number> {
    const now = new Date().toISOString().split('T')[0];
    const result = await this.advanceRepo
      .createQueryBuilder('a')
      .update()
      .set({ status: AdvanceStatus.OVERDUE })
      .where('status IN (:...statuses)', {
        statuses: [AdvanceStatus.PENDING, AdvanceStatus.PARTIAL],
      })
      .andWhere('justification_deadline < :now', { now })
      .execute();

    const count = result.affected || 0;
    if (count > 0) {
      this.logger.warn(`Marked ${count} advance(s) as OVERDUE`);
    }
    return count;
  }

  /* ─── Response mapper ─── */
  private toResponseDto(a: Advance) {
    const amount = Number(a.amount);
    const justified = Number(a.justifiedAmount);

    return {
      id: a.id,
      employeeId: a.employeeId,
      amount,
      justifiedAmount: justified,
      remainingAmount: amount - justified,
      status: a.status,
      reason: a.reason,
      dueDate: a.dueDate,
      justificationDeadline: a.justificationDeadline,
      createdAt: a.createdAt?.toISOString(),
      updatedAt: a.updatedAt?.toISOString(),
    };
  }
}
