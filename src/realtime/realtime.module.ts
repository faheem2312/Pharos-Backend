import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeController } from './realtime.controller';
import { TicketService } from './ticket.service';

@Module({
  controllers: [RealtimeController],
  providers: [RealtimeGateway, TicketService],
})
export class RealtimeModule {}