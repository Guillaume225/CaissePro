import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Company } from '../entities/company.entity';
import { Service } from '../entities/service.entity';
import { UserLogin } from '../entities/user-login.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateUserDto, UpdateUserDto, ListUsersQueryDto, UserResponseDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserLogin)
    private readonly userLoginRepo: Repository<UserLogin>,
    private readonly tenantDsService: TenantDataSourceService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    query: ListUsersQueryDto,
  ): Promise<{
    data: UserResponseDto[];
    meta: { page: number; perPage: number; total: number; totalPages: number };
  }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(User);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);
    const skip = (page - 1) * perPage;

    const qb = repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.companies', 'companies')
      .leftJoinAndSelect('user.service', 'service')
      .leftJoinAndSelect('service.department', 'department')
      .skip(skip)
      .take(perPage)
      .orderBy('user.createdAt', 'DESC');

    if (query.roleId) qb.andWhere('user.role_id = :roleId', { roleId: query.roleId });
    if (query.isActive !== undefined) qb.andWhere('user.is_active = :isActive', { isActive: query.isActive });
    if (query.search) {
      qb.andWhere(
        '(user.first_name LIKE :search OR user.last_name LIKE :search OR user.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await qb.getManyAndCount();

    return {
      data: users.map((u) => this.toResponseDto(u, tenantId)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findById(id: string, tenantId: string): Promise<UserResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const user = await ds.getRepository(User).findOne({
      where: { id },
      relations: ['role', 'company', 'companies', 'service', 'service.department'],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponseDto(user, tenantId);
  }

  async getMe(userId: string, tenantId: string): Promise<UserResponseDto> {
    return this.findById(userId, tenantId);
  }

  async create(
    dto: CreateUserDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ): Promise<UserResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);

    const existing = await ds.getRepository(User).findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const role = await ds.getRepository(Role).findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const passwordHash = await this.authService.hashPassword(dto.password);

    let departmentId = dto.departmentId || null;
    if (dto.serviceId) {
      const svc = await ds.getRepository(Service).findOne({ where: { id: dto.serviceId } });
      if (!svc) throw new NotFoundException('Service not found');
      departmentId = svc.departmentId;
    }

    const user = ds.getRepository(User).create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roleId: dto.roleId,
      serviceId: dto.serviceId || null,
      departmentId,
      companyId: dto.companyId || null,
      allowedModules: dto.allowedModules ? JSON.stringify(dto.allowedModules) : null,
    });

    const saved = await ds.getRepository(User).save(user);

    if (dto.companyIds && dto.companyIds.length > 0) {
      const companies = await ds.getRepository(Company).find({ where: { id: In(dto.companyIds) } });
      saved.companies = companies;
      if (!saved.companyId && companies.length > 0) saved.companyId = companies[0].id;
      await ds.getRepository(User).save(saved);
    }

    // Register in global login routing table
    await this.userLoginRepo.save(
      this.userLoginRepo.create({ email: dto.email, tenantId, isActive: true }),
    );

    const full = await ds.getRepository(User).findOneOrFail({
      where: { id: saved.id },
      relations: ['role', 'company', 'companies', 'service', 'service.department'],
    });

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'user',
      entityId: saved.id,
      newValue: { email: dto.email, firstName: dto.firstName, lastName: dto.lastName, roleId: dto.roleId },
      ipAddress: ip,
    });

    return this.toResponseDto(full, tenantId);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ): Promise<UserResponseDto> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const user = await ds.getRepository(User).findOne({
      where: { id },
      relations: ['role', 'company', 'companies', 'service', 'service.department'],
    });
    if (!user) throw new NotFoundException('User not found');

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (dto.firstName !== undefined) { oldValue.firstName = user.firstName; newValue.firstName = dto.firstName; }
    if (dto.lastName !== undefined) { oldValue.lastName = user.lastName; newValue.lastName = dto.lastName; }
    if (dto.roleId !== undefined) {
      const role = await ds.getRepository(Role).findOne({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found');
      oldValue.roleId = user.roleId; newValue.roleId = dto.roleId;
    }
    if (dto.departmentId !== undefined) { oldValue.departmentId = user.departmentId; newValue.departmentId = dto.departmentId; }
    let derivedDepartmentId: string | null | undefined;
    if (dto.serviceId !== undefined) {
      oldValue.serviceId = user.serviceId;
      newValue.serviceId = dto.serviceId;
      if (dto.serviceId) {
        const svc = await ds.getRepository(Service).findOne({ where: { id: dto.serviceId } });
        if (!svc) throw new NotFoundException('Service not found');
        derivedDepartmentId = svc.departmentId;
      } else {
        derivedDepartmentId = null;
      }
    }
    if (dto.companyId !== undefined) { oldValue.companyId = user.companyId; newValue.companyId = dto.companyId; }
    if (dto.companyIds !== undefined) {
      oldValue.companyIds = (user.companies || []).map((c) => c.id);
      newValue.companyIds = dto.companyIds;
    }
    if (dto.isActive !== undefined) { oldValue.isActive = user.isActive; newValue.isActive = dto.isActive; }
    if (dto.mfaEnabled !== undefined) { oldValue.mfaEnabled = user.mfaEnabled; newValue.mfaEnabled = dto.mfaEnabled; }
    if (dto.allowedModules !== undefined) { oldValue.allowedModules = user.allowedModules; newValue.allowedModules = dto.allowedModules; }

    const updatePayload: Record<string, unknown> = { ...dto };
    delete updatePayload.companyIds;
    delete updatePayload.mfaConfigured;
    if (dto.allowedModules !== undefined) updatePayload.allowedModules = JSON.stringify(dto.allowedModules);
    if (dto.mfaEnabled === false || dto.mfaConfigured === false) updatePayload.mfaSecret = null;
    if (derivedDepartmentId !== undefined) updatePayload.departmentId = derivedDepartmentId;

    await ds.getRepository(User).update(id, updatePayload);

    if (dto.companyIds !== undefined) {
      const companies =
        dto.companyIds.length > 0
          ? await ds.getRepository(Company).find({ where: { id: In(dto.companyIds) } })
          : [];
      const userToSave = await ds.getRepository(User).findOneOrFail({ where: { id }, relations: ['companies'] });
      userToSave.companies = companies;
      if (companies.length > 0 && !companies.find((c) => c.id === userToSave.companyId)) {
        userToSave.companyId = companies[0].id;
        await ds.getRepository(User).update(id, { companyId: companies[0].id });
      } else if (companies.length === 0) {
        userToSave.companyId = null;
        await ds.getRepository(User).update(id, { companyId: null });
      }
      await ds.getRepository(User).save(userToSave);
    }

    // Sync active status to login routing table
    if (dto.isActive !== undefined) {
      await this.userLoginRepo.update({ email: user.email }, { isActive: dto.isActive });
    }

    const updated = await ds.getRepository(User).findOneOrFail({
      where: { id },
      relations: ['role', 'company', 'companies', 'service', 'service.department'],
    });

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'user',
      entityId: id,
      oldValue,
      newValue,
      ipAddress: ip,
    });

    return this.toResponseDto(updated, tenantId);
  }

  async softDelete(id: string, tenantId: string, actorId: string, ip?: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const user = await ds.getRepository(User).findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await ds.getRepository(User).softDelete(id);
    await this.userLoginRepo.update({ email: user.email }, { isActive: false });

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'user',
      entityId: id,
      oldValue: { email: user.email },
      ipAddress: ip,
    });
  }

  private toResponseDto(user: User, tenantId: string): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      roleId: user.roleId,
      roleName: user.role?.name || '',
      permissions: user.role?.permissions || [],
      tenantId,
      departmentId: user.departmentId,
      departmentName: user.service?.department?.name ?? null,
      serviceId: user.serviceId,
      serviceName: user.service?.name ?? null,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      companyIds: (user.companies || []).map((c) => c.id),
      companyNames: (user.companies || []).map((c) => c.name),
      isActive: user.isActive,
      mfaEnabled: user.mfaEnabled,
      mfaConfigured: user.mfaEnabled && !!user.mfaSecret,
      lastLogin: user.lastLogin?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      allowedModules: user.allowedModules ? JSON.parse(user.allowedModules) : [],
    };
  }
}
