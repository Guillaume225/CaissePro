import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FnePointOfSale } from '../entities/fne-point-of-sale.entity';

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
  constructor(
    @InjectRepository(FnePointOfSale)
    private readonly repo: Repository<FnePointOfSale>,
  ) {}

  async create(dto: CreateFnePointOfSaleDto): Promise<FnePointOfSale> {
    const entity = this.repo.create({
      establishmentId: dto.establishmentId,
      name: dto.name,
      address: dto.address ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateFnePointOfSaleDto): Promise<FnePointOfSale> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Point de vente introuvable');
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<FnePointOfSale> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Point de vente introuvable');
    return entity;
  }

  async findAll(query: ListFnePointsOfSaleQuery) {
    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const qb = this.repo.createQueryBuilder('p')
      .where('p.isActive = 1');

    if (query.establishmentId) {
      qb.andWhere('p.establishmentId = :establishmentId', { establishmentId: query.establishmentId });
    }

    if (query.search) {
      qb.andWhere('(p.name LIKE :s OR p.address LIKE :s)', { s: `%${query.search}%` });
    }

    qb.orderBy('p.name', 'ASC').skip(skip).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(id: string): Promise<void> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Point de vente introuvable');
    entity.isActive = false;
    await this.repo.save(entity);
  }
}
