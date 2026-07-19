import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";

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
    TOKEN_EXPIRED: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'AUTH400_2',
        message: '토큰이 만료되었습니다.'
    },
    DISABLE_ACCOUNT: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'AUTH400_3',
        message: '계정이 비활성화 상태입니다.'
    },

    FORBIDDEN: {
        httpStatus: HttpStatus.FORBIDDEN,
        code: 'AUTH403_1',
        message: '권한이 부족합니다.'
    },

    USER_NOT_FOUND: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'AUTH404_1',
        message: '해당 사용자를 찾을 수 없습니다.'
    },
} as const satisfies Record<string, BaseStatus>;