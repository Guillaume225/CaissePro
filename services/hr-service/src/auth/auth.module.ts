import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const privateKey = config.get<string>('jwt.privateKey');
        const publicKey = config.get<string>('jwt.publicKey');
        const useRS256 = publicKey && publicKey.includes('BEGIN');

        return useRS256
          ? {
              privateKey,
              publicKey,
              signOptions: { algorithm: 'RS256', expiresIn: config.get<string>('jwt.accessExpiration') || '15m' },
            }
          : {
              secret: 'caisseflow-dev-secret-change-me',
              signOptions: { expiresIn: config.get<string>('jwt.accessExpiration') || '15m' },
            };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
