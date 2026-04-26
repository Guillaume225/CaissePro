import { Injectable, NotFoundException } from '@nestjs/common';
import { FnePointOfSale } from '../entities/fne-point-of-sale.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

export interface CreateFnePointOfSaleDto {
  name: string;
  address?: string;
  establishmentId: string;
}

export interface UpdateFnePointOfSaleDto {
  name?: string;
  address?: string;
  isActive?: boolean;
}

export interface ListFnePointsOfSaleQuery {
  search?: string;
  page?: number;
  perPage?: number;
  establishmentId?: string;
}

@Injectable()
export class FnePointsOfSaleService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async create(tenantId: string, dto: CreateFnePointOfSaleDto): Promise<FnePointOfSale> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FnePointOfSale);
    const entity = repo.create({
      establishmentId: dto.establishmentId,
      name: dto.name,
      address: dto.address ?? null,
    });
    return repo.save(entity);
  }

  async update(tenantId: string, id: string, dto: UpdateFnePointOfSaleDto): Promise<FnePointOfSale> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FnePointOfSale);
    const entity = await repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Point de vente introuvable');
    Object.assign(entity, dto);
    return repo.save(entity);
  }

  async findById(tenantId: string, id: string): Promise<FnePointOfSale> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entity = await ds.getRepository(FnePointOfSale).findOneBy({ id });
    if (!entity) throw new NotFoundException('Point de vente introuvable');
    return entity;
  }

  async findAll(tenantId: string, query: ListFnePointsOfSaleQuery) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FnePointOfSale);

    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const qb = repo.createQueryBuilder('p').where('p.isActive = 1');

    if (query.establishmentId) {
      qb.andWhere('p.establishmentId = :establishmentId', {
        establishmentId: query.establishmentId,
      });
    }

    if (query.search) {
      qb.andWhere('(p.name LIKE :s OR p.address LIKE :s)', { s: `%${query.search}%` });
    }

    qb.orderBy('p.name', 'ASC').skip(skip).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FnePointOfSale);
    const entity = await repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Point de vente introuvable');
    entity.isActive = false;
    await repo.save(entity);
  }
}
