import { Test, TestingModule } from '@nestjs/testing';
import { TicketService } from './ticket.service';
import { RedisService } from '../redis/redis.service';

describe('TicketService', () => {
  let service: TicketService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      getCached: jest.fn(),
      setCached: jest.fn(),
      invalidate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueTicket', () => {
    it('should generate a 48-character hex ticket and save to redis with 30s TTL', async () => {
      const userId = 'user-uuid-123';
      const ticket = await service.issueTicket(userId);

      expect(ticket).toHaveLength(48); // 24 bytes in hex
      expect(redisService.setCached).toHaveBeenCalledWith(
        `ws_ticket:${ticket}`,
        { userId },
        30,
      );
    });
  });

  describe('redeemTicket', () => {
    it('should return null if ticket does not exist in redis', async () => {
      redisService.getCached.mockResolvedValue(null);

      const userId = await service.redeemTicket('invalid-ticket');

      expect(userId).toBeNull();
      expect(redisService.getCached).toHaveBeenCalledWith('ws_ticket:invalid-ticket');
      expect(redisService.invalidate).not.toHaveBeenCalled();
    });

    it('should return userId and invalidate the ticket if ticket is valid', async () => {
      const ticket = 'valid-ticket';
      const expectedUserId = 'user-uuid-123';
      redisService.getCached.mockResolvedValue({ userId: expectedUserId });

      const userId = await service.redeemTicket(ticket);

      expect(userId).toBe(expectedUserId);
      expect(redisService.getCached).toHaveBeenCalledWith(`ws_ticket:${ticket}`);
      expect(redisService.invalidate).toHaveBeenCalledWith(`ws_ticket:${ticket}`);
    });
  });
});
