import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { DbService } from '../database/db.service';
import { apiKeys } from '../database/schema';

const KEY_PREFIX = 'phr_live_';

@Injectable()
export class ApiKeysService {
  constructor(private db: DbService) {}

  // Returns the raw key exactly once — the caller must show it to the
  // user immediately, since it's never retrievable again after this.
  async create(userId: string, name: string): Promise<{ id: string; rawKey: string }> {
    const secret = randomBytes(24).toString('hex'); // 48 hex chars of entropy
    const rawKey = `${KEY_PREFIX}${secret}`;
    const keyPrefix = rawKey.slice(0, 16); // just enough to help identify it in a list
    const keyHash = this.hashKey(rawKey);

    const [record] = await this.db.db
      .insert(apiKeys)
      .values({ userId, name, keyPrefix, keyHash })
      .returning();

    return { id: record.id, rawKey };
  }

  async listForUser(userId: string) {
    return this.db.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        revoked: apiKeys.revoked,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async revoke(userId: string, keyId: string) {
    const [updated] = await this.db.db
      .update(apiKeys)
      .set({ revoked: true })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning();

    if (!updated) throw new NotFoundException('API key not found');
    return { success: true };
  }

  // Used by ApiKeyGuard to validate an incoming request's x-api-key header.
  async validateKey(rawKey: string) {
    const keyHash = this.hashKey(rawKey);
    const record = await this.db.db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });

    if (!record || record.revoked) return null;

    // Fire-and-forget last-used tracking — useful for the user to see
    // which keys are actually active vs. dormant, without slowing down
    // the request waiting on this write.
    this.db.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.id))
      .catch(() => {});

    return record;
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}