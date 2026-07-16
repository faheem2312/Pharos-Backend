import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DbService } from '../../database/db.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../../jobs/queue.service';
import { LogsService } from '../../logs/logs.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let dbService: jest.Mocked<any>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let queueService: jest.Mocked<any>;
  let logsService: jest.Mocked<LogsService>;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
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

  beforeEach(async () => {
    // Standard mock builder for Drizzle queries
    const mockDb = {
      query: mockDbQuery,
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };

    const mockJwt = {
      sign: jest.fn(),
    };

    const mockConfig = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    const mockQueue = {
      welcomeEmailQueue: {
        add: jest.fn(),
      },
    };

    const mockLogs = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DbService, useValue: { db: mockDb } },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: QueueService, useValue: mockQueue },
        { provide: LogsService, useValue: mockLogs },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    dbService = module.get(DbService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    queueService = module.get(QueueService);
    logsService = module.get(LogsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if user email already exists', async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockDbQuery.users.findFirst).toHaveBeenCalled();
    });

    it('should hash password, insert user, emit logs, queue welcome email and return tokens', async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      dbService.db.returning.mockResolvedValue([mockUser]);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      configService.getOrThrow.mockReturnValue('secret');
      configService.get.mockReturnValue('15m');

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(dbService.db.insert).toHaveBeenCalled();
      expect(logsService.record).toHaveBeenCalledWith(
        'user.registered',
        'test@example.com created an account',
        { userId: mockUser.id },
      );
      expect(queueService.welcomeEmailQueue.add).toHaveBeenCalledWith(
        'send-welcome-email',
        { userId: mockUser.id, email: mockUser.email, name: mockUser.name },
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: mockUser.id, email: mockUser.email, role: mockUser.role },
      });
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(logsService.record).toHaveBeenCalledWith(
        'user.login_failed',
        'Failed login attempt for unknown@example.com',
      );
    });

    it('should throw UnauthorizedException if password check fails', async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(logsService.record).toHaveBeenCalledWith(
        'user.login_failed',
        'Failed login attempt for test@example.com',
      );
    });

    it('should issue tokens, log event and return user on successful login', async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      configService.getOrThrow.mockReturnValue('secret');
      configService.get.mockReturnValue('15m');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(logsService.record).toHaveBeenCalledWith(
        'user.login_success',
        'test@example.com logged in',
        { userId: mockUser.id },
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: mockUser.id, email: mockUser.email, role: mockUser.role },
      });
    });
  });
});
