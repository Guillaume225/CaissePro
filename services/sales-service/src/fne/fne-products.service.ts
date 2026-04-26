import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FneProduct } from '../entities/fne-product.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

export interface CreateFneProductDto {
  description: string;
  reference?: string;
  unitPrice: number;
  measurementUnit?: string;
  defaultTaxes?: string[];
  accountCode?: string;
  vatAccountCode?: string;
}

export interface UpdateFneProductDto {
  description?: string;
  reference?: string;
  unitPrice?: number;
  measurementUnit?: string;
  defaultTaxes?: string[];
  accountCode?: string;
  vatAccountCode?: string;
  isActive?: boolean;
}

export interface ListFneProductsQuery {
  search?: string;
  page?: number;
  perPage?: number;
}

@Injectable()
export class FneProductsService {
  private readonly logger = new Logger(FneProductsService.name);

  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async create(tenantId: string, dto: CreateFneProductDto): Promise<FneProduct> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneProduct);
    const product = repo.create({
      description: dto.description,
      reference: dto.reference ?? null,
      unitPrice: dto.unitPrice,
      measurementUnit: dto.measurementUnit ?? null,
      defaultTaxes: dto.defaultTaxes ?? ['TVA'],
      accountCode: dto.accountCode ?? null,
      vatAccountCode: dto.vatAccountCode ?? null,
    });
    return repo.save(product);
  }

  async update(tenantId: string, id: string, dto: UpdateFneProductDto): Promise<FneProduct> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneProduct);
    const product = await repo.findOneBy({ id });
    if (!product) throw new NotFoundException('Produit introuvable');
    Object.assign(product, dto);
    return repo.save(product);
  }

  async findById(tenantId: string, id: string): Promise<FneProduct> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const product = await ds.getRepository(FneProduct).findOneBy({ id });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async findAll(tenantId: string, query: ListFneProductsQuery) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneProduct);

    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const qb = repo.createQueryBuilder('p').where('p.isActive = 1');

    if (query.search) {
      qb.andWhere('(p.description LIKE :s OR p.reference LIKE :s)', { s: `%${query.search}%` });
    }

    qb.orderBy('p.description', 'ASC').skip(skip).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneProduct);
    const product = await repo.findOneBy({ id });
    if (!product) throw new NotFoundException('Produit introuvable');
    product.isActive = false;
    await repo.save(product);
  }
}
