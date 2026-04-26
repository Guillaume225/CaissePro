import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportConfiguration } from './report-config.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { SaveReportConfigDto } from './dto';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class ReportConfigsService {
  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
  ) {}

  async findAllByTenant(tenantId: string): Promise<ReportConfiguration[]> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(ReportConfiguration).find({
      order: { reportId: 'ASC' },
    });
  }

  async findOne(tenantId: string, reportId: string): Promise<ReportConfiguration | null> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    return ds.getRepository(ReportConfiguration).findOne({ where: { reportId } });
  }

  async upsert(
    tenantId: string,
    dto: SaveReportConfigDto,
    actorId: string,
  ): Promise<ReportConfiguration> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(ReportConfiguration);

    let entity = await repo.findOne({
      where: { reportId: dto.reportId },
    });

    const isNew = !entity;
    if (entity) {
      entity.reportName = dto.reportName;
      entity.configJson = dto.configJson;
      entity.updatedById = actorId;
    } else {
      entity = repo.create({
        reportId: dto.reportId,
        reportName: dto.reportName,
        configJson: dto.configJson,
        updatedById: actorId,
      });
    }

    const saved = await repo.save(entity);

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
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(ReportConfiguration);
    const entity = await repo.findOne({ where: { reportId } });
    if (!entity) throw new NotFoundException('Report config not found');

    await repo.remove(entity);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'report_config',
      entityId: entity.id,
      oldValue: { reportId, reportName: entity.reportName },
    });
  }
}
