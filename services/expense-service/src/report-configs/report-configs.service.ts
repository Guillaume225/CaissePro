import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportConfiguration } from './report-config.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { SaveReportConfigDto } from './dto';

@Injectable()
export class ReportConfigsService {
  constructor(
    @InjectRepository(ReportConfiguration)
    private readonly repo: Repository<ReportConfiguration>,
    private readonly auditService: AuditService,
  ) {}

  async findAllByTenant(tenantId: string): Promise<ReportConfiguration[]> {
    return this.repo.find({
      where: { tenantId },
      order: { reportId: 'ASC' },
    });
  }

  async findOne(tenantId: string, reportId: string): Promise<ReportConfiguration | null> {
    return this.repo.findOne({ where: { tenantId, reportId } });
  }

  async upsert(
    tenantId: string,
    dto: SaveReportConfigDto,
    actorId: string,
  ): Promise<ReportConfiguration> {
    let entity = await this.repo.findOne({
      where: { tenantId, reportId: dto.reportId },
    });

    const isNew = !entity;
    if (entity) {
      entity.reportName = dto.reportName;
      entity.configJson = dto.configJson;
      entity.updatedById = actorId;
    } else {
      entity = this.repo.create({
        tenantId,
        reportId: dto.reportId,
        reportName: dto.reportName,
        configJson: dto.configJson,
        updatedById: actorId,
      });
    }

    const saved = await this.repo.save(entity);

    await this.auditService.log({
      userId: actorId,
      action: isNew ? AuditAction.CREATE : AuditAction.UPDATE,
      entityType: 'report_config',
      entityId: saved.id,
      newValue: { reportId: dto.reportId, reportName: dto.reportName },
    });

    return saved;
  }

  async bulkUpsert(
    tenantId: string,
    dtos: SaveReportConfigDto[],
    actorId: string,
  ): Promise<ReportConfiguration[]> {
    const results: ReportConfiguration[] = [];
    for (const dto of dtos) {
      results.push(await this.upsert(tenantId, dto, actorId));
    }
    return results;
  }

  async remove(tenantId: string, reportId: string, actorId: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { tenantId, reportId } });
    if (!entity) throw new NotFoundException('Report config not found');

    await this.repo.remove(entity);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'report_config',
      entityId: entity.id,
      oldValue: { reportId, reportName: entity.reportName },
    });
  }
}
