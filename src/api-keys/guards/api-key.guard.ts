import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

// A second, independent auth path alongside cookie-based JWT auth — for
// scripts/integrations that can't hold a browser session/cookie. Attach
// with @UseGuards(ApiKeyGuard) on any route meant to be called this way.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const record = await this.apiKeys.validateKey(rawKey);
    if (!record) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    request.user = { userId: record.userId };
    return true;
  }
}