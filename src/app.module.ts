import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/db.module';
import { RedisModule } from './redis/redis.module';
import { JobsModule } from './jobs/jobs.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    JobsModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // Global default: 20 requests / 60s per client, backed by Upstash Redis
    // so the limit holds correctly across every Cloud Run instance, not
    // just whichever instance happened to handle a given request.
    // Override per-route with @RateLimit({ limit, window }).
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
