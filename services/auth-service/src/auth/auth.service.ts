import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { UserLogin } from '../entities/user-login.entity';
import { User } from '../entities/user.entity';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { JwtPayload, AuthTokens, LoginDto, LoginPinDto, MfaSetupResponse } from './dto';

/** Only accounts holding this permission may set or use a PIN — see cahier-chargeMobile.txt §6.3. */
const PIN_LOGIN_PERMISSION = 'da.approve';

const MFA_LOGIN_PREFIX = 'mfa_login:';
const MFA_SETUP_LOGIN_PREFIX = 'mfa_login_setup:';

export interface MfaChallengeResponse {
  requiresMfa?: boolean;
  requiresMfaSetup?: boolean;
  mfaToken?: string;
  setupToken?: string;
  secret?: string;
  qrCodeDataUrl?: string;
}

const BCRYPT_ROUNDS = 12;
const REFRESH_PREFIX = 'refresh:';
const BLACKLIST_PREFIX = 'bl:';
const RESET_TOKEN_PREFIX = 'reset:';
const LOGIN_ATTEMPTS_PREFIX = 'login_attempts:';
const PIN_ATTEMPTS_PREFIX = 'pin_attempts:';
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_SECONDS = 900;
const RESET_TOKEN_EXPIRY = 3600;

