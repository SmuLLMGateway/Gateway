import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityErrorStatus } from '../code/security.status.js';
import { ROLES_KEY } from '../decorator/roles.decorator.js';
import { SecurityException } from '../exception/security.exception.js';
import type { SecurityRequest } from '../type/security-request.type.js';
import type { UserRole } from '../type/user-role.enum.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<SecurityRequest>();

    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new SecurityException(SecurityErrorStatus.FORBIDDEN);
    }

    return true;
  }
}
