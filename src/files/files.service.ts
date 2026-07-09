import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { DbService } from '../database/db.service';
import { files } from '../database/schema';

const PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes to actually perform the upload

@Injectable()
export class FilesService {
  private s3: S3Client;
  private bucket: string;
  private publicUrlBase: string;

  constructor(private config: ConfigService, private db: DbService) {
    this.bucket = this.config.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicUrlBase = this.config.getOrThrow<string>('R2_PUBLIC_URL');

    // R2 is S3-compatible — same SDK, just pointed at Cloudflare's endpoint
    // instead of AWS's. `region` is required by the SDK but meaningless
    // here since R2 doesn't have AWS-style regions.
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.getOrThrow<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  // Issues a short-lived, signed URL the browser can PUT directly to R2 —
  // the file's bytes never pass through this API server. We record the
  // metadata now (optimistically, before the upload actually completes)
  // to keep the flow simple; a production system would add a webhook or
  // a client-side "confirm" call to verify the upload actually landed.
  async createUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string; fileId: string }> {
    // Namespacing by user ID prevents filename collisions between users
    // and makes it trivial to reason about ownership from the key alone.
    const key = `${userId}/${randomUUID()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    const publicUrl = `${this.publicUrlBase}/${key}`;

    const [record] = await this.db.db
      .insert(files)
      .values({ userId, key, filename, contentType, publicUrl })
      .returning();

    return { uploadUrl, publicUrl, fileId: record.id };
  }

  async listForUser(userId: string) {
    return this.db.db
      .select()
      .from(files)
      .where(eq(files.userId, userId))
      .orderBy(desc(files.createdAt));
  }
}