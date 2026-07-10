import { Controller, Get, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DbService } from '../../database/db.service';
import { RedisService } from '../../redis/redis.service';
import { users } from '../../database/schema';
import { ApiKeyGuard } from '../../api-keys/guards/api-key.guard';

const ME_CACHE_TTL_SECONDS = 60;

@Controller('users')
@UseGuards(JwtAuthGuard) // every route below requires a valid access token
export class UsersController {
  constructor(private db: DbService, private redis: RedisService) {}

  // Cache-aside pattern: check Redis first, fall back to Postgres on a
  // miss, then populate the cache for next time. A 60s TTL means a user
  // hammering /users/me (e.g. the dashboard polling on every focus) hits
  // Postgres at most once a minute instead of on every single request —
  // meaningful savings once this endpoint sees real traffic, since it's
  // one of the most frequently called routes in any dashboard app.
  @Get('me')
  async me(@CurrentUser() user: { userId: string }) {
    const cacheKey = `user:${user.userId}`;

    const cached = await this.redis.getCached(cacheKey);
    if (cached) return cached;

    const record = await this.db.db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { passwordHash: false }, // never leak the hash, even to its owner
    });

    if (record) {
      await this.redis.setCached(cacheKey, record, ME_CACHE_TTL_SECONDS);
    }

    return record;
  }

  // Demonstrates the second auth path: call this with a header like
// `x-api-key: phr_live_...` instead of a browser session/cookie.
@Get('me/api')
@UseGuards(ApiKeyGuard)
meViaApiKey(@CurrentUser() user: { userId: string }) {
  return this.me(user);
}

  // Example of stacking RBAC on top of authentication: only owners/admins
  // can hit this route, even though everyone above passed JwtAuthGuard.
  @Get('admin-only')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  adminOnly() {
    return { message: 'If you can see this, you are an owner or admin.' };
  }
}