interface RedisUserRef {
  userId: string;
  tenantId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserLogin)
    private readonly userLoginRepo: Repository<UserLogin>,
    private readonly tenantDsService: TenantDataSourceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<AuthTokens | MfaChallengeResponse> {
    const attemptsKey = `${LOGIN_ATTEMPTS_PREFIX}${dto.email}`;
    const attempts = await this.redis.get(attemptsKey);
    if (attempts && parseInt(attempts, 10) >= MAX_LOGIN_ATTEMPTS) {
      throw new ForbiddenException(
        'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
      );
    }

    // Route to the right schema via global lookup table
    const loginEntry = await this.userLoginRepo.findOne({
      where: { email: dto.email, isActive: true },
    });
    if (!loginEntry) {
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

    const ds = await this.tenantDsService.getDataSource(loginEntry.tenantId);
    const user = await ds.getRepository(User).findOne({
      where: { email: dto.email },
      relations: ['role'],
    });

    if (!user) {
      await this.incrementLoginAttempts(attemptsKey);
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

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        if (!user.mfaSecret) {
          const secret = authenticator.generateSecret();
          const appName = this.configService.get<string>('app.mfaAppName') || 'CaisseFlowPro';
          const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
          const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

          const setupToken = uuidv4();
          await this.redis.set(
            `${MFA_SETUP_LOGIN_PREFIX}${setupToken}`,
            JSON.stringify({ userId: user.id, tenantId: loginEntry.tenantId, secret }),
            'EX', 600,
          );

          return { requiresMfaSetup: true, setupToken, secret, qrCodeDataUrl };
        }

        const mfaToken = uuidv4();
        await this.redis.set(
          `${MFA_LOGIN_PREFIX}${mfaToken}`,
          JSON.stringify({ userId: user.id, tenantId: loginEntry.tenantId }),
          'EX', 300,
        );
        return { requiresMfa: true, mfaToken };
      }

      if (!user.mfaSecret) {
        throw new BadRequestException('MFA is enabled but secret is missing. Complete MFA setup first.');
      }
      const isValid = authenticator.verify({ token: dto.mfaCode, secret: user.mfaSecret });
      if (!isValid) {
        await this.incrementLoginAttempts(attemptsKey);
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.redis.del(attemptsKey);
    await ds.getRepository(User).update(user.id, { lastLogin: new Date() });

    const tokens = await this.generateTokens(user, loginEntry.tenantId);

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

  /**
   * PIN-based login for the Valideur mobile app — replaces password entry on
   * mobile (biometric unlock on the device gates access to the PIN itself,
   * client-side; the server only ever sees the PIN). Restricted to accounts
   * holding PIN_LOGIN_PERMISSION and with a PIN already configured via
   * setPin(); the permission is re-checked here (not just at set-time) so a
   * demoted user's old PIN stops working immediately.
   */
  async loginPin(dto: LoginPinDto, ip: string, userAgent: string): Promise<AuthTokens | MfaChallengeResponse> {
    const attemptsKey = `${PIN_ATTEMPTS_PREFIX}${dto.email}`;
    const attempts = await this.redis.get(attemptsKey);
    if (attempts && parseInt(attempts, 10) >= MAX_LOGIN_ATTEMPTS) {
      throw new ForbiddenException(
        'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
      );
    }

    const loginEntry = await this.userLoginRepo.findOne({
      where: { email: dto.email, isActive: true },
    });
    if (!loginEntry) {
      await this.incrementLoginAttempts(attemptsKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    const ds = await this.tenantDsService.getDataSource(loginEntry.tenantId);
    const user = await ds.getRepository(User).findOne({
      where: { email: dto.email },
      relations: ['role'],
    });

    if (!user || !user.isActive) {
      await this.incrementLoginAttempts(attemptsKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.role.permissions.includes(PIN_LOGIN_PERMISSION) || !user.pinHash) {
      await this.incrementLoginAttempts(attemptsKey);
      throw new UnauthorizedException('PIN login is not available for this account');
    }

    const pinValid = await bcrypt.compare(dto.pin, user.pinHash);
    if (!pinValid) {
      await this.incrementLoginAttempts(attemptsKey);
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'auth',
        entityId: user.id,
        newValue: { reason: 'invalid_pin' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        const mfaToken = uuidv4();
        await this.redis.set(
          `${MFA_LOGIN_PREFIX}${mfaToken}`,
          JSON.stringify({ userId: user.id, tenantId: loginEntry.tenantId }),
          'EX', 300,
        );
        return { requiresMfa: true, mfaToken };
      }
      if (!user.mfaSecret) {
        throw new BadRequestException('MFA is enabled but secret is missing. Complete MFA setup first.');
      }
      const isValid = authenticator.verify({ token: dto.mfaCode, secret: user.mfaSecret });
      if (!isValid) {
        await this.incrementLoginAttempts(attemptsKey);
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.redis.del(attemptsKey);
    await ds.getRepository(User).update(user.id, { lastLogin: new Date() });

    const tokens = await this.generateTokens(user, loginEntry.tenantId);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'auth',
      entityId: user.id,
      newValue: { method: 'pin' },
      ipAddress: ip,
      userAgent,
    });

    return tokens;
  }

  /** Sets or changes the calling user's mobile PIN. Restricted to PIN_LOGIN_PERMISSION holders. */
  async setPin(userId: string, tenantId: string, pin: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const user = await ds.getRepository(User).findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.role.permissions.includes(PIN_LOGIN_PERMISSION)) {
      throw new ForbiddenException('PIN login is reserved to accounts that can validate purchase requests');
    }

    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    await ds.getRepository(User).update(userId, { pinHash });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'user',
      entityId: userId,
      newValue: { pinConfigured: true },
    });
  }

  /** Removes the calling user's mobile PIN, forcing password login again. */
  async removePin(userId: string, tenantId: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    await ds.getRepository(User).update(userId, { pinHash: null });
  }

  async refresh(refreshToken: string, ip: string, userAgent: string): Promise<AuthTokens> {
    const raw = await this.redis.get(`${REFRESH_PREFIX}${refreshToken}`);
    if (!raw) throw new UnauthorizedException('Invalid or expired refresh token');

    const isBlacklisted = await this.redis.get(`${BLACKLIST_PREFIX}${refreshToken}`);
    if (isBlacklisted) throw new UnauthorizedException('Token has been revoked');

    const { userId, tenantId } = this.parseRedisUserRef(raw);

    const ds = await this.tenantDsService.getDataSource(tenantId);
    const user = await ds.getRepository(User).findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or disabled');

    await this.redis.del(`${REFRESH_PREFIX}${refreshToken}`);
    const tokens = await this.generateTokens(user, tenantId);

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
    await this.redis.set(
      `${BLACKLIST_PREFIX}${refreshToken}`,
      '1',
      'EX',
      7 * 24 * 3600,
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

  async verifyMfaLogin(mfaToken: string, code: string): Promise<AuthTokens> {
    const raw = await this.redis.get(`${MFA_LOGIN_PREFIX}${mfaToken}`);
    if (!raw) throw new BadRequestException('Invalid or expired MFA token');

    const { userId, tenantId } = this.parseRedisUserRef(raw);

    const ds = await this.tenantDsService.getDataSource(tenantId);
    const user = await ds.getRepository(User).findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user || !user.mfaSecret) throw new BadRequestException('User or MFA secret not found');

    const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!isValid) throw new UnauthorizedException('Invalid MFA code');

    await this.redis.del(`${MFA_LOGIN_PREFIX}${mfaToken}`);
    await ds.getRepository(User).update(user.id, { lastLogin: new Date() });

    return this.generateTokens(user, tenantId);
  }

  async setupVerifyMfa(setupToken: string, code: string): Promise<AuthTokens> {
    const raw = await this.redis.get(`${MFA_SETUP_LOGIN_PREFIX}${setupToken}`);
    if (!raw) {
      throw new BadRequestException('Invalid or expired setup token. Please restart the login process.');
    }

    let parsed: { userId: string; tenantId: string; secret: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Corrupted setup token data');
    }

    const isValid = authenticator.verify({ token: code, secret: parsed.secret });
    if (!isValid) throw new BadRequestException('Invalid verification code');

    const ds = await this.tenantDsService.getDataSource(parsed.tenantId);
    await ds.getRepository(User).update(parsed.userId, {
      mfaEnabled: true,
      mfaSecret: parsed.secret,
    });
    await this.redis.del(`${MFA_SETUP_LOGIN_PREFIX}${setupToken}`);

    const user = await ds.getRepository(User).findOne({
      where: { id: parsed.userId },
      relations: ['role'],
    });
    if (!user) throw new BadRequestException('User not found');

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.MFA_VERIFY,
      entityType: 'user',
      entityId: user.id,
      newValue: { mfaEnabled: true, setupDuringLogin: true },
    });

    return this.generateTokens(user, parsed.tenantId);
  }

  async setupMfa(userId: string, tenantId: string): Promise<MfaSetupResponse> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const user = await ds.getRepository(User).findOneOrFail({ where: { id: userId } });

    const secret = authenticator.generateSecret();
    const appName = this.configService.get<string>('app.mfaAppName') || 'CaisseFlowPro';
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await this.redis.set(`mfa_setup:${userId}`, JSON.stringify({ secret, tenantId }), 'EX', 600);

    await this.auditService.log({
      userId,
      action: AuditAction.MFA_SETUP,
      entityType: 'user',
      entityId: userId,
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async verifyMfa(userId: string, code: string): Promise<{ enabled: boolean }> {
    const raw = await this.redis.get(`mfa_setup:${userId}`);
    if (!raw) {
      throw new BadRequestException('No MFA setup in progress. Call /auth/mfa/setup first.');
    }

    let parsed: { secret: string; tenantId: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Corrupted MFA setup data');
    }

    const isValid = authenticator.verify({ token: code, secret: parsed.secret });
    if (!isValid) throw new BadRequestException('Invalid verification code');

    const ds = await this.tenantDsService.getDataSource(parsed.tenantId);
    await ds.getRepository(User).update(userId, {
      mfaEnabled: true,
      mfaSecret: parsed.secret,
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
    const loginEntry = await this.userLoginRepo.findOne({ where: { email, isActive: true } });
    if (!loginEntry) return;

    const ds = await this.tenantDsService.getDataSource(loginEntry.tenantId);
    const user = await ds.getRepository(User).findOne({ where: { email } });
    if (!user) return;

    const token = uuidv4();
    await this.redis.set(
      `${RESET_TOKEN_PREFIX}${token}`,
      JSON.stringify({ userId: user.id, tenantId: loginEntry.tenantId }),
      'EX', RESET_TOKEN_EXPIRY,
    );

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
    const raw = await this.redis.get(`${RESET_TOKEN_PREFIX}${token}`);
    if (!raw) throw new BadRequestException('Invalid or expired reset token');

    const { userId, tenantId } = this.parseRedisUserRef(raw);

    const ds = await this.tenantDsService.getDataSource(tenantId);
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await ds.getRepository(User).update(userId, {
      passwordHash: hash,
      passwordResetToken: null,
      passwordResetExpires: null,
      pinHash: null, // force PIN re-setup after a password reset
    });
    await this.redis.del(`${RESET_TOKEN_PREFIX}${token}`);

    // Invalidate existing sessions for this user
    const keys = await this.redis.keys(`${REFRESH_PREFIX}*`);
    for (const key of keys) {
      const storedRaw = await this.redis.get(key);
      if (!storedRaw) continue;
      try {
        const ref = this.parseRedisUserRef(storedRaw);
        if (ref.userId === userId) await this.redis.del(key);
      } catch { /* skip non-JSON legacy entries */ }
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

  private async generateTokens(user: User, tenantId: string): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleName: user.role.name,
      permissions: user.role.permissions,
      tenantId,
      companyId: user.companyId,
      departmentId: user.departmentId,
    };

    const privateKey = this.configService.get<string>('jwt.privateKey');
    const useRS256 = privateKey && privateKey.includes('BEGIN');

    const signOptions: Record<string, unknown> = {
      expiresIn: this.configService.get<string>('jwt.accessExpiration') || '30m',
      ...(useRS256
        ? { algorithm: 'RS256', privateKey }
        : { algorithm: 'HS256', secret: this.configService.get<string>('jwt.secret') || 'dev-secret-change-in-production' }),
    };

    const accessToken = this.jwtService.sign(payload, signOptions as unknown as JwtSignOptions);

    const refreshToken = uuidv4();
    const refreshExpRaw = this.configService.get<string>('jwt.refreshExpiration') || '7d';
    const refreshSeconds = this.parseExpiration(refreshExpRaw);

    const ref: RedisUserRef = { userId: user.id, tenantId };
    await this.redis.set(`${REFRESH_PREFIX}${refreshToken}`, JSON.stringify(ref), 'EX', refreshSeconds);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(this.configService.get<string>('jwt.accessExpiration') || '30m'),
    };
  }

  private parseRedisUserRef(raw: string): RedisUserRef {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.userId && parsed.tenantId) return parsed as RedisUserRef;
    } catch { /* fall through */ }
    // Legacy format: plain userId string (pre-migration sessions)
    throw new UnauthorizedException('Session expired, please log in again');
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
