import { AuthResDTO } from "../dto/auth.response.dto.js";
import type { TokenPair } from "../../../global/security/type/jwt-payload.type.js";
import { toKoreaStandardTimeISOString } from '../../../global/time/korea-standard-time.js';

export class AuthMapper {
    static toLogin(tokens: Readonly<TokenPair>): AuthResDTO.Login {
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            refreshTokenExpiredAt: tokens.refreshTokenExpiredAt
        }
    }

    static toUpdatePassword(
        userId: number,
        updatedAt: Date,
    ): AuthResDTO.UpdatePassword {
        return {
            userId,
            updatedAt: toKoreaStandardTimeISOString(updatedAt),
        };
    }
}
