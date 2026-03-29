import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { User } from '../entities/user.entity';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import {
  JwtPayload,
  AuthTokens,
  LoginDto,
  MfaSetupResponse,
} from './dto';

const BCRYPT_ROUNDS = 12;
const REFRESH_PREFIX = 'refresh:';
const BLACKLIST_PREFIX = 'bl:';
const RESET_TOKEN_PREFIX = 'reset:';
const LOGIN_ATTEMPTS_PREFIX = 'login_attempts:';
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_SECONDS = 900; // 15 minutes
const RESET_TOKEN_EXPIRY = 3600; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<AuthTokens> {
    // Check rate limiting
    const attemptsKey = `${LOGIN_ATTEMPTS_PREFIX}${dto.email}`;
    const attempts = await this.redis.get(attemptsKey);
    if (attempts && parseInt(attempts, 10) >= MAX_LOGIN_ATTEMPTS) {
      throw new ForbiddenException(
        'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
      );
    }

    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: ['role'],
    });

    if (!user) {
      await this.incrementLoginAttempts(attemptsKey);
      await this.auditService.log({
        action: AuditAction.LOGIN_FAILED,
        entityType: 'auth',
        newValue: { email: dto.email, reason: 'user_not_found' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.incrementLoginAttempts(attemptsKey);
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'auth',
        entityId: user.id,
        newValue: { reason: 'invalid_password' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // If MFA enabled, verify code
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException('MFA code required');
      }
      if (!user.mfaSecret) {
        throw new BadRequestException('MFA is enabled but secret is missing');
      }
      const isValid = authenticator.verify({
        token: dto.mfaCode,
        secret: user.mfaSecret,
      });
      if (!isValid) {
        await this.incrementLoginAttempts(attemptsKey);
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Reset login attempts on success
    await this.redis.del(attemptsKey);

    // Update last login
    await this.userRepo.update(user.id, { lastLogin: new Date() });

    const tokens = await this.generateTokens(user);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'auth',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    return tokens;
  }

  async refresh(refreshToken: string, ip: string, userAgent: string): Promise<AuthTokens> {
    // Verify refresh token is in Redis
    const userId = await this.redis.get(`${REFRESH_PREFIX}${refreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check blacklist
    const isBlacklisted = await this.redis.get(`${BLACKLIST_PREFIX}${refreshToken}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or disabled');
    }

    // Revoke old refresh token
    await this.redis.del(`${REFRESH_PREFIX}${refreshToken}`);

    const tokens = await this.generateTokens(user);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.TOKEN_REFRESH,
      entityType: 'auth',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    return tokens;
  }

  async logout(userId: string, refreshToken: string, ip: string, userAgent: string): Promise<void> {
    // Blacklist the refresh token
    await this.redis.set(
      `${BLACKLIST_PREFIX}${refreshToken}`,
      '1',
      'EX',
      7 * 24 * 3600, // match refresh expiration
    );
    await this.redis.del(`${REFRESH_PREFIX}${refreshToken}`);

    await this.auditService.log({
      userId,
      action: AuditAction.LOGOUT,
      entityType: 'auth',
      entityId: userId,
      ipAddress: ip,
      userAgent,
    });
  }

  async setupMfa(userId: string): Promise<MfaSetupResponse> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    const secret = authenticator.generateSecret();
    const appName = this.configService.get<string>('app.mfaAppName') || 'CaisseFlowPro';
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily — will be confirmed on verify
    await this.redis.set(`mfa_setup:${userId}`, secret, 'EX', 600);

    await this.auditService.log({
      userId,
      action: AuditAction.MFA_SETUP,
      entityType: 'user',
      entityId: userId,
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async verifyMfa(userId: string, code: string): Promise<{ enabled: boolean }> {
    const secret = await this.redis.get(`mfa_setup:${userId}`);
    if (!secret) {
      throw new BadRequestException('No MFA setup in progress. Call /auth/mfa/setup first.');
    }

    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.userRepo.update(userId, {
      mfaEnabled: true,
      mfaSecret: secret,
    });
    await this.redis.del(`mfa_setup:${userId}`);

    await this.auditService.log({
      userId,
      action: AuditAction.MFA_VERIFY,
      entityType: 'user',
      entityId: userId,
      newValue: { mfaEnabled: true },
    });

    return { enabled: true };
  }

  async forgotPassword(email: string, ip: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email } });
    // Always return success to prevent user enumeration
    if (!user) return;

    const token = uuidv4();
    await this.redis.set(`${RESET_TOKEN_PREFIX}${token}`, user.id, 'EX', RESET_TOKEN_EXPIRY);

    // In production: send email with reset link.
    // For now, log the token.
    this.logger.log(`Password reset token for ${email}: ${token}`);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.PASSWORD_RESET_REQUEST,
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
    });
  }

  async resetPassword(token: string, newPassword: string, ip: string): Promise<void> {
    const userId = await this.redis.get(`${RESET_TOKEN_PREFIX}${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update(userId, {
      passwordHash: hash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });
    await this.redis.del(`${RESET_TOKEN_PREFIX}${token}`);

    // Invalidate all existing sessions by clearing refresh tokens pattern
    // This is a security measure after password reset
    const keys = await this.redis.keys(`${REFRESH_PREFIX}*`);
    for (const key of keys) {
      const storedUserId = await this.redis.get(key);
      if (storedUserId === userId) {
        await this.redis.del(key);
      }
    }

    await this.auditService.log({
      userId,
      action: AuditAction.PASSWORD_RESET,
      entityType: 'user',
      entityId: userId,
      ipAddress: ip,
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  // ──────── Private helpers ────────

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleName: user.role.name,
      permissions: user.role.permissions,
      departmentId: user.departmentId,
    };

    const privateKey = this.configService.get<string>('jwt.privateKey');
    const useRS256 = privateKey && privateKey.includes('BEGIN');

    const signOptions: Record<string, unknown> = {
      expiresIn: this.configService.get<string>('jwt.accessExpiration') || '15m',
      ...(useRS256
        ? { algorithm: 'RS256', privateKey }
        : { secret: 'caisseflow-dev-secret-change-me' }),
    };

    const accessToken = this.jwtService.sign(payload, signOptions as any);

    const refreshToken = uuidv4();
    const refreshExpRaw = this.configService.get<string>('jwt.refreshExpiration') || '7d';
    const refreshSeconds = this.parseExpiration(refreshExpRaw);

    await this.redis.set(
      `${REFRESH_PREFIX}${refreshToken}`,
      user.id,
      'EX',
      refreshSeconds,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(
        this.configService.get<string>('jwt.accessExpiration') || '15m',
      ),
    };
  }

  private async incrementLoginAttempts(key: string): Promise<void> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, LOGIN_BLOCK_SECONDS);
    await multi.exec();
  }

  private parseExpiration(exp: string): number {
    const match = exp.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900;
    const val = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return val;
      case 'm': return val * 60;
      case 'h': return val * 3600;
      case 'd': return val * 86400;
      default: return 900;
    }
  }
}
