import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly catRepo: Repository<ExpenseCategory>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(includeInactive = false): Promise<CategoryResponseDto[]> {
    const where = includeInactive ? {} : { isActive: true };
    const categories = await this.catRepo.find({
      where,
      relations: ['parent', 'children'],
      order: { name: 'ASC' },
    });

    const roots = categories.filter((c) => !c.parentId);
    return roots.map((r) => this.toTree(r, categories));
  }

  async findById(id: string): Promise<CategoryResponseDto> {
    const cat = await this.catRepo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!cat) throw new NotFoundException('Category not found');
    const allCats = await this.catRepo.find({ relations: ['parent', 'children'] });
    return this.toTree(cat, allCats);
  }

  async create(dto: CreateCategoryDto, actorId: string): Promise<CategoryResponseDto> {
    const existing = await this.catRepo.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Category code already exists');

    if (dto.parentId) {
      const parent = await this.catRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const cat = this.catRepo.create({
      name: dto.name,
      code: dto.code,
      parentId: dto.parentId || null,
      budgetLimit: dto.budgetLimit ?? null,
    });
    const saved = await this.catRepo.save(cat);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'expense_category',
      entityId: saved.id,
      newValue: { name: dto.name, code: dto.code },
    });

    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateCategoryDto, actorId: string): Promise<CategoryResponseDto> {
    const cat = await this.catRepo.findOne({ where: { id } });
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

    await this.catRepo.save(cat);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'expense_category',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(id);
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
      children,
      createdAt: cat.createdAt?.toISOString(),
      updatedAt: cat.updatedAt?.toISOString(),
    };
  }
}
