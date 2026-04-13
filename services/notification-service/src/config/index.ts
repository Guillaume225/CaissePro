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
  port: parseInt(process.env.PORT || '3005', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
}));

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
}));

export const smtpConfig = registerAs('smtp', () => ({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  password: process.env.SMTP_PASSWORD || '',
  from: process.env.SMTP_FROM || 'CaisseFlow <noreply@caisseflow.com>',
}));

export const smsConfig = registerAs('sms', () => ({
  provider: process.env.SMS_PROVIDER || 'twilio',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  apiUrl: process.env.SMS_API_URL || '',
  apiKey: process.env.SMS_API_KEY || '',
}));
