import { AuthResDTO } from "../dto/auth.response.dto.js";

export class AuthMapper {
    static toLogin(
        accessToken: string,
        refreshToken: string,
        refreshTokenExpiredAt: string
    ): AuthResDTO.Login {
        return {
            accessToken: accessToken,
            refreshToken: refreshToken,
            refreshTokenExpiredAt: refreshTokenExpiredAt
        }
    }
}