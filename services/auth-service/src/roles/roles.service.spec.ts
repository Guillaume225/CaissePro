import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';
import { AuditService } from '../audit/audit.service';

describe('RolesService', () => {
  let service: RolesService;
  let roleRepo: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const mockRole = {
    id: 'role-uuid',
    name: 'CAISSIER_VENTE',
    permissions: ['sale.create', 'sale.read'],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    roleRepo = {
      find: jest.fn().mockResolvedValue([mockRole]),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((dto: Record<string, unknown>) => ({ ...dto, id: 'new-uuid' })),
      save: jest.fn((entity: Record<string, unknown>) => Promise.resolve({ ...mockRole, ...entity })),
    };
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(roleRepo.find).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return role by id', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole);

      const result = await service.findById('role-uuid');

      expect(result).toBeDefined();
      expect(result.name).toBe('CAISSIER_VENTE');
    });

    it('should throw NotFoundException for missing role', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a role with valid permissions', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      const dto = { name: 'CUSTOM_ROLE', permissions: ['sale.create'] };
      const result = await service.create(dto, 'admin-uuid');

      expect(result).toBeDefined();
      expect(roleRepo.save).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should throw ConflictException for invalid permissions', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      const dto = { name: 'BAD_ROLE', permissions: ['invalid.permission'] };

      await expect(service.create(dto, 'admin-uuid')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate name', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole);

      const dto = { name: 'CAISSIER_VENTE', permissions: ['sale.create'] };

      await expect(service.create(dto, 'admin-uuid')).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update a non-system role', async () => {
      const nonSystemRole = { ...mockRole, isSystem: false };
      roleRepo.findOne.mockResolvedValue(nonSystemRole);
      roleRepo.findOneOrFail.mockResolvedValue({ ...nonSystemRole, permissions: ['sale.create'] });

      const result = await service.update('role-uuid', { permissions: ['sale.create'] }, 'admin-uuid');

      expect(result).toBeDefined();
      expect(roleRepo.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when renaming a system role', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole);

      await expect(
        service.update('role-uuid', { name: 'NEW_NAME' }, 'admin-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
