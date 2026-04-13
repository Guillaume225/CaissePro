import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FneProduct } from '../entities/fne-product.entity';

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

  constructor(
    @InjectRepository(FneProduct)
    private readonly productRepo: Repository<FneProduct>,
  ) {}

  async create(dto: CreateFneProductDto): Promise<FneProduct> {
    const product = this.productRepo.create({
      description: dto.description,
      reference: dto.reference ?? null,
      unitPrice: dto.unitPrice,
      measurementUnit: dto.measurementUnit ?? null,
      defaultTaxes: dto.defaultTaxes ?? ['TVA'],
      accountCode: dto.accountCode ?? null,
      vatAccountCode: dto.vatAccountCode ?? null,
    });
    return this.productRepo.save(product);
  }

  async update(id: string, dto: UpdateFneProductDto): Promise<FneProduct> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException('Produit introuvable');
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async findById(id: string): Promise<FneProduct> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async findAll(query: ListFneProductsQuery) {
    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 25, 1), 100);
    const skip = (page - 1) * perPage;

    const qb = this.productRepo.createQueryBuilder('p')
      .where('p.isActive = 1');

    if (query.search) {
      qb.andWhere(
        '(p.description LIKE :s OR p.reference LIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('p.description', 'ASC')
      .skip(skip)
      .take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async delete(id: string): Promise<void> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException('Produit introuvable');
    product.isActive = false;
    await this.productRepo.save(product);
  }
}
