import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DbService } from '../src/database/db.service';
import { RedisService } from '../src/redis/redis.service';
import { QueueService } from '../src/jobs/queue.service';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
jest.mock('@upstash/ratelimit', () => {
  const mockRatelimitInstance = {
    limit: jest.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    }),
  };

  const mockRatelimitClass = jest.fn().mockImplementation(() => mockRatelimitInstance);
  (mockRatelimitClass as any).slidingWindow = jest.fn();

  return {
    Ratelimit: mockRatelimitClass,
  };
});

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'e2e@example.com',
    passwordHash: 'hashed-password',
    name: 'E2E User',
    role: 'member',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockDbQuery = {
    users: {
      findFirst: jest.fn(),
    },
    refreshTokens: {
      findFirst: jest.fn(),
    },
  };

  const mockDb = {
    query: mockDbQuery,
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };

  const mockRedis = {
    getCached: jest.fn(),
    setCached: jest.fn(),
    invalidate: jest.fn(),
  };

  const mockQueue = {
    welcomeEmailQueue: {
      add: jest.fn(),
    },
  };

  beforeAll(async () => {
    // Set fallback dummy env vars for CI environments where .env doesn't exist
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-secret';
    process.env.UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379';
    process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:6379';
    process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'test-token';
    process.env.R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'test-account-id';
    process.env.R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'test-access-key-id';
    process.env.R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'test-secret-access-key';
    process.env.R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'test-bucket';
    process.env.R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'http://localhost:9000';

    // Override the stateful external database and redis dependencies
    // with our test doubles.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DbService)
      .useValue({ db: mockDb })
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .overrideProvider(QueueService)
      .useValue(mockQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/auth/register (POST)', () => {
    it('should return 400 if validation fails (missing fields)', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid-email' })
        .expect(400);
    });

    it('should register successfully and set access/refresh token cookies', async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockDb.returning.mockResolvedValue([mockUser]);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'e2e@example.com',
          password: 'password123',
          name: 'E2E User',
        })
        .expect(201);

      expect(response.body).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
      });

      // Verify cookies are set in headers
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('pharos_access_token'))).toBe(true);
      expect(cookies.some((c) => c.includes('pharos_refresh_token'))).toBe(true);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should log in successfully and return user data with cookies', async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
      });

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('pharos_access_token'))).toBe(true);
    });
  });
});
