import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// Usage: @Roles('owner', 'admin')
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
