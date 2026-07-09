import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const ACCESS_TOKEN_COOKIE = 'pharos_access_token';
const REFRESH_TOKEN_COOKIE = 'pharos_refresh_token';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000, // 15 minutes, matches JWT_ACCESS_EXPIRES_IN
  path: '/',
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT_REFRESH_EXPIRES_IN
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @RateLimit({ limit: 10, window: '60 s' })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.register(dto);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    return { user };
  }

  @RateLimit({ limit: 5, window: '60 s' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    return { user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await this.authService.refresh(refreshToken);
    res.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { user: result.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    return { success: true };
  }
}