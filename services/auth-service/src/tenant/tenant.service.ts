import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { PlanCode } from '../plans/plans.config';
import { computeSchemaId } from './schema-id.util';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id, isActive: true } });
    if (!tenant) throw new NotFoundException(`Tenant introuvable: ${id}`);
    return tenant;
  }

  async findByExternalId(externalTenantId: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { externalTenantId } });
  }

  async upsert(
    externalTenantId: string,
    planCode: PlanCode,
    adminEmail: string,
  ): Promise<{ tenant: Tenant; created: boolean }> {
    const existing = await this.findByExternalId(externalTenantId);

    if (existing) {
      const changed = existing.planCode !== planCode;
      existing.planCode = planCode;
      existing.adminEmail = adminEmail;
      const updated = await this.tenantRepo.save(existing);
      if (changed) {
        this.logger.log(
          `[PLAN-CHANGED] externalTenantId=${externalTenantId} plan=${planCode}`,
        );
      }
      return { tenant: updated, created: false };
    }

    const name = adminEmail.split('@')[0];
    const slug = externalTenantId;
    // schemaId computed after save (we need the internal UUID first)
    const tenant = this.tenantRepo.create({ externalTenantId, planCode, adminEmail, name, slug });
    const created = await this.tenantRepo.save(tenant);
    created.schemaId = computeSchemaId(created.id);
    await this.tenantRepo.save(created);
    this.logger.log(
      `[TENANT-CREATED] id=${created.id} externalId=${externalTenantId} plan=${planCode}`,
    );
    return { tenant: created, created: true };
  }

  async deactivate(externalTenantId: string): Promise<void> {
    const tenant = await this.findByExternalId(externalTenantId);
    if (!tenant) throw new NotFoundException('Tenant introuvable');
    tenant.isActive = false;
    await this.tenantRepo.save(tenant);
    this.logger.log(`[TENANT-DEACTIVATED] externalId=${externalTenantId}`);
  }
}
