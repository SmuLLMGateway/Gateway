import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../type/user-role.enum.js';

export const ROLES_KEY = 'security:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
