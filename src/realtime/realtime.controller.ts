import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { TicketService } from './ticket.service';

@Controller('realtime')
@UseGuards(JwtAuthGuard)
export class RealtimeController {
  constructor(private tickets: TicketService) {}

  @RateLimit({ limit: 20, window: '60 s' })
  @Get('ticket')
  async getTicket(@CurrentUser() user: { userId: string }) {
    const ticket = await this.tickets.issueTicket(user.userId);
    return { ticket };
  }
}