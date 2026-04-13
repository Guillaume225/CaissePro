import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email: string;
  roleName: string;
  permissions: string[];
  departmentId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const publicKey = configService.get<string>('jwt.publicKey');
    const useRS256 = publicKey && publicKey.includes('BEGIN');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: useRS256 ? publicKey : configService.get<string>('jwt.secret'),
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
      departmentId: payload.departmentId,
    };
  }
}
