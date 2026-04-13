import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Product } from '../entities/product.entity';
import { Client } from '../entities/client.entity';
import { Receivable } from '../entities/receivable.entity';
import { SaleStatus, AgingBucket } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, SalesEvent } from '../events/events.service';
import {
  CreateSaleDto,
  UpdateSaleDto,
  ListSalesQueryDto,
  SaleItemDto,
} from './dto';

/** Shape produced by JwtStrategy.validate() */
export interface SalesUser {
  id: string;
  email: string;
  roleName: string;
  permissions: string[];
  departmentId: string | null;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly itemRepo: Repository<SaleItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  /* ─── Reference generation: VTE-YYYY-NNNNN ─── */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VTE-${year}-`;

    const result = await this.saleRepo
      .createQueryBuilder('s')
      .select('MAX(CAST(RIGHT(s.reference, 5) AS INT))', 'maxSeq')
      .where('s.reference LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('LEN(s.reference) = :len', { len: prefix.length + 5 })
      .getRawOne();

    const seq = (result?.maxSeq ?? 0) + 1;
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /* ─── Discount ceiling check ─── */
  private checkDiscountCeiling(discountPct: number, roleName: string): void {
    const ceilings = this.configService.get<Record<string, number>>('sales.discountCeilings') ?? {
      COMMERCIAL: 10,
      MANAGER: 20,
      DAF: 100,
      ADMIN: 100,
    };
    const ceiling = ceilings[roleName];
    if (ceiling === undefined) {
      throw new ForbiddenException(
        `Role ${roleName} is not authorized to apply discounts`,
      );
    }
    if (discountPct > ceiling) {
      throw new ForbiddenException(
        `Discount ${discountPct}% exceeds your ceiling of ${ceiling}% (role: ${roleName})`,
      );
    }
  }

  /* ─── Compute line + totals ─── */
  private computeLineTotals(
    quantity: number,
    unitPrice: number,
    vatRate: number,
    discountPct: number,
  ) {
    const lineTotalHt = quantity * unitPrice * (1 - discountPct / 100);
    const lineVat = lineTotalHt * (vatRate / 100);
    const lineTotalTtc = lineTotalHt + lineVat;
    return {
      lineTotalHt: Math.round(lineTotalHt * 100) / 100,
      lineVat: Math.round(lineVat * 100) / 100,
      lineTotalTtc: Math.round(lineTotalTtc * 100) / 100,
    };
  }

  private computeSaleTotals(
    items: { lineTotalHt: number; lineVat: number }[],
    globalDiscountPct: number,
  ) {
    const subtotalHt = items.reduce((sum, i) => sum + i.lineTotalHt, 0);
    const discountAmount = Math.round(subtotalHt * (globalDiscountPct / 100) * 100) / 100;
    const discountedHt = subtotalHt - discountAmount;
    const totalVat = items.reduce((sum, i) => sum + i.lineVat, 0);
    // Re-calculate VAT on the discounted amount proportionally
    const vatAdjustment = totalVat * (1 - globalDiscountPct / 100);
    const finalVat = Math.round(vatAdjustment * 100) / 100;
    const totalTtc = Math.round((discountedHt + finalVat) * 100) / 100;

    return {
      subtotalHt: Math.round(subtotalHt * 100) / 100,
      discountAmount,
      totalVat: finalVat,
      totalTtc,
    };
  }

  /* ─── FindAll with advanced filters ─── */
  async findAll(query: ListSalesQueryDto) {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = this.saleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.client', 'client')
      .leftJoinAndSelect('s.items', 'items')
      .leftJoinAndSelect('items.product', 'product');

    this.applyFilters(qb, query);

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    const allowedSort = ['date', 'totalTtc', 'reference', 'status', 'createdAt'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`s.${sortField}`, sortOrder as 'ASC' | 'DESC');

    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((s) => this.toResponseDto(s)),
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
    const sale = await this.saleRepo.findOne({
      where: { id },
      relations: ['client', 'items', 'items.product', 'payments', 'receivables'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return this.toResponseDto(sale);
  }

  /* ─── Create ─── */
  async create(dto: CreateSaleDto, user: SalesUser) {
    // Validate client
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');
    if (!client.isActive) throw new BadRequestException('Client is inactive');

    // Global discount check
    const globalDiscountPct = dto.globalDiscountPct || 0;
    if (globalDiscountPct > 0) {
      this.checkDiscountCeiling(globalDiscountPct, user.roleName);
    }

    // Resolve products & build items
    const resolvedItems = await this.resolveItems(dto.items, user.roleName);

    // Compute totals
    const saleTotals = this.computeSaleTotals(resolvedItems, globalDiscountPct);

    // Generate reference
    const reference = await this.generateReference();

    // Create sale
    const sale = this.saleRepo.create({
      reference,
      date: dto.date,
      clientId: dto.clientId,
      status: SaleStatus.DRAFT,
      subtotalHt: saleTotals.subtotalHt,
      discountAmount: saleTotals.discountAmount,
      totalVat: saleTotals.totalVat,
      totalTtc: saleTotals.totalTtc,
      amountPaid: 0,
      globalDiscountPct,
      notes: dto.notes || null,
      createdById: user.id,
      dueDate: dto.dueDate || null,
    });
    const saved = await this.saleRepo.save(sale);

    // Save items
    const itemEntities = resolvedItems.map((ri) =>
      this.itemRepo.create({
        saleId: saved.id,
        productId: ri.productId,
        quantity: ri.quantity,
        unitPrice: ri.unitPrice,
        vatRate: ri.vatRate,
        discountPct: ri.discountPct,
        lineTotalHt: ri.lineTotalHt,
        lineVat: ri.lineVat,
        lineTotalTtc: ri.lineTotalTtc,
      }),
    );
    await this.itemRepo.save(itemEntities);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: 'sale',
      entityId: saved.id,
      newValue: { reference, totalTtc: saleTotals.totalTtc, clientId: dto.clientId },
    });

    await this.eventsService.publish(SalesEvent.SALE_CREATED, {
      saleId: saved.id,
      reference,
      totalTtc: saleTotals.totalTtc,
      clientId: dto.clientId,
      createdById: user.id,
    });

    return this.findById(saved.id);
  }

  /* ─── Update (DRAFT only) ─── */
  async update(id: string, dto: UpdateSaleDto, user: SalesUser) {
    const sale = await this.saleRepo.findOne({ where: { id } });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT sales can be updated');
    }

    const globalDiscountPct = dto.globalDiscountPct ?? Number(sale.globalDiscountPct);
    if (globalDiscountPct > 0) {
      this.checkDiscountCeiling(globalDiscountPct, user.roleName);
    }

    if (dto.items) {
      // Remove old items
      await this.itemRepo.delete({ saleId: id });

      // Resolve new items
      const resolvedItems = await this.resolveItems(dto.items, user.roleName);
      const saleTotals = this.computeSaleTotals(resolvedItems, globalDiscountPct);

      sale.subtotalHt = saleTotals.subtotalHt;
      sale.discountAmount = saleTotals.discountAmount;
      sale.totalVat = saleTotals.totalVat;
      sale.totalTtc = saleTotals.totalTtc;
      sale.globalDiscountPct = globalDiscountPct;

      const itemEntities = resolvedItems.map((ri) =>
        this.itemRepo.create({
          saleId: id,
          productId: ri.productId,
          quantity: ri.quantity,
          unitPrice: ri.unitPrice,
          vatRate: ri.vatRate,
          discountPct: ri.discountPct,
          lineTotalHt: ri.lineTotalHt,
          lineVat: ri.lineVat,
          lineTotalTtc: ri.lineTotalTtc,
        }),
      );
      await this.itemRepo.save(itemEntities);
    } else if (dto.globalDiscountPct !== undefined) {
      // Recalculate with existing items
      const existingItems = await this.itemRepo.find({ where: { saleId: id } });
      const saleTotals = this.computeSaleTotals(
        existingItems.map((i) => ({
          lineTotalHt: Number(i.lineTotalHt),
          lineVat: Number(i.lineVat),
        })),
        globalDiscountPct,
      );
      sale.subtotalHt = saleTotals.subtotalHt;
      sale.discountAmount = saleTotals.discountAmount;
      sale.totalVat = saleTotals.totalVat;
      sale.totalTtc = saleTotals.totalTtc;
      sale.globalDiscountPct = globalDiscountPct;
    }

    if (dto.date) sale.date = dto.date;
    if (dto.notes !== undefined) sale.notes = dto.notes || null;
    if (dto.dueDate !== undefined) sale.dueDate = dto.dueDate || null;

    await this.saleRepo.save(sale);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'sale',
      entityId: id,
      newValue: { totalTtc: Number(sale.totalTtc) },
    });

    return this.findById(id);
  }

  /* ─── Confirm: DRAFT → CONFIRMED ─── */
  async confirm(id: string, user: SalesUser) {
    const sale = await this.saleRepo.findOne({ where: { id } });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT sales can be confirmed');
    }

    sale.status = SaleStatus.CONFIRMED;
    await this.saleRepo.save(sale);

    // Create receivable if dueDate is set
    if (sale.dueDate) {
      const receivable = this.receivableRepo.create({
        saleId: id,
        clientId: sale.clientId,
        totalAmount: sale.totalTtc,
        paidAmount: 0,
        outstandingAmount: sale.totalTtc,
        dueDate: sale.dueDate,
        agingBucket: AgingBucket.CURRENT,
        isSettled: false,
      });
      await this.receivableRepo.save(receivable);
    }

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CONFIRM,
      entityType: 'sale',
      entityId: id,
      oldValue: { status: SaleStatus.DRAFT },
      newValue: { status: SaleStatus.CONFIRMED },
    });

    await this.eventsService.publish(SalesEvent.SALE_CONFIRMED, {
      saleId: id,
      reference: sale.reference,
      totalTtc: Number(sale.totalTtc),
      clientId: sale.clientId,
      confirmedById: user.id,
    });

    return this.findById(id);
  }

  /* ─── Soft Delete (DRAFT only) ─── */
  async remove(id: string, userId: string): Promise<void> {
    const sale = await this.saleRepo.findOne({ where: { id } });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT sales can be deleted');
    }

    await this.itemRepo.delete({ saleId: id });
    await this.saleRepo.softDelete(id);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entityType: 'sale',
      entityId: id,
      oldValue: { reference: sale.reference, totalTtc: Number(sale.totalTtc) },
    });
  }

  /* ─── Private helpers ─── */
  private async resolveItems(
    dtoItems: SaleItemDto[],
    roleName: string,
  ): Promise<
    Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
      discountPct: number;
      lineTotalHt: number;
      lineVat: number;
      lineTotalTtc: number;
    }>
  > {
    const resolved = [];
    for (const item of dtoItems) {
      const product = await this.productRepo.findOne({ where: { id: item.productId } });
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
      if (!product.isActive) throw new BadRequestException(`Product ${product.code} is inactive`);

      const discountPct = item.discountPct || 0;
      if (discountPct > 0) {
        this.checkDiscountCeiling(discountPct, roleName);
      }

      const unitPrice = Number(product.unitPrice);
      const vatRate = Number(product.vatRate);
      const totals = this.computeLineTotals(item.quantity, unitPrice, vatRate, discountPct);

      resolved.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        vatRate,
        discountPct,
        ...totals,
      });
    }
    return resolved;
  }

  private applyFilters(qb: SelectQueryBuilder<Sale>, query: ListSalesQueryDto) {
    if (query.status) qb.andWhere('s.status = :status', { status: query.status });
    if (query.clientId) qb.andWhere('s.clientId = :clientId', { clientId: query.clientId });
    if (query.createdById) qb.andWhere('s.createdById = :uid', { uid: query.createdById });
    if (query.dateFrom) qb.andWhere('s.date >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('s.date <= :dateTo', { dateTo: query.dateTo });
    if (query.amountMin) qb.andWhere('s.totalTtc >= :amountMin', { amountMin: query.amountMin });
    if (query.amountMax) qb.andWhere('s.totalTtc <= :amountMax', { amountMax: query.amountMax });
    if (query.search) {
      qb.andWhere(
        '(s.reference ILIKE :search OR client.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
  }

  private toResponseDto(s: Sale) {
    return {
      id: s.id,
      reference: s.reference,
      date: s.date,
      clientId: s.clientId,
      clientName: s.client?.name || null,
      status: s.status,
      subtotalHt: Number(s.subtotalHt),
      discountAmount: Number(s.discountAmount),
      totalVat: Number(s.totalVat),
      totalTtc: Number(s.totalTtc),
      amountPaid: Number(s.amountPaid),
      globalDiscountPct: Number(s.globalDiscountPct),
      notes: s.notes,
      createdById: s.createdById,
      dueDate: s.dueDate,
      items: (s.items || []).map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name || null,
        productCode: i.product?.code || null,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        vatRate: Number(i.vatRate),
        discountPct: Number(i.discountPct),
        lineTotalHt: Number(i.lineTotalHt),
        lineVat: Number(i.lineVat),
        lineTotalTtc: Number(i.lineTotalTtc),
      })),
      payments: (s.payments || []).map((p) => ({
        id: p.id,
        reference: p.reference,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
      })),
      receivable: s.receivables?.[0]
        ? {
            id: s.receivables[0].id,
            totalAmount: Number(s.receivables[0].totalAmount),
            paidAmount: Number(s.receivables[0].paidAmount),
            outstandingAmount: Number(s.receivables[0].outstandingAmount),
            dueDate: s.receivables[0].dueDate,
            agingBucket: s.receivables[0].agingBucket,
            isSettled: s.receivables[0].isSettled,
          }
        : null,
      createdAt: s.createdAt?.toISOString(),
      updatedAt: s.updatedAt?.toISOString(),
    };
  }
}
