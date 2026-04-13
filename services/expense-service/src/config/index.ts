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
  port: parseInt(process.env.PORT || '3002', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
}));

export const workflowConfig = registerAs('workflow', () => ({
  /** Seuil S1 au-delà duquel l'approbation L2 (DAF) est requise — en FCFA */
  approvalThresholdL2: parseInt(process.env.APPROVAL_THRESHOLD_L2 || '500000', 10),
  /** Rôles autorisés pour l'approbation L2 */
  l2Roles: (process.env.L2_ROLES || 'DAF,ADMIN').split(',').map((r) => r.trim()),
  /** Rôle requis pour le décaissement */
  cashierRole: process.env.CASHIER_ROLE || 'CAISSIER_DEPENSES',
}));

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
}));

export const uploadConfig = registerAs('upload', () => ({
  dir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  maxFiles: parseInt(process.env.MAX_FILES || '5', 10),
}));

export const cashClosingConfig = registerAs('cashClosing', () => ({
  /** Seuil d'écart (en FCFA) au-delà duquel une alerte DAF est déclenchée */
  varianceThreshold: parseInt(process.env.CASH_CLOSING_VARIANCE_THRESHOLD || '5000', 10),
  /** Heure du rappel automatique (format 24h) */
  reminderHour: parseInt(process.env.CASH_CLOSING_REMINDER_HOUR || '18', 10),
}));
