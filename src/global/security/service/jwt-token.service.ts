import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SecurityErrorStatus } from '../code/security.status.js';
import { SecurityConfig } from '../config/security.config.js';
import { SecurityException } from '../exception/security.exception.js';
import { TokenMapper } from '../mapper/token.mapper.js';
import {
  JwtTokenPayload,
  TokenPair,
  VerifiedAccessToken,
  VerifiedRefreshToken,
} from '../type/jwt-payload.type.js';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: SecurityConfig,
  ) {}

  async issueTokenPair(userId: number): Promise<TokenPair> {
    const accessTokenExpiredAt = this.getExpiredAt(
      this.config.accessExpiresInSeconds,
    );
    const refreshTokenExpiredAt = this.getExpiredAt(
      this.config.refreshExpiresInSeconds,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.sign(
        TokenMapper.toPayload(userId, accessTokenExpiredAt, true),
        this.config.accessExpiresInSeconds,
      ),
      this.sign(
        TokenMapper.toPayload(userId, refreshTokenExpiredAt, false),
        this.config.refreshExpiresInSeconds,
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiredAt,
      refreshTokenExpiredAt,
    };
  }

  async verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
    const payload = await this.verify(token, true);

    return TokenMapper.toVerifiedAccessToken(payload);
  }

  /**
   * 재발급 요청에서는 만료된 Access Token도 DB 회원 식별에 사용합니다.
   * 서명, 알고리즘, Payload 구조와 Access Token 타입은 그대로 검증합니다.
   */
  async verifyAccessTokenForRefresh(token: string): Promise<VerifiedAccessToken> {
    const payload = await this.verify(token, true, true);

    return TokenMapper.toVerifiedAccessToken(payload);
  }

  async verifyRefreshToken(token: string): Promise<VerifiedRefreshToken> {
    const payload = await this.verify(token, false);

    return TokenMapper.toVerifiedRefreshToken(payload);
  }

  private async sign(
    payload: JwtTokenPayload,
    expiresIn: number,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.config.secret,
      algorithm: 'HS256',
      expiresIn,
    });
  }

  private async verify(
    token: string,
    expectedAccessToken: boolean,
    ignoreExpiration = false,
  ): Promise<JwtTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
        secret: this.config.secret,
        algorithms: ['HS256'],
        ignoreExpiration,
      });

      if (!this.isValidPayload(payload, ignoreExpiration)) {
        throw new SecurityException(SecurityErrorStatus.TOKEN_INVALID);
      }

      if (payload.accessToken !== expectedAccessToken) {
        const status = expectedAccessToken
          ? SecurityErrorStatus.REFRESH_TOKEN_NOT_ALLOWED
          : SecurityErrorStatus.ACCESS_TOKEN_NOT_ALLOWED;

        throw new SecurityException(status);
      }

      return payload;
    } catch (error: unknown) {
      if (error instanceof SecurityException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new SecurityException(SecurityErrorStatus.TOKEN_EXPIRED);
      }

      throw new SecurityException(SecurityErrorStatus.TOKEN_INVALID);
    }
  }

  private isValidPayload(
    payload: JwtTokenPayload,
    ignoreExpiration: boolean,
  ): boolean {
    const expiredAt = Date.parse(payload.expiredAt);

    return Number.isSafeInteger(payload.userId)
      && payload.userId > 0
      && typeof payload.accessToken === 'boolean'
      && typeof payload.expiredAt === 'string'
      && Number.isFinite(expiredAt)
      && (ignoreExpiration || expiredAt > Date.now());
  }

  private getExpiredAt(expiresInSeconds: number): string {
    return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  }
}
