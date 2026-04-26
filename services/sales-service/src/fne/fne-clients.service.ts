import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FneClient } from '../entities/fne-client.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

export interface CreateFneClientDto {
  companyName: string;
  phone: string;
  email: string;
  clientCode?: string;
  ncc?: string;
  sellerName?: string;
  accountCode?: string;
}

export interface UpdateFneClientDto {
  companyName?: string;
  phone?: string;
  email?: string;
  clientCode?: string;
  ncc?: string;
  sellerName?: string;
  accountCode?: string;
  isActive?: boolean;
}

export interface ListFneClientsQuery {
  search?: string;
  page?: number;
  perPage?: number;
}

@Injectable()
export class FneClientsService {
  private readonly logger = new Logger(FneClientsService.name);

  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async create(tenantId: string, dto: CreateFneClientDto): Promise<FneClient> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneClient);
    const client = repo.create({
      companyName: dto.companyName,
      phone: dto.phone,
      email: dto.email,
      clientCode: dto.clientCode ?? null,
      ncc: dto.ncc ?? null,
      sellerName: dto.sellerName ?? null,
      accountCode: dto.accountCode ?? null,
    });
    return repo.save(client);
  }

  async update(tenantId: string, id: string, dto: UpdateFneClientDto): Promise<FneClient> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneClient);
    const client = await repo.findOneBy({ id });
    if (!client) throw new NotFoundException('Client introuvable');
    Object.assign(client, dto);
    return repo.save(client);
  }

  async findById(tenantId: string, id: string): Promise<FneClient> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const client = await ds.getRepository(FneClient).findOneBy({ id });
    if (!client) throw new NotFoundException('Client introuvable');
    return client;
  }

  async findAll(tenantId: string, query: ListFneClientsQuery) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneClient);

    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const qb = repo.createQueryBuilder('c').where('c.isActive = 1');

    if (query.search) {
      qb.andWhere(
        '(c.companyName LIKE :s OR c.phone LIKE :s OR c.email LIKE :s OR c.ncc LIKE :s OR c.clientCode LIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('c.companyName', 'ASC').skip(skip).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneClient);
    const client = await repo.findOneBy({ id });
    if (!client) throw new NotFoundException('Client introuvable');
    client.isActive = false;
    await repo.save(client);
  }
}
