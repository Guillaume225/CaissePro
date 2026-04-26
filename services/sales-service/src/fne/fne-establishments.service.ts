import { Injectable, NotFoundException } from '@nestjs/common';
import { FneEstablishment } from '../entities/fne-establishment.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

export interface CreateFneEstablishmentDto {
  name: string;
  address?: string;
  companyId?: string;
}

export interface UpdateFneEstablishmentDto {
  name?: string;
  address?: string;
  isActive?: boolean;
}

export interface ListFneEstablishmentsQuery {
  search?: string;
  page?: number;
  perPage?: number;
  companyId?: string;
}

@Injectable()
export class FneEstablishmentsService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async create(
    tenantId: string,
    dto: CreateFneEstablishmentDto,
    fallbackCompanyId: string,
  ): Promise<FneEstablishment> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneEstablishment);
    const entity = repo.create({
      companyId: dto.companyId || fallbackCompanyId,
      name: dto.name,
      address: dto.address ?? null,
    });
    return repo.save(entity);
  }

  async update(tenantId: string, id: string, dto: UpdateFneEstablishmentDto): Promise<FneEstablishment> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneEstablishment);
    const entity = await repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Établissement introuvable');
    Object.assign(entity, dto);
    return repo.save(entity);
  }

  async findById(tenantId: string, id: string): Promise<FneEstablishment> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entity = await ds.getRepository(FneEstablishment).findOneBy({ id });
    if (!entity) throw new NotFoundException('Établissement introuvable');
    return entity;
  }

  async findAll(tenantId: string, query: ListFneEstablishmentsQuery, companyId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneEstablishment);

    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const effectiveCompanyId = query.companyId || companyId;
    const qb = repo
      .createQueryBuilder('e')
      .where('e.companyId = :effectiveCompanyId', { effectiveCompanyId })
      .andWhere('e.isActive = 1');

    if (query.search) {
      qb.andWhere('(e.name LIKE :s OR e.address LIKE :s)', { s: `%${query.search}%` });
    }

    qb.orderBy('e.name', 'ASC').skip(skip).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneEstablishment);
    const entity = await repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Établissement introuvable');
    entity.isActive = false;
    await repo.save(entity);
  }
}
