import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { FneClient } from '../entities/fne-client.entity';

export interface CreateFneClientDto {
  companyName: string;
  phone: string;
  email: string;
  ncc?: string;
  sellerName?: string;
  accountCode?: string;
}

export interface UpdateFneClientDto {
  companyName?: string;
  phone?: string;
  email?: string;
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

  constructor(
    @InjectRepository(FneClient)
    private readonly clientRepo: Repository<FneClient>,
  ) {}

  async create(dto: CreateFneClientDto): Promise<FneClient> {
    const client = this.clientRepo.create({
      companyName: dto.companyName,
      phone: dto.phone,
      email: dto.email,
      ncc: dto.ncc ?? null,
      sellerName: dto.sellerName ?? null,
      accountCode: dto.accountCode ?? null,
    });
    return this.clientRepo.save(client);
  }

  async update(id: string, dto: UpdateFneClientDto): Promise<FneClient> {
    const client = await this.clientRepo.findOneBy({ id });
    if (!client) throw new NotFoundException('Client introuvable');
    Object.assign(client, dto);
    return this.clientRepo.save(client);
  }

  async findById(id: string): Promise<FneClient> {
    const client = await this.clientRepo.findOneBy({ id });
    if (!client) throw new NotFoundException('Client introuvable');
    return client;
  }

  async findAll(query: ListFneClientsQuery) {
    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const qb = this.clientRepo.createQueryBuilder('c')
      .where('c.isActive = 1');

    if (query.search) {
      qb.andWhere(
        '(c.companyName LIKE :s OR c.phone LIKE :s OR c.email LIKE :s OR c.ncc LIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('c.companyName', 'ASC')
      .skip(skip)
      .take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(id: string): Promise<void> {
    const client = await this.clientRepo.findOneBy({ id });
    if (!client) throw new NotFoundException('Client introuvable');
    client.isActive = false;
    await this.clientRepo.save(client);
  }
}
