import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  username: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Toi&MoiSaFait1',
  database: process.env.DB_NAME || 'caisseflow',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const jwtConfig = registerAs('jwt', () => ({
  publicKey: (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
}));

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3003', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
}));

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
}));

export const salesConfig = registerAs('sales', () => ({
  /** Taux TVA par défaut en Côte d'Ivoire (18 %) */
  defaultVatRate: parseFloat(process.env.DEFAULT_VAT_RATE || '18'),
  /** Plafonds de remise par rôle (en %) */
  discountCeilings: {
    COMMERCIAL: parseFloat(process.env.DISCOUNT_CEIL_COMMERCIAL || '10'),
    MANAGER: parseFloat(process.env.DISCOUNT_CEIL_MANAGER || '20'),
    DAF: parseFloat(process.env.DISCOUNT_CEIL_DAF || '100'),
    ADMIN: parseFloat(process.env.DISCOUNT_CEIL_ADMIN || '100'),
  } as Record<string, number>,
}));

export const cashClosingConfig = registerAs('cashClosing', () => ({
  /** Seuil d'écart (en FCFA) au-delà duquel une alerte DAF est déclenchée */
  varianceThreshold: parseInt(process.env.CASH_CLOSING_VARIANCE_THRESHOLD || '5000', 10),
  /** Heure du rappel automatique (format 24h) */
  reminderHour: parseInt(process.env.CASH_CLOSING_REMINDER_HOUR || '18', 10),
}));

export const fneConfig = registerAs('fne', () => ({
  apiUrl: process.env.FNE_API_URL || 'http://54.247.95.108/ws',
  apiKey: process.env.FNE_API_KEY || '',
  maxRetries: parseInt(process.env.FNE_MAX_RETRIES || '3', 10),
}));
