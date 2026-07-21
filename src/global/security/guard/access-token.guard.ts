import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityErrorStatus } from '../code/security.status.js';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator.js';
import { SecurityException } from '../exception/security.exception.js';
import { SecurityPrincipalService } from '../service/security-principal.service.js';
import { JwtTokenService } from '../service/jwt-token.service.js';
import type { SecurityRequest } from '../type/security-request.type.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: JwtTokenService,
    private readonly principalService: SecurityPrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<SecurityRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    const verifiedToken = await this.tokenService.verifyAccessToken(token);
    request.user = await this.principalService.getAuthenticatedUser(
      verifiedToken,
    );

    return true;
  }

  private extractBearerToken(authorization?: string): string {
    const [scheme, token, ...rest] = authorization?.trim().split(/\s+/) ?? [];

    if (scheme !== 'Bearer' || !token || rest.length > 0) {
      throw new SecurityException(SecurityErrorStatus.TOKEN_MISSING);
    }

    return token;
  }
}
