import { AuthResDTO } from "../dto/auth.response.dto.js";
import type { TokenPair } from "../../../global/security/type/jwt-payload.type.js";

export class AuthMapper {
    static toLogin(tokens: Readonly<TokenPair>): AuthResDTO.Login {
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            refreshTokenExpiredAt: tokens.refreshTokenExpiredAt
        }
    }
}
