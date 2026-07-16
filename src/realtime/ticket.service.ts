import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';

const TICKET_TTL_SECONDS = 30;

@Injectable()
export class TicketService {
  constructor(private redis: RedisService) {}

  async issueTicket(userId: string): Promise<string> {
    const ticket = randomBytes(24).toString('hex');
    await this.redis.setCached(`ws_ticket:${ticket}`, { userId }, TICKET_TTL_SECONDS);
    return ticket;
  }

  async redeemTicket(ticket: string): Promise<string | null> {
    const data = await this.redis.getCached<{ userId: string }>(`ws_ticket:${ticket}`);
    if (!data) return null;
    await this.redis.invalidate(`ws_ticket:${ticket}`);
    return data.userId;
  }
}