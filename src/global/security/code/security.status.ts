import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../apiPayload/code/status.js";

export const SecurityErrorStatus = {
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
    REFRESH_TOKEN_NOT_ALLOWED: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'AUTH400_4',
        message: '엑세스 토큰으로 요청을 다시 보내주세요.'
    },
    ACCESS_TOKEN_NOT_ALLOWED: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'AUTH400_5',
        message: '리프레시 토큰으로 요청을 다시 보내주세요.'
    },

    TOKEN_MISSING: {
        httpStatus: HttpStatus.UNAUTHORIZED,
        code: 'AUTH401_1',
        message: '인증 토큰이 필요합니다.'
    },
    TOKEN_INVALID: {
        httpStatus: HttpStatus.UNAUTHORIZED,
        code: 'AUTH401_2',
        message: '유효하지 않은 토큰입니다.'
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
    }
} as const satisfies Record<string, BaseStatus>;
