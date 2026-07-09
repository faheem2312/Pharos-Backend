import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

// Reads the access token out of the httpOnly cookie instead of an
// Authorization header — the browser attaches cookies automatically on
// every request, so the frontend no longer needs to manually attach a
// Bearer token (and more importantly, JavaScript can no longer read this
// token at all, since httpOnly cookies are invisible to client-side code).
const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.pharos_access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}