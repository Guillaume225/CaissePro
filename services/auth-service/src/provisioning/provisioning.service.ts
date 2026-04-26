import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { TenantService } from '../tenant/tenant.service';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { UserLogin } from '../entities/user-login.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { getModulesForPlan } from '../plans/plans.config';
import { ALL_PERMISSIONS } from '../common/permissions';
import { ProvisionTenantDto } from './dto';

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantDsService: TenantDataSourceService,
    private readonly subscriptionService: SubscriptionService,
    @InjectRepository(UserLogin) private readonly userLoginRepo: Repository<UserLogin>,
    @InjectDataSource() private readonly masterDs: DataSource,
  ) {}

  private buildAccessInfo(schemaId: string | null): { subdomain: string; accessUrl: string } {
    const id = schemaId ?? '000000';
    return {
      subdomain: `gestion-${id}`,
      accessUrl: `https://gestion-${id}.i-management.website`,
    };
  }

  async provision(dto: ProvisionTenantDto): Promise<{
    tenantId: string;
    externalTenantId: string;
    planCode: string;
    created: boolean;
    schemaId?: string | null;
    subdomain?: string;
    accessUrl?: string;
    adminUserId?: string;
    temporaryPassword?: string;
  }> {
    const { tenant, created } = await this.tenantService.upsert(
      dto.externalTenantId,
      dto.externalPlanCode,
      dto.adminEmail,
    );

    await this.subscriptionService.invalidateCache(tenant.id);

    if (!created) {
      this.logger.log(
        `[PROVISIONING-UPDATE] tenant=${tenant.id} plan=${dto.externalPlanCode}`,
      );
      const access = this.buildAccessInfo(tenant.schemaId);
      return {
        tenantId: tenant.id,
        externalTenantId: tenant.externalTenantId,
        planCode: tenant.planCode,
        created: false,
        schemaId: tenant.schemaId,
        ...access,
      };
    }

    // Create the tenant's SQL Server schema and synchronize tables
    await this.createTenantSchema(tenant.id);

    const adminRole = await this.ensureAdminRole(tenant.id);
    const { user, temporaryPassword } = await this.createAdminUser(tenant.id, dto, adminRole.id);

    // Register admin in global login routing table
    await this.userLoginRepo.save(
      this.userLoginRepo.create({ email: dto.adminEmail, tenantId: tenant.id, isActive: true }),
    );

    const freshTenant = await this.tenantService.findById(tenant.id);
    const access = this.buildAccessInfo(freshTenant.schemaId);

    this.logger.log(
      `[PROVISIONING-CREATED] tenant=${tenant.id} schema=${tenantSchema(tenant.id)} schemaId=${freshTenant.schemaId} subdomain=${access.subdomain} adminUser=${user.id} plan=${dto.externalPlanCode}`,
    );

    return {
      tenantId: tenant.id,
      externalTenantId: tenant.externalTenantId,
      planCode: tenant.planCode,
      created: true,
      schemaId: freshTenant.schemaId,
      ...access,
      adminUserId: user.id,
      temporaryPassword,
    };
  }

  async deprovision(externalTenantId: string): Promise<void> {
    const tenant = await this.tenantService.findByExternalId(externalTenantId);
    if (tenant) {
      await this.tenantService.deactivate(externalTenantId);
      await this.subscriptionService.invalidateCache(tenant.id);
      this.logger.log(`[PROVISIONING-DEPROVISIONED] tenant=${tenant.id}`);
    }
  }

  private async createTenantSchema(tenantId: string): Promise<void> {
    const schema = tenantSchema(tenantId);
    const runner = this.masterDs.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(
        `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'${schema}') EXEC('CREATE SCHEMA [${schema}]')`,
      );
      this.logger.log(`[SCHEMA-CREATED] schema=${schema}`);
    } finally {
      await runner.release();
    }
    // Synchronize tenant entities (creates tables) in the new schema
    await this.tenantDsService.synchronizeSchema(tenantId);
  }

  private async ensureAdminRole(tenantId: string): Promise<Role> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    let role = await ds.getRepository(Role).findOne({ where: { name: 'Administrateur' } });
    if (!role) {
      role = ds.getRepository(Role).create({
        name: 'Administrateur',
        permissions: [...ALL_PERMISSIONS],
        isSystem: true,
      });
    } else {
      // Ensure existing admin role always has full permissions
      role.permissions = [...ALL_PERMISSIONS];
    }
    await ds.getRepository(Role).save(role);
    return role;
  }

  private async createAdminUser(
    tenantId: string,
    dto: ProvisionTenantDto,
    roleId: string,
  ): Promise<{ user: User; temporaryPassword: string }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);

    const temporaryPassword = uuidv4().slice(0, 16);
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    // Admin gets all modules so they can configure the full tenant regardless of plan
    const allModules = ['admin', 'expense', 'manager-caisse', 'fne', 'decision'];

    const user = ds.getRepository(User).create({
      email: dto.adminEmail,
      firstName: dto.adminFirstName ?? 'Admin',
      lastName: dto.adminLastName ?? 'Admin',
      passwordHash,
      roleId,
      companyId: null,
      isActive: true,
      allowedModules: JSON.stringify(allModules),
    });

    await ds.getRepository(User).save(user);
    return { user, temporaryPassword };
  }
}
