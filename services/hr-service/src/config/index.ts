import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  username: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Toi&MoiSaFait1',
  database: process.env.DB_NAME || 'caisseflow',
}));

export const jwtConfig = registerAs('jwt', () => ({
  privateKey: (process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  publicKey: (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
  accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3006', 10),
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
}));
