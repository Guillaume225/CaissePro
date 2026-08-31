import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { FneSetting } from '../entities/fne-setting.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

export interface CreateFneSettingDto {
  companyId: string;
  apiUrl?: string;
  apiKey: string;
  nif?: string;
  maxRetries?: number;
  journalSales?: string;
  journalCash?: string;
  regimeImposition?: string;
  centreImpots?: string;
  bankRef?: string;
  defaultFooter?: string;
}

export interface UpdateFneSettingDto {
  apiUrl?: string;
  apiKey?: string;
  nif?: string;
  maxRetries?: number;
  isActive?: boolean;
  journalSales?: string;
  journalCash?: string;
  regimeImposition?: string;
  centreImpots?: string;
  bankRef?: string;
  defaultFooter?: string;
}

@Injectable()
export class FneSettingsService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async findByCompany(tenantId: string, companyId: string): Promise<FneSetting | null> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(FneSetting).findOneBy({ companyId });
  }

  /** First active FNE setting — same lookup used by accounting-entry generation. */
  async findActive(tenantId: string): Promise<FneSetting | null> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(FneSetting).findOne({ where: { isActive: true } });
  }

  async updateCreditNoteSense(tenantId: string, creditNoteSameSense: boolean): Promise<FneSetting> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneSetting);
    const entity = await repo.findOne({ where: { isActive: true } });
    if (!entity) {
      throw new NotFoundException(
        'Aucune configuration FNE active — configurez d\'abord la connexion FNE.',
      );
    }
    entity.creditNoteSameSense = creditNoteSameSense;
    return repo.save(entity);
  }

  async create(tenantId: string, dto: CreateFneSettingDto): Promise<FneSetting> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneSetting);
    const existing = await repo.findOneBy({ companyId: dto.companyId });
    if (existing) {
      throw new ConflictException('La configuration FNE existe déjà pour cette société');
    }
    const entity = repo.create({
      companyId: dto.companyId,
      apiUrl: dto.apiUrl || 'http://54.247.95.108/ws',
      apiKey: dto.apiKey,
      nif: dto.nif ?? null,
      maxRetries: dto.maxRetries ?? 3,
      journalSales: dto.journalSales ?? 'VF',
      journalCash: dto.journalCash ?? 'CA',
      regimeImposition: dto.regimeImposition ?? null,
      centreImpots: dto.centreImpots ?? null,
      bankRef: dto.bankRef ?? null,
      defaultFooter: dto.defaultFooter ?? null,
    });
    return repo.save(entity);
  }

  async update(tenantId: string, companyId: string, dto: UpdateFneSettingDto): Promise<FneSetting> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneSetting);
    const entity = await repo.findOneBy({ companyId });
    if (!entity) throw new NotFoundException('Configuration FNE introuvable pour cette société');
    Object.assign(entity, dto);
    return repo.save(entity);
  }

  async upsert(tenantId: string, dto: CreateFneSettingDto): Promise<FneSetting> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(FneSetting);
    const existing = await repo.findOneBy({ companyId: dto.companyId });
    if (existing) {
      Object.assign(existing, {
        apiUrl: dto.apiUrl || existing.apiUrl,
        apiKey: dto.apiKey ?? existing.apiKey,
        nif: dto.nif !== undefined ? dto.nif : existing.nif,
        maxRetries: dto.maxRetries ?? existing.maxRetries,
        journalSales: dto.journalSales ?? existing.journalSales,
        journalCash: dto.journalCash ?? existing.journalCash,
        regimeImposition:
          dto.regimeImposition !== undefined ? dto.regimeImposition : existing.regimeImposition,
        centreImpots: dto.centreImpots !== undefined ? dto.centreImpots : existing.centreImpots,
        bankRef: dto.bankRef !== undefined ? dto.bankRef : existing.bankRef,
        defaultFooter: dto.defaultFooter !== undefined ? dto.defaultFooter : existing.defaultFooter,
      });
      return repo.save(existing);
    }
    return this.create(tenantId, dto);
  }
}
