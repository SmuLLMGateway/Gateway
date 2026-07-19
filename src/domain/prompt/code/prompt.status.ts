import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";

export const PromptSuccessStatus = {
    PREPROMPT_REQUEST: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_1',
        message: '성공적으로 마스킹 요소 분석을 요청했습니다.'
    },
    ANALYZE: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_2',
        message: '성공적으로 마스킹 요소를 탐지했습니다.'
    },
    LLM_REQUEST: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_3',
        message: '성공적으로 LLM에게 전송을 요청했습니다.'
    },
    LLM_RESPONSE: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_4',
        message: '성공적으로 LLM 응답을 생성했습니다.'
    },
    RECENT_PROMPT_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_5',
        message: '성공적으로 채팅 과거 기록을 조회했습니다.'
    },
    SEARCH_PROMPT: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_6',
        message: '성공적으로 채팅 내역을 검색했습니다.'
    },
    FILE_DOWNLOAD: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_7',
        message: '성공적으로 파일 다운로드 URL을 생성했습니다.'
    },

    BEFORE_ANALYZE: {
        httpStatus: HttpStatus.NO_CONTENT,
        code: 'PROM204_1',
        message: '아직 분석이 진행 중입니다.'
    },
    BEFORE_LLM_RESPONSE: {
        httpStatus: HttpStatus.NO_CONTENT,
        code: 'PROM204_2',
        message: '아직 결과 생성 중입니다.'
    }

} as const satisfies Record<string, BaseStatus>;

export const PromptErrorStatus = {
    INVALID_FILE_FORM: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'PROM400_1',
        message: '지원하지 않는 파일 형식입니다.'
    },
    DUPLICATED_TICKET: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'PROM400_2',
        message: '요청 티켓이 중복되어 요청되었습니다. 기존 요청 결과를 확인해주세요.'
    },

    FORBIDDEN_LLM_MODEL: {
        httpStatus: HttpStatus.FORBIDDEN,
        code: 'PROM403_1',
        message: '해당 부서에선 사용이 제한된 모델입니다.'
    },
    FORBIDDEN_FILE_DOWNLOAD: {
        httpStatus: HttpStatus.FORBIDDEN,
        code: 'PROM403_2',
        message: '해당 파일을 업로드한 사용자가 아닙니다.'
    },

    NOT_FOUND_ANAL_REQ: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_1',
        message: '해당 분석 요청을 찾을 수 없습니다.'
    },
    NOT_FOUND_FILE: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_2',
        message: '해당 파일을 찾을 수 없습니다.'
    },
} as const satisfies Record<string, BaseStatus>;
