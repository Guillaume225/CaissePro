import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Company } from '../entities/company.entity';
import { User } from '../entities/user.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateCompanyDto, UpdateCompanyDto, CompanyResponseDto } from './dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string): Promise<CompanyResponseDto[]> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const companies = await ds.getRepository(Company).find({ order: { name: 'ASC' } });
    return companies.map((c) => this.toResponseDto(c, tenantId));
  }

  async findById(id: string, tenantId: string): Promise<CompanyResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const company = await ds.getRepository(Company).findOne({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return this.toResponseDto(company, tenantId);
  }

  async create(
    dto: CreateCompanyDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ): Promise<CompanyResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);

    const existing = await ds.getRepository(Company).findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Company code already exists for this tenant');

    const company = ds.getRepository(Company).create({
      name: dto.name,
      code: dto.code,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      taxId: dto.taxId ?? null,
      tradeRegister: dto.tradeRegister ?? null,
      currency: dto.currency || 'XOF',
    });

    const saved = await ds.getRepository(Company).save(company);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'company',
      entityId: saved.id,
      newValue: { name: dto.name, code: dto.code },
      ipAddress: ip,
    });

    return this.toResponseDto(saved, tenantId);
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ): Promise<CompanyResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const company = await ds.getRepository(Company).findOne({ where: { id } });
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

    const saved = await ds.getRepository(Company).save(company);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'company',
      entityId: id,
      oldValue,
      newValue,
      ipAddress: ip,
    });

    return this.toResponseDto(saved, tenantId);
  }

  async switchUserCompany(userId: string, companyId: string, tenantId: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const company = await ds.getRepository(Company).findOne({ where: { id: companyId, isActive: true } });
    if (!company) throw new NotFoundException('Company not found or inactive');
    await ds.getRepository(User).update(userId, { companyId });
  }

  private toResponseDto(company: Company, tenantId: string): CompanyResponseDto {
    return {
      id: company.id,
      tenantId,
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
