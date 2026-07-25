import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace AuthResDTO {
    @ApiSchema({ name: 'AuthLoginResponse' })
    export class Login {
        @ApiProperty({
            type: String,
            example: 'ey~~',
            description: '엑세스 토큰'
        })
        accessToken!: string;

        @ApiProperty({
            type: String,
            example: 'ey~~',
            description: '리프레시 토큰'
        })
        refreshToken!: string;

        @ApiProperty({
            type: String,
            example: '2026-07-19T15:04:50Z',
            description: '리프레시 토큰 만료 기한',
            format: 'date-time'
        })
        refreshTokenExpiredAt!: string;
    }

    @ApiSchema({ name: 'AuthRefreshTokenResponse' })
    export class RefreshToken extends Login {}

    @ApiSchema({ name: 'AuthUpdatePasswordResponse' })
    export class UpdatePassword {
        @ApiProperty({
            type: Number,
            example: 1,
            description: '비밀번호를 변경한 사용자 ID'
        })
        userId!: number;

        @ApiProperty({
            type: String,
            example: '2026-07-22T14:08:22.000Z',
            format: 'date-time',
            description: '비밀번호 변경 시각'
        })
        updatedAt!: string;
    }

    export type Logout = null;
}
