import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Client } from '../entities/client.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateClientDto, UpdateClientDto, ListClientsQueryDto } from './dto';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
  ) {}

  /* ─── FindAll with filters ─── */
  async findAll(tenantId: string, query: ListClientsQueryDto) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Client);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = repo.createQueryBuilder('c');

    if (query.search) {
      qb.andWhere('(c.name ILIKE :s OR c.email ILIKE :s OR c.phone ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('c.name', 'ASC')
      .skip((page - 1) * perPage)
      .take(perPage);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
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
  async findById(tenantId: string, id: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const client = await ds.getRepository(Client).findOne({ where: { id } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  /* ─── Create ─── */
  async create(tenantId: string, dto: CreateClientDto, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Client);

    const client = repo.create(dto);
    const saved = await repo.save(client);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'client',
      entityId: saved.id,
      newValue: { name: dto.name },
    });

    return saved;
  }

  /* ─── Update ─── */
  async update(tenantId: string, id: string, dto: UpdateClientDto, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Client);

    const client = await this.findById(tenantId, id);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    for (const key of Object.keys(dto) as (keyof UpdateClientDto)[]) {
      if (dto[key] !== undefined) {
        oldValue[key] = (client as unknown as Record<string, unknown>)[key];
        newValue[key] = dto[key];
      }
    }

    Object.assign(client, dto);
    const saved = await repo.save(client);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'client',
      entityId: id,
      oldValue,
      newValue,
    });

    return saved;
  }

  /* ─── Soft Delete ─── */
  async remove(tenantId: string, id: string, userId: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Client);

    const client = await this.findById(tenantId, id);
    await repo.softDelete(id);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entityType: 'client',
      entityId: id,
      oldValue: { name: client.name },
    });
  }

  /* ─── Client statement (purchase history + payments) ─── */
  async getStatement(tenantId: string, id: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const client = await ds.getRepository(Client).findOne({
      where: { id },
      relations: ['sales', 'sales.items', 'sales.payments'],
    });
    if (!client) throw new NotFoundException('Client not found');

    const sales = (client.sales || []).map((s) => ({
      id: s.id,
      reference: s.reference,
      date: s.date,
      totalTtc: Number(s.totalTtc),
      amountPaid: Number(s.amountPaid),
      status: s.status,
      payments: (s.payments || []).map((p) => ({
        id: p.id,
        reference: p.reference,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
      })),
    }));

    const totalSales = sales.reduce((acc, s) => acc + s.totalTtc, 0);
    const totalPaid = sales.reduce((acc, s) => acc + s.amountPaid, 0);

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        creditLimit: Number(client.creditLimit),
      },
      sales,
      summary: {
        totalSales,
        totalPaid,
        outstanding: totalSales - totalPaid,
        salesCount: sales.length,
      },
    };
  }
}
