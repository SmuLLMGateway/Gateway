import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";
import { SecurityErrorStatus } from "../../../global/security/code/security.status.js";

export const AuthSuccessStatus = {
    LOGIN: {
        httpStatus: HttpStatus.OK,
        code: 'AUTH200_1',
        message: '성공적으로 로그인했습니다.'
    },
    REFRESHTOKEN: {
        httpStatus: HttpStatus.OK,
        code: 'AUTH200_2',
        message: '성공적으로 토큰을 재발급했습니다.'
    },
    LOGOUT: {
        httpStatus: HttpStatus.OK,
        code: 'AUTH200_3',
        message: '성공적으로 로그아웃했습니다.'
    }
} as const satisfies Record<string, BaseStatus>;

export const AuthErrorStatus = {
    PASSWORD_ERROR: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'AUTH400_1',
        message: '이메일 혹은 비밀번호가 틀렸습니다.'
    },
    TOKEN_EXPIRED: SecurityErrorStatus.TOKEN_EXPIRED,
    DISABLE_ACCOUNT: SecurityErrorStatus.DISABLE_ACCOUNT,
    REFRESH_TOKEN_NOT_ALLOWED: SecurityErrorStatus.REFRESH_TOKEN_NOT_ALLOWED,
    ACCESS_TOKEN_NOT_ALLOWED: SecurityErrorStatus.ACCESS_TOKEN_NOT_ALLOWED,

    FORBIDDEN: SecurityErrorStatus.FORBIDDEN,
    TOKEN_MISSING: SecurityErrorStatus.TOKEN_MISSING,
    TOKEN_INVALID: SecurityErrorStatus.TOKEN_INVALID,

    USER_NOT_FOUND: SecurityErrorStatus.USER_NOT_FOUND,
} as const satisfies Record<string, BaseStatus>;
