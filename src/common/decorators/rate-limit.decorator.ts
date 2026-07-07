import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  limit: number;
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;
}

// Usage: @RateLimit({ limit: 5, window: '60 s' })
// Overrides the module-wide default defined in RateLimitGuard.
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);