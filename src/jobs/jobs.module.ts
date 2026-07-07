import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { WelcomeEmailProcessor } from './processors/welcome-email.processor';

// @Global so any module (auth, users, future billing/notifications modules)
// can inject QueueService to enqueue jobs without re-importing JobsModule.
@Global()
@Module({
  providers: [QueueService, WelcomeEmailProcessor],
  exports: [QueueService],
})
export class JobsModule {}
