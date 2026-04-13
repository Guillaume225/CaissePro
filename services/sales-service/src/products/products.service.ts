import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  ListProductsQueryDto,
} from './dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly auditService: AuditService,
  ) {}

  /* ─── FindAll with filters ─── */
  async findAll(query: ListProductsQueryDto) {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = this.productRepo.createQueryBuilder('p');

    if (query.search) {
      qb.andWhere(
        '(p.name ILIKE :s OR p.code ILIKE :s OR p.description ILIKE :s)',
        { s: `%${query.search}%` },
      );
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
  async findById(id: string) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return {
      ...product,
      unitPrice: Number(product.unitPrice),
      vatRate: Number(product.vatRate),
    };
  }

  /* ─── Create ─── */
  async create(dto: CreateProductDto, userId: string) {
    const existing = await this.productRepo.findOne({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Product code ${dto.code} already exists`);

    const product = this.productRepo.create(dto);
    const saved = await this.productRepo.save(product);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'product',
      entityId: saved.id,
      newValue: { code: dto.code, name: dto.name },
    });

    return this.findById(saved.id);
  }

  /* ─── Update ─── */
  async update(id: string, dto: UpdateProductDto, userId: string) {
    const product = await this.productRepo.findOne({ where: { id } });
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
    await this.productRepo.save(product);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'product',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(id);
  }

  /* ─── Toggle activation ─── */
  async toggleActive(id: string, userId: string) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    product.isActive = !product.isActive;
    await this.productRepo.save(product);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'product',
      entityId: id,
      oldValue: { isActive: !product.isActive },
      newValue: { isActive: product.isActive },
    });

    return this.findById(id);
  }

  /* ─── Soft Delete ─── */
  async remove(id: string, userId: string): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.productRepo.softDelete(id);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entityType: 'product',
      entityId: id,
      oldValue: { code: product.code, name: product.name },
    });
  }
}
