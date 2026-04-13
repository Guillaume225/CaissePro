import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for the Auth Service.
 *
 * Prerequisites:
 * - PostgreSQL running (see .env.example)
 * - Redis running (see .env.example)
 * - Environment variables configured or .env file present
 *
 * Run with: pnpm test:e2e
 */
describe('Auth Service (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should reject login with missing fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });

    it('should reject login with invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'Password1!' })
        .expect(400);
    });

    it('should reject login with wrong credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@caisseflow.com', password: 'WrongPassword1!' })
        .expect(401);
    });

    it('should login with valid seeded admin credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@caisseflow.com', password: 'CaisseFlow2026!' })
        .expect(201)
        .then((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
          accessToken = res.body.data.accessToken;
          refreshToken = res.body.data.refreshToken;
        });
    });
  });

  describe('/api/v1/auth/refresh (POST)', () => {
    it('should reject refresh with invalid token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should refresh tokens with valid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(201)
        .then((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
          accessToken = res.body.data.accessToken;
          refreshToken = res.body.data.refreshToken;
        });
    });
  });

  describe('/api/v1/users (GET)', () => {
    it('should reject unauthenticated access', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);
    });

    it('should return paginated users when authenticated', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('meta');
        });
    });
  });

  describe('/api/v1/users/me (GET)', () => {
    it('should return the current user profile', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('email');
        });
    });
  });

  describe('/api/v1/roles (GET)', () => {
    it('should return all roles when authenticated', () => {
      return request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/api/v1/auth/forgot-password (POST)', () => {
    it('should always return success (anti-enumeration)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' })
        .expect(201)
        .then((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('/api/v1/auth/reset-password (POST)', () => {
    it('should reject with invalid reset token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'fake-token', password: 'NewPassword1!' })
        .expect(400);
    });
  });

  describe('/api/v1/auth/logout (POST)', () => {
    it('should logout successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(201)
        .then((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });
});
