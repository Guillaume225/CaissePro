import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Product } from '../entities/product.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto } from './dto';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
  ) {}

  /* ─── FindAll with filters ─── */
  async findAll(tenantId: string, query: ListProductsQueryDto) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Product);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = repo.createQueryBuilder('p');

    if (query.search) {
      qb.andWhere('(p.name ILIKE :s OR p.code ILIKE :s OR p.description ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.category) {
      qb.andWhere('p.category = :cat', { cat: query.category });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('p.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('p.name', 'ASC')
      .skip((page - 1) * perPage)
      .take(perPage);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((p) => ({
        ...p,
        unitPrice: Number(p.unitPrice),
        vatRate: Number(p.vatRate),
      })),
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
    const product = await ds.getRepository(Product).findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return {
      ...product,
      unitPrice: Number(product.unitPrice),
      vatRate: Number(product.vatRate),
    };
  }

  /* ─── Create ─── */
  async create(tenantId: string, dto: CreateProductDto, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Product);

    const existing = await repo.findOne({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Product code ${dto.code} already exists`);

    const product = repo.create(dto);
    const saved = await repo.save(product);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'product',
      entityId: saved.id,
      newValue: { code: dto.code, name: dto.name },
    });

    return this.findById(tenantId, saved.id);
  }

  /* ─── Update ─── */
  async update(tenantId: string, id: string, dto: UpdateProductDto, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Product);

    const product = await repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    for (const key of Object.keys(dto) as (keyof UpdateProductDto)[]) {
      if (dto[key] !== undefined) {
        oldValue[key] = (product as unknown as Record<string, unknown>)[key];
        newValue[key] = dto[key];
      }
    }

    Object.assign(product, dto);
    await repo.save(product);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'product',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(tenantId, id);
  }

  /* ─── Toggle activation ─── */
  async toggleActive(tenantId: string, id: string, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Product);

    const product = await repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    product.isActive = !product.isActive;
    await repo.save(product);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'product',
      entityId: id,
      oldValue: { isActive: !product.isActive },
      newValue: { isActive: product.isActive },
    });

    return this.findById(tenantId, id);
  }

  /* ─── Soft Delete ─── */
  async remove(tenantId: string, id: string, userId: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Product);

    const product = await repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await repo.softDelete(id);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entityType: 'product',
      entityId: id,
      oldValue: { code: product.code, name: product.name },
    });
  }
}
