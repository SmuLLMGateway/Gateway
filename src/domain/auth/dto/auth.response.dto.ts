import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace AuthResDTO {
    @ApiSchema({ name: 'AuthLoginResponse' })
    export class Login {
        @ApiProperty({
            example: 'ey~~',
            description: '엑세스 토큰'
        })
        accessToken!: string;

        @ApiProperty({
            example: 'ey~~',
            description: '리프레시 토큰'
        })
        refreshToken!: string;

        @ApiProperty({
            example: '2026-07-19T15:04:50Z',
            description: '리프레시 토큰 만료 기한'
        })
        refreshTokenExpiredAt!: string;
    }

    @ApiSchema({ name: 'AuthRefreshTokenResponse' })
    export class RefreshToken extends Login {}

    export type Logout = null;
}
