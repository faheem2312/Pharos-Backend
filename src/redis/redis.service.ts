import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

// Thin wrapper around the Upstash REST client. Using the REST client (not a
// persistent TCP connection) matters here: Cloud Run instances are short-lived
// and can scale to zero, so a stateful Redis connection would constantly be
// torn down and reopened. REST calls are stateless and work identically
// whether an instance has been warm for an hour or was just cold-started.
@Injectable()
export class RedisService {
  public client: Redis;

  constructor(private config: ConfigService) {
    this.client = new Redis({
      url: this.config.getOrThrow<string>('UPSTASH_REDIS_REST_URL'),
      token: this.config.getOrThrow<string>('UPSTASH_REDIS_REST_TOKEN'),
    });
  }

  // --- Simple cache-aside helpers -----------------------------------------

  async getCached<T>(key: string): Promise<T | null> {
    const value = await this.client.get<T>(key);
    return value ?? null;
  }

  async setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { ex: ttlSeconds });
  }

  async invalidate(key: string): Promise<void> {
    await this.client.del(key);
  }
}
