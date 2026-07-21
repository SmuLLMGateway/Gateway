import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace AuthReqDTO {
    @ApiSchema({ name: 'AuthLoginRequest' })
    export class Login {
        @ApiProperty({
            example: 'example@example.com',
            description: '이메일 형식을 갖춘 문자열'
        })
        email!: string;

        @ApiProperty({
            example: 'a1234567',
            description: '비밀번호'
        })
        password!: string;
    }

    @ApiSchema({ name: 'AuthRefreshTokenRequest' })
    export class RefreshToken {
        @ApiProperty({
            example: 'ey~~',
            description: '재발급에 사용할 리프레시 토큰'
        })
        refreshToken!: string;
    }
} 
