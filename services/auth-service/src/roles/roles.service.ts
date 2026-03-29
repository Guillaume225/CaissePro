import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { ALL_PERMISSIONS } from '../common/permissions';
import { CreateRoleDto, UpdateRoleDto, RoleResponseDto } from './dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepo.find({ order: { name: 'ASC' } });
    return roles.map((r) => this.toResponseDto(r));
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return this.toResponseDto(role);
  }

  async create(
    dto: CreateRoleDto,
    actorId: string,
    ip?: string,
  ): Promise<RoleResponseDto> {
    const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Role name already exists');

    // Validate permissions
    const permissions = dto.permissions || [];
    const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p as any));
    if (invalid.length > 0) {
      throw new ConflictException(`Invalid permissions: ${invalid.join(', ')}`);
    }

    const role = this.roleRepo.create({
      name: dto.name,
      permissions,
      isSystem: false,
    });

    const saved = await this.roleRepo.save(role);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'role',
      entityId: saved.id,
      newValue: { name: dto.name, permissions },
      ipAddress: ip,
    });

    return this.toResponseDto(saved);
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    actorId: string,
    ip?: string,
  ): Promise<RoleResponseDto> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new ForbiddenException('Cannot rename a system role');
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Role name already exists');
      }
      oldValue.name = role.name;
      newValue.name = dto.name;
    }

    if (dto.permissions !== undefined) {
      const invalid = dto.permissions.filter((p) => !ALL_PERMISSIONS.includes(p as any));
      if (invalid.length > 0) {
        throw new ConflictException(`Invalid permissions: ${invalid.join(', ')}`);
      }
      oldValue.permissions = role.permissions;
      newValue.permissions = dto.permissions;
    }

    await this.roleRepo.update(id, dto);
    const updated = await this.roleRepo.findOneOrFail({ where: { id } });

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'role',
      entityId: id,
      oldValue,
      newValue,
      ipAddress: ip,
    });

    return this.toResponseDto(updated);
  }

  private toResponseDto(role: Role): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      permissions: role.permissions,
      isSystem: role.isSystem,
      createdAt: role.createdAt.toISOString(),
    };
  }
}
