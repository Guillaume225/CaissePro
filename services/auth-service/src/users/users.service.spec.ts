import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: Record<string, jest.Mock>;
  let roleRepo: Record<string, jest.Mock>;
  let authService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const mockRole = {
    id: 'role-uuid',
    name: 'CAISSIER_VENTE',
    permissions: ['sale.create'],
    isSystem: true,
  };

  const mockUser = {
    id: 'user-uuid',
    email: 'user@test.com',
    firstName: 'John',
    lastName: 'Doe',
    passwordHash: 'hashed',
    roleId: 'role-uuid',
    role: mockRole,
    departmentId: null,
    isActive: true,
    mfaEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue(mockUser),
      create: jest.fn((dto: any) => ({ ...dto, id: 'new-uuid' })),
      save: jest.fn((entity: any) => Promise.resolve({ ...mockUser, ...entity })),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
      }),
    };
    roleRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
    };
    authService = {
      hashPassword: jest.fn().mockResolvedValue('hashed-pw'),
    };
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: AuthService, useValue: authService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const result = await service.findAll({ page: 1, perPage: 20 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply search filter', async () => {
      await service.findAll({ page: 1, perPage: 20, search: 'john' });

      const qb = userRepo.createQueryBuilder();
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-uuid');

      expect(result).toBeDefined();
      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-uuid' } }),
      );
    });

    it('should throw NotFoundException for missing user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a user with hashed password', async () => {
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(mockRole);

      const dto = {
        email: 'new@test.com',
        password: 'Password1!',
        firstName: 'New',
        lastName: 'User',
        roleId: 'role-uuid',
      };

      const result = await service.create(dto, 'admin-uuid');

      expect(authService.hashPassword).toHaveBeenCalledWith('Password1!');
      expect(userRepo.save).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ConflictException for duplicate email', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create(
          { email: 'user@test.com', password: 'P1!aaaa', firstName: 'A', lastName: 'B', roleId: 'x' },
          'admin-uuid',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for invalid roleId', async () => {
      userRepo.findOne.mockResolvedValue(null);
      roleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          { email: 'new@test.com', password: 'P1!aaaa', firstName: 'A', lastName: 'B', roleId: 'bad' },
          'admin-uuid',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.softDelete('user-uuid', 'admin-uuid');

      expect(userRepo.softDelete).toHaveBeenCalledWith('user-uuid');
      expect(auditService.log).toHaveBeenCalled();
    });
  });
});
