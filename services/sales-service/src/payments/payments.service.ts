import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Sale } from '../entities/sale.entity';
import { Receivable } from '../entities/receivable.entity';
import { SaleStatus } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, SalesEvent } from '../events/events.service';
import { CreatePaymentDto } from '../sales/dto';
import { ListPaymentsQueryDto } from './dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  /* ─── Reference generation: REC-YYYY-NNNNN ─── */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;

    const last = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.reference LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.reference', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const num = parseInt(last.reference.replace(prefix, ''), 10);
      seq = num + 1;
    }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /* ─── FindAll with filters ─── */
  async findAll(query: ListPaymentsQueryDto) {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.sale', 'sale')
      .leftJoinAndSelect('p.client', 'client');

    this.applyFilters(qb, query);

    const sortBy = query.sortBy || 'paymentDate';
    const sortOrder = query.sortOrder || 'DESC';
    const allowedSort = ['paymentDate', 'amount', 'reference', 'createdAt'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'paymentDate';
    qb.orderBy(`p.${sortField}`, sortOrder as 'ASC' | 'DESC');

    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((p) => this.toResponseDto(p)),
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
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['sale', 'client'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.toResponseDto(payment);
  }

  /* ─── Record payment ─── */
  async create(dto: CreatePaymentDto, userId: string) {
    const sale = await this.saleRepo.findOne({ where: { id: dto.saleId } });
    if (!sale) throw new NotFoundException('Sale not found');

    if (sale.status === SaleStatus.DRAFT) {
      throw new BadRequestException('Cannot pay a DRAFT sale — confirm it first');
    }
    if (sale.status === SaleStatus.PAID) {
      throw new BadRequestException('Sale is already fully paid');
    }

    const remaining = Number(sale.totalTtc) - Number(sale.amountPaid);
    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds remaining balance (${remaining})`,
      );
    }

    const reference = await this.generateReference();
    const payment = this.paymentRepo.create({
      reference,
      saleId: dto.saleId,
      clientId: sale.clientId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paymentDate: dto.paymentDate,
      checkNumber: dto.checkNumber || null,
      notes: dto.notes || null,
      receivedById: userId,
    });
    const saved = await this.paymentRepo.save(payment);

    // Update sale
    const newAmountPaid = Number(sale.amountPaid) + dto.amount;
    sale.amountPaid = newAmountPaid;

    if (Math.abs(newAmountPaid - Number(sale.totalTtc)) < 0.01) {
      sale.status = SaleStatus.PAID;
    } else {
      sale.status = SaleStatus.PARTIALLY_PAID;
    }
    await this.saleRepo.save(sale);

    // Update receivable if exists
    const receivable = await this.receivableRepo.findOne({ where: { saleId: dto.saleId } });
    if (receivable) {
      receivable.paidAmount = newAmountPaid;
      receivable.outstandingAmount = Number(receivable.totalAmount) - newAmountPaid;
      if (receivable.outstandingAmount <= 0) {
        receivable.isSettled = true;
        receivable.outstandingAmount = 0;
      }
      await this.receivableRepo.save(receivable);
    }

    await this.auditService.log({
      userId,
      action: AuditAction.PAYMENT,
      entityType: 'payment',
      entityId: saved.id,
      newValue: {
        reference,
        saleId: dto.saleId,
        amount: dto.amount,
        saleStatus: sale.status,
      },
    });

    await this.eventsService.publish(SalesEvent.PAYMENT_RECEIVED, {
      paymentId: saved.id,
      saleId: dto.saleId,
      reference,
      amount: dto.amount,
      saleReference: sale.reference,
      newSaleStatus: sale.status,
      receivedById: userId,
    });

    return this.findById(saved.id);
  }

  /* ─── Private helpers ─── */
  private applyFilters(qb: SelectQueryBuilder<Payment>, query: ListPaymentsQueryDto) {
    if (query.saleId) qb.andWhere('p.saleId = :saleId', { saleId: query.saleId });
    if (query.clientId) qb.andWhere('p.clientId = :clientId', { clientId: query.clientId });
    if (query.paymentMethod) qb.andWhere('p.paymentMethod = :pm', { pm: query.paymentMethod });
    if (query.dateFrom) qb.andWhere('p.paymentDate >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('p.paymentDate <= :dateTo', { dateTo: query.dateTo });
    if (query.search) {
      qb.andWhere(
        '(p.reference ILIKE :search OR client.name ILIKE :search OR sale.reference ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
  }

  private toResponseDto(p: Payment) {
    return {
      id: p.id,
      reference: p.reference,
      saleId: p.saleId,
      saleReference: p.sale?.reference || null,
      clientId: p.clientId,
      clientName: p.client?.name || null,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      checkNumber: p.checkNumber,
      notes: p.notes,
      receivedById: p.receivedById,
      createdAt: p.createdAt?.toISOString(),
    };
  }
}
