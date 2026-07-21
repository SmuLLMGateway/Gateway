import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SecurityErrorStatus } from '../code/security.status.js';
import { SecurityException } from '../exception/security.exception.js';
import { JwtTokenService } from '../service/jwt-token.service.js';
import type { SecurityRequest } from '../type/security-request.type.js';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly tokenService: JwtTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SecurityRequest>();
    const accessToken = this.extractAccessToken(
      request.headers.authorization,
    );
    const refreshToken = this.extractRefreshToken(request.body);
    const accessAuthentication =
      await this.tokenService.verifyAccessTokenForRefresh(accessToken);
    await this.tokenService.verifyRefreshToken(refreshToken);

    request.refreshAccessToken = accessAuthentication;
    request.refreshToken = refreshToken;

    return true;
  }

  private extractAccessToken(authorization?: string): string {
    const [scheme, token, ...rest] = authorization?.trim().split(/\s+/) ?? [];

    if (scheme !== 'Bearer' || !token || rest.length > 0) {
      throw new SecurityException(SecurityErrorStatus.TOKEN_MISSING);
    }

    return token;
  }

  private extractRefreshToken(body: unknown): string {
    if (body === null || typeof body !== 'object') {
      throw new SecurityException(SecurityErrorStatus.TOKEN_MISSING);
    }

    const refreshToken = (body as { refreshToken?: unknown }).refreshToken;

    if (
      refreshToken === undefined
      || refreshToken === null
      || refreshToken === ''
    ) {
      throw new SecurityException(SecurityErrorStatus.TOKEN_MISSING);
    }

    if (typeof refreshToken !== 'string') {
      throw new SecurityException(SecurityErrorStatus.TOKEN_INVALID);
    }

    const token = refreshToken.trim();

    if (token === '') {
      throw new SecurityException(SecurityErrorStatus.TOKEN_MISSING);
    }

    return token;
  }
}
