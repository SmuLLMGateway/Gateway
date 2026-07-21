import { UserRole } from './user-role.enum.js';

export interface JwtTokenPayload {
  userId: number;
  expiredAt: string;
  accessToken: boolean;
  iat?: number;
  exp?: number;
}

export interface VerifiedAccessToken {
  userId: number;
  expiredAt: string;
  accessToken: true;
}

/** JWT 검증 결과에 DB에서 조회한 현재 역할을 결합한 요청 사용자입니다. */
export interface AuthenticatedUser extends VerifiedAccessToken {
  role: UserRole;
}

export interface VerifiedRefreshToken {
  userId: number;
  expiredAt: string;
  accessToken: false;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiredAt: string;
  refreshTokenExpiredAt: string;
}
