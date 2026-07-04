import { Controller, Get, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DbService } from '../../database/db.service';
import { users } from '../../database/schema';

@Controller('users')
@UseGuards(JwtAuthGuard) // every route below requires a valid access token
export class UsersController {
  constructor(private db: DbService) {}

  @Get('me')
  async me(@CurrentUser() user: { userId: string }) {
    const record = await this.db.db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { passwordHash: false }, // never leak the hash, even to its owner
    });
    return record;
  }

  // Example of stacking RBAC on top of authentication: only owners/admins
  // can hit this route, even though everyone above passed JwtAuthGuard.
  @Get('admin-only')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  adminOnly() {
    return { message: 'If you can see this, you are an owner or admin.' };
  }
}
