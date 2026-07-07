import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { parseRedisConnection } from '../redis-connection.util';

export interface WelcomeEmailJobData {
  userId: string;
  email: string;
  name: string;
}

@Injectable()
export class WelcomeEmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WelcomeEmailProcessor');
  private worker: Worker<WelcomeEmailJobData>;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const connection = parseRedisConnection(this.config.getOrThrow<string>('UPSTASH_REDIS_URL'));

    this.worker = new Worker<WelcomeEmailJobData>(
      'welcome-email',
      async (job: Job<WelcomeEmailJobData>) => {
        await this.sendWelcomeEmail(job.data);
      },
      { connection, concurrency: 5 },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed — welcome email sent to ${job.data.email}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
    });
  }

  private async sendWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    this.logger.log(`Sending welcome email to ${data.email} (user ${data.userId})...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.logger.log(`Welcome email content: "Hi ${data.name}, welcome to Pharos!"`);
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}