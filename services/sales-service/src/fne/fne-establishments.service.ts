import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FneEstablishment } from '../entities/fne-establishment.entity';

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
  constructor(
    @InjectRepository(FneEstablishment)
    private readonly repo: Repository<FneEstablishment>,
  ) {}

  async create(dto: CreateFneEstablishmentDto, fallbackCompanyId: string): Promise<FneEstablishment> {
    const entity = this.repo.create({
      companyId: dto.companyId || fallbackCompanyId,
      name: dto.name,
      address: dto.address ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateFneEstablishmentDto): Promise<FneEstablishment> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Établissement introuvable');
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<FneEstablishment> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Établissement introuvable');
    return entity;
  }

  async findAll(query: ListFneEstablishmentsQuery, companyId: string) {
    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const effectiveCompanyId = query.companyId || companyId;
    const qb = this.repo.createQueryBuilder('e')
      .where('e.companyId = :effectiveCompanyId', { effectiveCompanyId })
      .andWhere('e.isActive = 1');

    if (query.search) {
      qb.andWhere('(e.name LIKE :s OR e.address LIKE :s)', { s: `%${query.search}%` });
    }

    qb.orderBy('e.name', 'ASC').skip(skip).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(id: string): Promise<void> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Établissement introuvable');
    entity.isActive = false;
    await this.repo.save(entity);
  }
}
