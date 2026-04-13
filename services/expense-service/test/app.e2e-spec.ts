import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

/**
 * E2E tests for the expense-service.
 * These require a running PostgreSQL, Redis, and RabbitMQ instance.
 * Run with: pnpm test:e2e
 *
 * NOTE: In CI, these are typically run against docker-compose services.
 * For local dev, ensure services are running or skip with:
 *   SKIP_E2E=true pnpm test:e2e
 */
describe('ExpenseService (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (process.env.SKIP_E2E === 'true') return;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should be defined', () => {
    if (process.env.SKIP_E2E === 'true') return;
    expect(app).toBeDefined();
  });

  describe('GET /api/v1/categories', () => {
    it('should require authentication', async () => {
      if (process.env.SKIP_E2E === 'true') return;
      const res = await request(app.getHttpServer()).get('/api/v1/categories');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/expenses', () => {
    it('should require authentication', async () => {
      if (process.env.SKIP_E2E === 'true') return;
      const res = await request(app.getHttpServer()).get('/api/v1/expenses');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/budgets', () => {
    it('should require authentication', async () => {
      if (process.env.SKIP_E2E === 'true') return;
      const res = await request(app.getHttpServer()).get('/api/v1/budgets');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/advances', () => {
    it('should require authentication', async () => {
      if (process.env.SKIP_E2E === 'true') return;
      const res = await request(app.getHttpServer()).get('/api/v1/advances');
      expect(res.status).toBe(401);
    });
  });
});
