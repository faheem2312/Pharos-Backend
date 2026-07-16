import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketService } from './ticket.service';

interface LogCreatedPayload {
  id: string;
  userId: string | null;
  type: string;
  message: string;
  createdAt: string;
}

@WebSocketGateway({
  cors: {
    // Read at connection-time from config, not hardcoded, so this works
    // identically in local dev and production without code changes.
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger('RealtimeGateway');

  constructor(private tickets: TicketService, private config: ConfigService) {}

  // Runs on every new connection attempt, before the client is considered
  // "connected." A missing/invalid/expired ticket gets disconnected
  // immediately — no anonymous connections are allowed to linger.
  async handleConnection(client: Socket) {
    const ticket = client.handshake.auth?.ticket as string | undefined;

    if (!ticket) {
      this.logger.warn(`Connection rejected: no ticket (${client.id})`);
      client.disconnect();
      return;
    }

    const userId = await this.tickets.redeemTicket(ticket);
    if (!userId) {
      this.logger.warn(`Connection rejected: invalid/expired ticket (${client.id})`);
      client.disconnect();
      return;
    }

    // Rooms let us push events to exactly one user's connections (they
    // might have multiple tabs open) without broadcasting to everyone.
    client.join(`user:${userId}`);
    client.data.userId = userId;
    this.logger.log(`Client connected: ${client.id} (user ${userId})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Listens for the internal domain event LogsService emits after every
  // recorded event, and pushes it to that specific user's room. Events
  // with no userId (e.g. a failed login for an unknown email) are simply
  // not pushed anywhere — nobody's dashboard should show them live.
  @OnEvent('log.created')
  handleLogCreated(payload: LogCreatedPayload) {
    if (!payload.userId) return;
    this.server.to(`user:${payload.userId}`).emit('log', payload);
  }
}