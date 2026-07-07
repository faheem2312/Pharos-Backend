import type { ConnectionOptions } from 'bullmq';

// BullMQ bundles its own internal copy of ioredis. If we construct our own
// `IORedis` instance (from the top-level `ioredis` package) and hand it to
// BullMQ, TypeScript sees two structurally-similar-but-distinct `Redis`
// types and refuses to compile — a classic "dual package hazard."
//
// The fix is to never construct our own ioredis client for BullMQ. Instead,
// parse the connection URL into a plain options object and let BullMQ
// create and own its internal ioredis client from it.
export function parseRedisConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    // rediss:// (note the double 's') means TLS — Upstash always uses this.
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null, // required by BullMQ's blocking connection
  };
}