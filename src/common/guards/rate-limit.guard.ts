import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Ratelimit } from '@upstash/ratelimit';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

const DEFAULT_LIMIT: RateLimitOptions = { limit: 20, window: '60 s' };

// A sliding-window rate limiter backed by Upstash Redis.
//
// Why not just @nestjs/throttler's built-in guard? That one tracks counts
// in each instance's local memory. On Cloud Run, traffic can be spread
// across several container instances at once, so each instance would
// enforce its own separate limit — a client could get, e.g., 5 requests
// through *per instance* instead of 5 total. Backing the counter with
// Redis makes the limit correct regardless of how many instances are
// running behind the scenes.
@Injectable()
export class RateLimitGuard implements CanActivate {
  // One Ratelimit instance per distinct (limit, window) pair, reused across
  // requests rather than reconstructed every time.
  private limiters = new Map<string, Ratelimit>();

  constructor(private redis: RedisService, private reflector: Reflector) {}

  private getLimiter(options: RateLimitOptions): Ratelimit {
    const key = `${options.limit}:${options.window}`;
    if (!this.limiters.has(key)) {
      this.limiters.set(
        key,
        new Ratelimit({
          redis: this.redis.client,
          limiter: Ratelimit.slidingWindow(options.limit, options.window),
          analytics: false,
          prefix: 'ratelimit',
        }),
      );
    }
    return this.limiters.get(key)!;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_LIMIT;

    const request = context.switchToHttp().getRequest();

    // Prefer a logged-in user's id (fairer + harder to evade than IP alone);
    // fall back to IP for unauthenticated routes like /auth/login.
    const identifier: string =
      request.user?.userId ??
      request.headers['x-forwarded-for']?.toString().split(',')[0].trim() ??
      request.ip ??
      'anonymous';

    const limiter = this.getLimiter(options);
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      throw new HttpException(
        { message: 'Too many requests. Please slow down.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
