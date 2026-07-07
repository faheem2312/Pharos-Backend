import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// @Global so any module (auth, users, future logs/jobs modules) can inject
// RedisService without re-importing RedisModule everywhere.
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
