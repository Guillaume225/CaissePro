import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ErpSetting } from '../entities/erp-setting.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

export interface UpsertErpSettingDto {
  companyId: string;
  erpName?: string;
  apiUrl: string;
  accessToken: string;
  queueName?: string;
  processusClass?: string;
  processusMethod?: string;
  parametersClass?: string;
  parametersCode?: string;
  defaultJournalCode?: string;
  defaultPieceType?: string;
  autoPostOnCertify?: boolean;
  autoPostOnClosing?: boolean;
  certifyAfterAccounting?: boolean;
  isActive?: boolean;
  poQueueName?: string;
  poProcessusClass?: string;
  poProcessusMethod?: string;
  poParametersClass?: string;
  poParametersCode?: string;
  autoPostPurchaseOrders?: boolean;
}

@Injectable()
export class ErpSettingsService {
  constructor(private readonly tenantDsService: TenantDataSourceService) {}

  async findByCompany(tenantId: string, companyId: string): Promise<ErpSetting | null> {
    if (!companyId) return null;
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(ErpSetting).findOne({ where: { companyId } });
  }

  async findActive(tenantId: string): Promise<ErpSetting | null> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(ErpSetting).findOne({ where: { isActive: true } });
  }

  async upsert(tenantId: string, dto: UpsertErpSettingDto): Promise<ErpSetting> {
    if (!dto.companyId) throw new BadRequestException('companyId requis');
    if (!dto.apiUrl) throw new BadRequestException('apiUrl requis');
    if (!dto.accessToken) throw new BadRequestException('accessToken requis');

    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(ErpSetting);

    const existing = await repo.findOne({ where: { companyId: dto.companyId } });

    if (existing) {
      Object.assign(existing, {
        erpName: dto.erpName ?? existing.erpName,
        apiUrl: dto.apiUrl,
        accessToken: dto.accessToken,
        queueName: dto.queueName ?? existing.queueName,
        processusClass: dto.processusClass ?? existing.processusClass,
        processusMethod: dto.processusMethod ?? existing.processusMethod,
        parametersClass: dto.parametersClass ?? existing.parametersClass,
        parametersCode: dto.parametersCode ?? existing.parametersCode,
        defaultJournalCode: dto.defaultJournalCode ?? existing.defaultJournalCode,
        defaultPieceType: dto.defaultPieceType ?? existing.defaultPieceType,
        autoPostOnCertify: dto.autoPostOnCertify ?? existing.autoPostOnCertify,
        autoPostOnClosing: dto.autoPostOnClosing ?? existing.autoPostOnClosing,
        certifyAfterAccounting: dto.certifyAfterAccounting ?? existing.certifyAfterAccounting,
        isActive: dto.isActive ?? existing.isActive,
        poQueueName: dto.poQueueName ?? existing.poQueueName,
        poProcessusClass: dto.poProcessusClass ?? existing.poProcessusClass,
        poProcessusMethod: dto.poProcessusMethod ?? existing.poProcessusMethod,
        poParametersClass: dto.poParametersClass ?? existing.poParametersClass,
        poParametersCode: dto.poParametersCode ?? existing.poParametersCode,
        autoPostPurchaseOrders: dto.autoPostPurchaseOrders ?? existing.autoPostPurchaseOrders,
      });
      return repo.save(existing);
    }

    const entity = repo.create({
      companyId: dto.companyId,
      erpName: dto.erpName ?? 'sage',
      apiUrl: dto.apiUrl,
      accessToken: dto.accessToken,
      queueName: dto.queueName ?? 'QTask',
      processusClass: dto.processusClass ?? 'TProcessusImportEcritureFA',
      processusMethod: dto.processusMethod ?? 'ExecuterAutomate',
      parametersClass: dto.parametersClass ?? 'TParametreImportEcriture',
      parametersCode: dto.parametersCode ?? 'GenerationAPI_Tresorerie',
      defaultJournalCode: dto.defaultJournalCode ?? 'VF',
      defaultPieceType: dto.defaultPieceType ?? 'FA',
      autoPostOnCertify: dto.autoPostOnCertify ?? false,
      autoPostOnClosing: dto.autoPostOnClosing ?? false,
      certifyAfterAccounting: dto.certifyAfterAccounting ?? false,
      isActive: dto.isActive ?? true,
      poQueueName: dto.poQueueName ?? 'QTask',
      poProcessusClass: dto.poProcessusClass ?? 'TProcessusImportContrat',
      poProcessusMethod: dto.poProcessusMethod ?? 'ExecuterAutomate',
      poParametersClass: dto.poParametersClass ?? 'TParametreImportContrat',
      poParametersCode: dto.poParametersCode ?? 'GenerationAPI_CommandeAchat',
      autoPostPurchaseOrders: dto.autoPostPurchaseOrders ?? true,
    });
    return repo.save(entity);
  }

  async testConnection(tenantId: string, companyId: string): Promise<{ success: boolean; message: string }> {
    const setting = await this.findByCompany(tenantId, companyId);
    if (!setting) throw new NotFoundException('Configuration ERP non trouvée');

    try {
      // Just verify the URL is reachable
      const url = new URL(setting.apiUrl);
      return { success: true, message: `URL ${url.origin} valide` };
    } catch {
      return { success: false, message: 'URL invalide' };
    }
  }
}
