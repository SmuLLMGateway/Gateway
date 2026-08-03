import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";
import { SecurityErrorStatus } from "../../../global/security/code/security.status.js";

export const UserSuccessStatus = {
    MESSAGE_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'USER200_1',
        message: '성공적으로 대화 기록을 조회했습니다.'
    },
    MESSAGE_SUMMARY: {
        httpStatus: HttpStatus.OK,
        code: 'USER200_2',
        message: '성공적으로 대화 기록 요약을 조회했습니다.'
    },
    POLICY_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'USER200_3',
        message: '성공적으로 부서 정책 목록을 조회했습니다.'
    },
    USER_INFO: {
        httpStatus: HttpStatus.OK,
        code: 'USER200_4',
        message: '성공적으로 사용자 정보를 조회했습니다.'
    }
} as const satisfies Record<string, BaseStatus>;

export const UserErrorStatus = {
    INVALID_MESSAGE_LIST: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'USER400_1',
        message: '대화 기록 조회 요청 형식이 올바르지 않습니다.'
    },
    TOKEN_EXPIRED: SecurityErrorStatus.TOKEN_EXPIRED,
    FORBIDDEN: SecurityErrorStatus.FORBIDDEN,
} as const satisfies Record<string, BaseStatus>;
