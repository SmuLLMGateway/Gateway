import {
  JwtTokenPayload,
  VerifiedAccessToken,
  VerifiedRefreshToken,
} from '../type/jwt-payload.type.js';

export class TokenMapper {
  static toPayload(
    userId: number,
    expiredAt: string,
    accessToken: boolean,
  ): JwtTokenPayload {
    return { userId, expiredAt, accessToken };
  }

  static toVerifiedAccessToken(
    payload: JwtTokenPayload,
  ): VerifiedAccessToken {
    return {
      userId: payload.userId,
      expiredAt: payload.expiredAt,
      accessToken: true,
    };
  }

  static toVerifiedRefreshToken(
    payload: JwtTokenPayload,
  ): VerifiedRefreshToken {
    return {
      userId: payload.userId,
      expiredAt: payload.expiredAt,
      accessToken: false,
    };
  }
}
