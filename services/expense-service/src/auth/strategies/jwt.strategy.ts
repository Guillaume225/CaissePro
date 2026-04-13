import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const publicKey = config.get<string>('jwt.publicKey');
    const secret = config.get<string>('jwt.secret');

    const useRSA = publicKey && publicKey.includes('BEGIN');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...(useRSA
        ? { secretOrKey: publicKey, algorithms: ['RS256'] }
        : { secretOrKey: secret, algorithms: ['HS256'] }),
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    roleName: string;
    permissions: string[];
    tenantId: string;
    departmentId: string | null;
  }) {
    return {
      id: payload.sub,
      email: payload.email,
      roleName: payload.roleName,
      permissions: payload.permissions,
      tenantId: payload.tenantId,
      departmentId: payload.departmentId,
    };
  }
}
