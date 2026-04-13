import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { AuditService } from '../audit/audit.service';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const mockRole = {
    id: 'role-uuid',
    name: 'ADMIN',
    permissions: ['expense.create', 'user.create'],
    isSystem: true,
  };

  const mockUser: Partial<User> = {
    id: 'user-uuid',
    email: 'admin@test.com',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'Admin',
    lastName: 'User',
    roleId: 'role-uuid',
    role: mockRole as unknown as Role,
    departmentId: null,
    isActive: true,
    mfaEnabled: false,
    mfaSecret: null,
    lastLogin: null,
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('access-token'),
      verify: jest.fn(),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      multi: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                'jwt.privateKey': '',
                'jwt.publicKey': '',
                'jwt.accessExpiration': '15m',
                'jwt.refreshExpiration': '7d',
                'app.mfaAppName': 'Test',
              };
              return map[key];
            }),
          },
        },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      const result = await service.login(
        { email: 'admin@test.com', password: 'Password1!' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(userRepo.update).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'bad@test.com', password: 'x' }, '127.0.0.1', 'ua'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      await expect(
        service.login({ email: 'admin@test.com', password: 'wrong' }, '127.0.0.1', 'ua'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when account is disabled', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.login({ email: 'admin@test.com', password: 'x' }, '127.0.0.1', 'ua'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException after too many attempts', async () => {
      redis.get.mockResolvedValue('5');

      await expect(
        service.login({ email: 'admin@test.com', password: 'x' }, '127.0.0.1', 'ua'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should require MFA code when mfaEnabled is true', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: true, mfaSecret: 'secret' });
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      await expect(
        service.login({ email: 'admin@test.com', password: 'Password1!' }, '127.0.0.1', 'ua'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      redis.get
        .mockResolvedValueOnce('user-uuid') // refresh token lookup
        .mockResolvedValueOnce(null); // blacklist check
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.refresh('valid-refresh', '127.0.0.1', 'ua');

      expect(result).toHaveProperty('accessToken');
      expect(redis.del).toHaveBeenCalled();
    });

    it('should throw for invalid refresh token', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.refresh('invalid', '127.0.0.1', 'ua')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should blacklist the refresh token', async () => {
      await service.logout('user-uuid', 'token', '127.0.0.1', 'ua');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('bl:'),
        '1',
        'EX',
        expect.any(Number),
      );
      expect(redis.del).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should not throw for non-existent email (anti-enumeration)', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.forgotPassword('nobody@test.com', '127.0.0.1')).resolves.toBeUndefined();
    });

    it('should store reset token in Redis for existing user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.forgotPassword('admin@test.com', '127.0.0.1');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('reset:'),
        'user-uuid',
        'EX',
        3600,
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password when token is valid', async () => {
      redis.get.mockResolvedValue('user-uuid');

      await service.resetPassword('valid-token', 'NewPassword1!', '127.0.0.1');

      expect(userRepo.update).toHaveBeenCalledWith(
        'user-uuid',
        expect.objectContaining({
          passwordHash: expect.any(String),
        }),
      );
      expect(redis.del).toHaveBeenCalled();
    });

    it('should throw for invalid reset token', async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'NewPassword1!', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('hashPassword', () => {
    it('should return a bcrypt hash', async () => {
      const hash = await service.hashPassword('Test123!');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });
});
