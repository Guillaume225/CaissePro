import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../entities/company.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateCompanyDto, UpdateCompanyDto, CompanyResponseDto } from './dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async findAllByTenant(tenantId: string): Promise<CompanyResponseDto[]> {
    const companies = await this.companyRepo.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
    return companies.map((c) => this.toResponseDto(c));
  }

  async findById(id: string, tenantId: string): Promise<CompanyResponseDto> {
    const company = await this.companyRepo.findOne({
      where: { id, tenantId },
    });
    if (!company) throw new NotFoundException('Company not found');
    return this.toResponseDto(company);
  }

  async create(
    dto: CreateCompanyDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ): Promise<CompanyResponseDto> {
    const existing = await this.companyRepo.findOne({
      where: { code: dto.code, tenantId },
    });
    if (existing) throw new ConflictException('Company code already exists for this tenant');

    const company = this.companyRepo.create({
      tenantId,
      name: dto.name,
      code: dto.code,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      taxId: dto.taxId ?? null,
      tradeRegister: dto.tradeRegister ?? null,
      currency: dto.currency || 'XOF',
    });

    const saved = await this.companyRepo.save(company);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'company',
      entityId: saved.id,
      newValue: { name: dto.name, code: dto.code },
      ipAddress: ip,
    });

    return this.toResponseDto(saved);
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ): Promise<CompanyResponseDto> {
    const company = await this.companyRepo.findOne({
      where: { id, tenantId },
    });
    if (!company) throw new NotFoundException('Company not found');

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    for (const key of Object.keys(dto) as (keyof UpdateCompanyDto)[]) {
      if (dto[key] !== undefined) {
        oldValue[key] = (company as unknown as Record<string, unknown>)[key];
        newValue[key] = dto[key];
        (company as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    const saved = await this.companyRepo.save(company);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'company',
      entityId: id,
      oldValue,
      newValue,
      ipAddress: ip,
    });

    return this.toResponseDto(saved);
  }

  async switchUserCompany(userId: string, companyId: string, tenantId: string): Promise<void> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId, tenantId, isActive: true },
    });
    if (!company) throw new NotFoundException('Company not found or inactive');

    await this.userRepo.update(userId, { companyId });
  }

  private toResponseDto(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      tenantId: company.tenantId,
      name: company.name,
      code: company.code,
      address: company.address,
      phone: company.phone,
      email: company.email,
      taxId: company.taxId,
      tradeRegister: company.tradeRegister,
      currency: company.currency,
      logo: company.logo,
      isActive: company.isActive,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  }
}
