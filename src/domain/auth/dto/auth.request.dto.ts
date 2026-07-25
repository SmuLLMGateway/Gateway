import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace AuthReqDTO {
    @ApiSchema({ name: 'AuthLoginRequest' })
    export class Login {
        @ApiProperty({
            type: String,
            example: 'example@example.com',
            description: '이메일 형식을 갖춘 문자열'
        })
        email!: string;

        @ApiProperty({
            type: String,
            example: 'a1234567',
            description: '비밀번호'
        })
        password!: string;
    }

    @ApiSchema({ name: 'AuthRefreshTokenRequest' })
    export class RefreshToken {
        @ApiProperty({
            type: String,
            example: 'ey~~',
            description: '재발급에 사용할 리프레시 토큰'
        })
        refreshToken!: string;
    }

    @ApiSchema({ name: 'AuthUpdatePasswordRequest' })
    export class UpdatePassword {
        @ApiProperty({
            type: String,
            example: 'CurrentPassword123!',
            description: '현재 비밀번호'
        })
        oldPassword!: string;

        @ApiProperty({
            type: String,
            example: 'NewPassword123!',
            description: '변경할 새 비밀번호'
        })
        newPassword!: string;
    }
} 
