import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { FilesService } from './files.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  // Rate-limited tighter than the global default — issuing presigned URLs
  // is cheap for us, but there's no reason a client needs more than a
  // handful per minute, and it closes off a trivial abuse vector.
  @RateLimit({ limit: 10, window: '60 s' })
  @Post('upload-url')
  createUploadUrl(@CurrentUser() user: { userId: string }, @Body() dto: CreateUploadUrlDto) {
    return this.filesService.createUploadUrl(user.userId, dto.filename, dto.contentType);
  }

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.filesService.listForUser(user.userId);
  }
}