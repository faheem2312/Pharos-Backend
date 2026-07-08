import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { DbService } from '../database/db.service';
import { events } from '../database/schema';

interface SearchParams {
  q?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class LogsService {
  constructor(private db: DbService) {}

  // Fire-and-forget style: callers await this for correctness (so a failed
  // write doesn't silently vanish), but it's never on the critical path of
  // whether the underlying action (register, login, etc.) succeeds.
  async record(
    type: string,
    message: string,
    options?: { userId?: string; metadata?: Record<string, unknown> },
  ) {
    await this.db.db.insert(events).values({
      type,
      message,
      userId: options?.userId,
      metadata: options?.metadata,
    });
  }

  // Full-text search when `q` is given (ranked by relevance via ts_rank),
  // otherwise a plain reverse-chronological list. `type` further narrows
  // to one event category (e.g. 'rate_limit.exceeded').
  async search(params: SearchParams) {
    const { q, type, limit = 50, offset = 0 } = params;

    const conditions = [];
    if (type) conditions.push(eq(events.type, type));
    if (q) {
      conditions.push(
        sql`to_tsvector('english', ${events.message}) @@ plainto_tsquery('english', ${q})`,
      );
    }

    return this.db.db
      .select()
      .from(events)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(
        q
          ? sql`ts_rank(to_tsvector('english', ${events.message}), plainto_tsquery('english', ${q})) DESC`
          : desc(events.createdAt),
      )
      .limit(limit)
      .offset(offset);
  }

  // Powers the dashboard: counts per event type (for stat cards) and an
  // hourly time series (for the request-volume-style chart), both scoped
  // to the last 24 hours.
  async stats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const typeCounts = await this.db.db
      .select({ type: events.type, count: sql<number>`count(*)::int` })
      .from(events)
      .where(gte(events.createdAt, since))
      .groupBy(events.type);

    const hourly = await this.db.db
      .select({
        hour: sql<string>`date_trunc('hour', ${events.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(gte(events.createdAt, since))
      .groupBy(sql`date_trunc('hour', ${events.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${events.createdAt})`);

    return { typeCounts, hourly };
  }
}