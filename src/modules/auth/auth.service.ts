import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { DbService } from '../../database/db.service';
import { QueueService } from '../../jobs/queue.service';
import { users, refreshTokens } from '../../database/schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwt: JwtService,
    private config: ConfigService,
    private queue: QueueService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.db.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const [user] = await this.db.db
      .insert(users)
      .values({ email: dto.email, passwordHash, name: dto.name })
      .returning();

    // Enqueue rather than send synchronously — registration responds
    // immediately to the user, and the (simulated) email send happens
    // in the background, with automatic retries if it fails.
    await this.queue.welcomeEmailQueue.add('send-welcome-email', {
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.db.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    // Deliberately vague error — never reveal whether the email or the
    // password was wrong, that's a user-enumeration vulnerability.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  // Refresh-token rotation: every time a refresh token is used, it's revoked
  // and replaced with a brand new one. If a revoked token is ever presented
  // again, that's a strong signal it was stolen — treat it as a breach.
  async refresh(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.db.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      if (stored?.revoked) {
        // Reused a revoked token — assume compromise and kill every
        // session for this user, forcing a fresh login everywhere.
        await this.revokeAllForUser(stored.userId);
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.db.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, stored.id));

    const user = await this.db.db.query.users.findFirst({
      where: eq(users.id, stored.userId),
    });
    if (!user) throw new UnauthorizedException('User no longer exists');

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.db.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  private async revokeAllForUser(userId: string) {
    await this.db.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.revoked, false)));
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // We only ever store a hash of the refresh token, never the raw value —
    // if the DB leaks, the tokens inside it are useless on their own.
    await this.db.db.insert(refreshTokens).values({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role },
    };
  }

  private hashToken(token: string): string {
    // SHA-256 is fine here (unlike passwords, refresh tokens are already
    // high-entropy random strings, so we don't need bcrypt's slow hashing).
    return require('crypto').createHash('sha256').update(token).digest('hex');
  }
}
