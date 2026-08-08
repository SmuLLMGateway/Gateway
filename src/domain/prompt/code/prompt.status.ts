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
    FILE_DOWNLOAD: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_7',
        message: '성공적으로 파일 다운로드 URL을 생성했습니다.'
    },
    MODEL_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_8',
        message: '성공적으로 모델 목록을 조회했습니다.'
    },
    PROMPT_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_9',
        message: '성공적으로 프롬프트를 조회했습니다.'
    },
    RECENT_ANALYZE: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_10',
        message: '성공적으로 직전 마스킹 요소 탐지 요청을 조회했습니다.'
    },
    CANCEL_ANALYZE: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_11',
        message: '성공적으로 해당 마스킹 요소 탐지 요청을 취소했습니다.'
    },
    NER_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_12',
        message: '성공적으로 로컬 NER 목록을 조회했습니다.'
    },
    PROMPT_DETAIL: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_13',
        message: '성공적으로 프롬프트 상세 정보를 조회했습니다.'
    },

    BEFORE_ANALYZE: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_2_1',
        message: '아직 분석이 진행 중입니다.'
    },
    BEFORE_LLM_RESPONSE: {
        httpStatus: HttpStatus.OK,
        code: 'PROM200_4_1',
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
    INVALID_ANALYZE_REQUEST: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'PROM400_3',
        message: '마스킹 요소 분석 요청 형식이 올바르지 않습니다.'
    },
    INVALID_FILE_DOWNLOAD_REQUEST: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'PROM400_5',
        message: '파일 다운로드 URL 생성 요청 형식이 올바르지 않습니다.'
    },
    INVALID_PROMPT_LIST_REQUEST: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'PROM400_6',
        message: '프롬프트 목록 조회 요청 형식이 올바르지 않습니다.'
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
    FORBIDDEN_PROMPT_DETAIL: {
        httpStatus: HttpStatus.FORBIDDEN,
        code: 'PROM403_3',
        message: '해당 프롬프트를 요청한 사용자가 아닙니다.'
    },
    FORBIDDEN_EXTERNAL_LLM_WITH_DETECTIONS: {
        httpStatus: HttpStatus.FORBIDDEN,
        code: 'PROM403_4',
        message: '탐지된 마스킹 요소가 있어 외부 LLM으로 전송할 수 없습니다.'
    },

    NOT_FOUND_ANAL_REQ: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_1',
        message: '해당 분석 요청을 찾을 수 없습니다.'
    },
    NOT_FOUND_PROMPT: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_2',
        message: '해당 프롬프트를 찾을 수 없습니다.'
    },
    NOT_FOUND_FILE: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_3',
        message: '해당 파일을 찾을 수 없습니다.'
    },
    NOT_FOUND_RECENT_ANALYZE: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_4',
        message: '직전 마스킹 요소 탐지 요청이 없습니다.'
    },
    NOT_FOUND_RECENT_TICKET: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_5',
        message: '해당 직전 마스킹 요소 탐지 요청이 없습니다.'
    },
    NOT_FOUND_CHAT_ROOM: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'PROM404_6',
        message: '해당 채팅방을 찾을 수 없습니다.'
    },
    NER_SERVER_ERROR: {
        httpStatus: HttpStatus.BAD_GATEWAY,
        code: 'PROM502_1',
        message: '파일 분석 서버 요청에 실패했습니다.'
    },
    NER_DEPLOYMENT_LIST_UNAVAILABLE: {
        httpStatus: HttpStatus.BAD_GATEWAY,
        code: 'PROM502_2',
        message: '로컬 NER 목록 조회에 실패했습니다.'
    },
    LLM_DEPLOYMENT_LIST_UNAVAILABLE: {
        httpStatus: HttpStatus.BAD_GATEWAY,
        code: 'PROM502_3',
        message: '로컬 LLM 목록 조회에 실패했습니다.'
    },
    ANALYZE_SERVICE_UNAVAILABLE: {
        httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'PROM503_1',
        message: '마스킹 요소 분석 요청을 처리할 수 없습니다.'
    },
    FILE_DOWNLOAD_SERVICE_UNAVAILABLE: {
        httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'PROM503_2',
        message: '파일 다운로드 URL을 생성할 수 없습니다.'
    },
    LLM_REQUEST_FAILED: {
        httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'PROM503_3',
        message: 'LLM 전송에 실패했습니다. 다시 시도해주세요.'
    },
} as const satisfies Record<string, BaseStatus>;
