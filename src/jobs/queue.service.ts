import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { parseRedisConnection } from './redis-connection.util';

@Injectable()
export class QueueService implements OnModuleDestroy {
  public welcomeEmailQueue: Queue;

  constructor(private config: ConfigService) {
    const connection = parseRedisConnection(this.config.getOrThrow<string>('UPSTASH_REDIS_URL'));

    this.welcomeEmailQueue = new Queue('welcome-email', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    });
  }

  async onModuleDestroy() {
    await this.welcomeEmailQueue.close();
  }
}