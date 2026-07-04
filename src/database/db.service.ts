import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Wraps the Neon serverless HTTP driver behind a Nest-managed service.
// Using the HTTP driver (rather than a persistent TCP pool) is a good fit
// for Cloud Run, where instances can scale to zero between requests.
@Injectable()
export class DbService {
  public db: NeonHttpDatabase<typeof schema>;

  constructor(private config: ConfigService) {
    neonConfig.fetchConnectionCache = true;
    const sql = neon(this.config.getOrThrow<string>('DATABASE_URL'));
    this.db = drizzle(sql, { schema });
  }
}
