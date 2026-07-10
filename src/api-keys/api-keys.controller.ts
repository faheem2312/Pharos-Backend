import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard) // managing keys still requires a normal logged-in session
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @RateLimit({ limit: 10, window: '60 s' })
  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user.userId, dto.name);
  }

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.apiKeysService.listForUser(user.userId);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.userId, id);
  }
}