import { Global, Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';

// @Global so AuthService and RateLimitGuard can inject LogsService to
// record events without importing LogsModule directly in each place.
@Global()
@Module({
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}