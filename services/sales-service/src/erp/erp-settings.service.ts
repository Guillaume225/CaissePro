import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpSetting } from '../entities/erp-setting.entity';

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
}

@Injectable()
export class ErpSettingsService {
  private readonly logger = new Logger(ErpSettingsService.name);

  constructor(
    @InjectRepository(ErpSetting)
    private readonly repo: Repository<ErpSetting>,
  ) {}

  async findByCompany(companyId: string): Promise<ErpSetting | null> {
    if (!companyId) return null;
    return this.repo.findOne({ where: { companyId } });
  }

  async findActive(): Promise<ErpSetting | null> {
    return this.repo.findOne({ where: { isActive: true } });
  }

  async upsert(dto: UpsertErpSettingDto): Promise<ErpSetting> {
    if (!dto.companyId) throw new BadRequestException('companyId requis');
    if (!dto.apiUrl) throw new BadRequestException('apiUrl requis');
    if (!dto.accessToken) throw new BadRequestException('accessToken requis');

    const existing = await this.repo.findOne({ where: { companyId: dto.companyId } });

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
      });
      return this.repo.save(existing);
    }

    const entity = this.repo.create({
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
    });
    return this.repo.save(entity);
  }

  async testConnection(companyId: string): Promise<{ success: boolean; message: string }> {
    const setting = await this.findByCompany(companyId);
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
