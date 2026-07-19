import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";

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
    }
} as const satisfies Record<string, BaseStatus>;
