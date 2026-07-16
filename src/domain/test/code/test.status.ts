import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";

export const TestSuccessStatus = {
    TEST_OK: {
        httpStatus: HttpStatus.OK,
        code: 'TEST200_1',
        message: '테스트'
    }
} as const satisfies Record<string, BaseStatus>;

export const TestErrorStatus = {
    TEST_ERROR: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'TEST400_1',
        message: '테스트 에러'
    }
} as const satisfies Record<string, BaseStatus>;
