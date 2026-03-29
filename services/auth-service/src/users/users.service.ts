import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  ListUsersQueryDto,
  UserResponseDto,
} from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
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
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponseDto(user);
  }

  async create(
    dto: CreateUserDto,
    actorId: string,
    ip?: string,
  ): Promise<UserResponseDto> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roleId: dto.roleId,
      departmentId: dto.departmentId || null,
    });

    const saved = await this.userRepo.save(user);
    const full = await this.userRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['role'],
    });

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'user',
      entityId: saved.id,
      newValue: { email: dto.email, firstName: dto.firstName, lastName: dto.lastName, roleId: dto.roleId },
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
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('User not found');

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (dto.firstName !== undefined) { oldValue.firstName = user.firstName; newValue.firstName = dto.firstName; }
    if (dto.lastName !== undefined) { oldValue.lastName = user.lastName; newValue.lastName = dto.lastName; }
    if (dto.roleId !== undefined) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found');
      oldValue.roleId = user.roleId;
      newValue.roleId = dto.roleId;
    }
    if (dto.departmentId !== undefined) { oldValue.departmentId = user.departmentId; newValue.departmentId = dto.departmentId; }
    if (dto.isActive !== undefined) { oldValue.isActive = user.isActive; newValue.isActive = dto.isActive; }

    await this.userRepo.update(id, dto);
    const updated = await this.userRepo.findOneOrFail({
      where: { id },
      relations: ['role'],
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
      departmentId: user.departmentId,
      isActive: user.isActive,
      mfaEnabled: user.mfaEnabled,
      lastLogin: user.lastLogin?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
