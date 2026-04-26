import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string, includeInactive = false): Promise<CategoryResponseDto[]> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const catRepo = ds.getRepository(ExpenseCategory);
    const where = includeInactive ? {} : { isActive: true };
    const categories = await catRepo.find({
      where,
      relations: ['parent', 'children'],
      order: { name: 'ASC' },
    });

    const roots = categories.filter((c) => !c.parentId);
    return roots.map((r) => this.toTree(r, categories));
  }

  async findById(tenantId: string, id: string): Promise<CategoryResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const catRepo = ds.getRepository(ExpenseCategory);
    const cat = await catRepo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!cat) throw new NotFoundException('Category not found');
    const allCats = await catRepo.find({ relations: ['parent', 'children'] });
    return this.toTree(cat, allCats);
  }

  async create(tenantId: string, dto: CreateCategoryDto, actorId: string): Promise<CategoryResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const catRepo = ds.getRepository(ExpenseCategory);

    const code = dto.code || dto.name
      .toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 20);

    const existing = await catRepo.findOne({ where: { code } });
    if (existing) throw new ConflictException('Category code already exists');

    if (dto.parentId) {
      const parent = await catRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const cat = catRepo.create({
      name: dto.name,
      code,
      parentId: dto.parentId || null,
      budgetLimit: dto.budgetLimit ?? null,
      accountingDebitAccount: dto.accountingDebitAccount ?? null,
      accountingCreditAccount: dto.accountingCreditAccount ?? null,
      ...(dto.direction && { direction: dto.direction }),
    });
    const saved = await catRepo.save(cat);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'expense_category',
      entityId: saved.id,
      newValue: { name: dto.name, code },
    });

    return this.findById(tenantId, saved.id);
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto, actorId: string): Promise<CategoryResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const catRepo = ds.getRepository(ExpenseCategory);
    const cat = await catRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      oldValue.name = cat.name;
      newValue.name = dto.name;
      cat.name = dto.name;
    }
    if (dto.budgetLimit !== undefined) {
      oldValue.budgetLimit = cat.budgetLimit;
      newValue.budgetLimit = dto.budgetLimit;
      cat.budgetLimit = dto.budgetLimit;
    }
    if (dto.isActive !== undefined) {
      oldValue.isActive = cat.isActive;
      newValue.isActive = dto.isActive;
      cat.isActive = dto.isActive;
    }
    if (dto.accountingDebitAccount !== undefined) {
      oldValue.accountingDebitAccount = cat.accountingDebitAccount;
      newValue.accountingDebitAccount = dto.accountingDebitAccount;
      cat.accountingDebitAccount = dto.accountingDebitAccount;
    }
    if (dto.accountingCreditAccount !== undefined) {
      oldValue.accountingCreditAccount = cat.accountingCreditAccount;
      newValue.accountingCreditAccount = dto.accountingCreditAccount;
      cat.accountingCreditAccount = dto.accountingCreditAccount;
    }
    if (dto.direction !== undefined) {
      oldValue.direction = cat.direction;
      newValue.direction = dto.direction;
      cat.direction = dto.direction;
    }

    await catRepo.save(cat);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'expense_category',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(tenantId, id);
  }

  private toTree(cat: ExpenseCategory, allCats: ExpenseCategory[]): CategoryResponseDto {
    const children = allCats
      .filter((c) => c.parentId === cat.id)
      .map((c) => this.toTree(c, allCats));

    return {
      id: cat.id,
      name: cat.name,
      code: cat.code,
      parentId: cat.parentId,
      parentName: cat.parent?.name ?? null,
      budgetLimit: cat.budgetLimit ? Number(cat.budgetLimit) : null,
      isActive: cat.isActive,
      direction: cat.direction,
      accountingDebitAccount: cat.accountingDebitAccount ?? null,
      accountingCreditAccount: cat.accountingCreditAccount ?? null,
      children,
      createdAt: cat.createdAt?.toISOString(),
      updatedAt: cat.updatedAt?.toISOString(),
    };
  }
}
