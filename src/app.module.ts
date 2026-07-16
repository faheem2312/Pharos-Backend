import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/db.module';
import { RedisModule } from './redis/redis.module';
import { JobsModule } from './jobs/jobs.module';
import { LogsModule } from './logs/logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthController } from './health.controller';
import { FilesModule } from './files/files.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    RedisModule,
    JobsModule,
    LogsModule,
    DatabaseModule,
    AuthModule,
    ApiKeysModule,
    RealtimeModule,
    UsersModule,
    FilesModule,
    ObservabilityModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}