import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Company } from '../entities/company.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CreateUserDto, UpdateUserDto, ListUsersQueryDto, UserResponseDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: ListUsersQueryDto): Promise<{
    data: UserResponseDto[];
    meta: { page: number; perPage: number; total: number; totalPages: number };
  }> {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (query.roleId) where.roleId = query.roleId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.companies', 'companies')
      .skip(skip)
      .take(perPage)
      .orderBy('user.createdAt', 'DESC');

    if (query.roleId) {
      qb.andWhere('user.role_id = :roleId', { roleId: query.roleId });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('user.is_active = :isActive', { isActive: query.isActive });
    }
    if (query.search) {
      qb.andWhere(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await qb.getManyAndCount();

    return {
      data: users.map((u) => this.toResponseDto(u)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role', 'company', 'companies'],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponseDto(user);
  }

  async create(dto: CreateUserDto, actorId: string, ip?: string): Promise<UserResponseDto> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');

    // Inherit tenantId from the actor (the admin creating this user)
    const actor = await this.userRepo.findOne({ where: { id: actorId } });
    if (!actor) throw new NotFoundException('Actor not found');

    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roleId: dto.roleId,
      tenantId: actor.tenantId,
      departmentId: dto.departmentId || null,
      companyId: dto.companyId || null,
      allowedModules: dto.allowedModules ? JSON.stringify(dto.allowedModules) : null,
    });

    const saved = await this.userRepo.save(user);

    // Assign companies (many-to-many)
    if (dto.companyIds && dto.companyIds.length > 0) {
      const companies = await this.companyRepo.find({ where: { id: In(dto.companyIds) } });
      saved.companies = companies;
      // Set active company to first if not specified
      if (!saved.companyId && companies.length > 0) {
        saved.companyId = companies[0].id;
      }
      await this.userRepo.save(saved);
    }

    const full = await this.userRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['role', 'company', 'companies'],
    });

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'user',
      entityId: saved.id,
      newValue: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
      },
      ipAddress: ip,
    });

    return this.toResponseDto(full);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    ip?: string,
  ): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role', 'company', 'companies'],
    });
    if (!user) throw new NotFoundException('User not found');

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (dto.firstName !== undefined) {
      oldValue.firstName = user.firstName;
      newValue.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      oldValue.lastName = user.lastName;
      newValue.lastName = dto.lastName;
    }
    if (dto.roleId !== undefined) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found');
      oldValue.roleId = user.roleId;
      newValue.roleId = dto.roleId;
    }
    if (dto.departmentId !== undefined) {
      oldValue.departmentId = user.departmentId;
      newValue.departmentId = dto.departmentId;
    }
    if (dto.companyId !== undefined) {
      oldValue.companyId = user.companyId;
      newValue.companyId = dto.companyId;
    }
    if (dto.companyIds !== undefined) {
      oldValue.companyIds = (user.companies || []).map((c) => c.id);
      newValue.companyIds = dto.companyIds;
    }
    if (dto.isActive !== undefined) {
      oldValue.isActive = user.isActive;
      newValue.isActive = dto.isActive;
    }
    if (dto.mfaEnabled !== undefined) {
      oldValue.mfaEnabled = user.mfaEnabled;
      newValue.mfaEnabled = dto.mfaEnabled;
    }
    if (dto.allowedModules !== undefined) {
      oldValue.allowedModules = user.allowedModules;
      newValue.allowedModules = dto.allowedModules;
    }

    const updatePayload: Record<string, unknown> = { ...dto };
    delete updatePayload.companyIds; // handled separately
    delete updatePayload.mfaConfigured; // derived field, not a column
    if (dto.allowedModules !== undefined) {
      updatePayload.allowedModules = JSON.stringify(dto.allowedModules);
    }
    // When disabling MFA or resetting configuration, clear the secret
    if (dto.mfaEnabled === false || dto.mfaConfigured === false) {
      updatePayload.mfaSecret = null;
    }
    await this.userRepo.update(id, updatePayload);

    // Update many-to-many company assignments
    if (dto.companyIds !== undefined) {
      const companies =
        dto.companyIds.length > 0
          ? await this.companyRepo.find({ where: { id: In(dto.companyIds) } })
          : [];
      const userToSave = await this.userRepo.findOneOrFail({
        where: { id },
        relations: ['companies'],
      });
      userToSave.companies = companies;
      // If active company is not in the new list, reset to first
      if (companies.length > 0 && !companies.find((c) => c.id === userToSave.companyId)) {
        userToSave.companyId = companies[0].id;
        await this.userRepo.update(id, { companyId: companies[0].id });
      } else if (companies.length === 0) {
        userToSave.companyId = null;
        await this.userRepo.update(id, { companyId: null });
      }
      await this.userRepo.save(userToSave);
    }
    const updated = await this.userRepo.findOneOrFail({
      where: { id },
      relations: ['role', 'company', 'companies'],
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

    return this.toResponseDto(updated);
  }

  async softDelete(id: string, actorId: string, ip?: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.softDelete(id);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'user',
      entityId: id,
      oldValue: { email: user.email },
      ipAddress: ip,
    });
  }

  private toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      roleId: user.roleId,
      roleName: user.role?.name || '',
      permissions: user.role?.permissions || [],
      tenantId: user.tenantId,
      departmentId: user.departmentId,
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
