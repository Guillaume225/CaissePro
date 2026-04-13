import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  roleName: string;
  permissions: string[];
  tenantId: string;
  departmentId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const publicKey = configService.get<string>('jwt.publicKey');
    const useRS256 = publicKey && publicKey.includes('BEGIN');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: useRS256 ? publicKey : 'caisseflow-dev-secret-change-me',
      algorithms: useRS256 ? ['RS256'] : ['HS256'],
    });
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
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
