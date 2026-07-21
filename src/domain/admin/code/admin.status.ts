import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";

export const AdminSuccessStatus = {
    DASHBOARD: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_1',
        message: '성공적으로 운영 현황을 조회했습니다.'
    },
    TRENDS: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_2',
        message: '성공적으로 이용 및 감지 추이를 조회했습니다.'
    },
    ADMIN_LOGS: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_3',
        message: '성공적으로 관리자 활동 목록을 조회했습니다.'
    },
    POLICY_DETECT: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_4',
        message: '성공적으로 정책별 감지 건수를 조회했습니다.'
    },
    DEPARTMENT_RISKS: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_5',
        message: '성공적으로 부서별 위험 분포를 조회했습니다.'
    },
    USER_SUMMARY: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_6',
        message: '성공적으로 사용자 계정 요약을 조회했습니다.'
    },
    USER_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_7',
        message: '성공적으로 사용자 계정 목록을 조회했습니다.'
    },
    USER_DETAIL: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_8',
        message: '성공적으로 사용자 계정 상세 정보를 조회했습니다.'
    },
    DISABLE_USER: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_9',
        message: '성공적으로 해당 사용자를 비활성화했습니다.'
    },
    RESTORE_USER: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_10',
        message: '성공적으로 해당 사용자를 복구했습니다.'
    },
    UPDATE_USER: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_11',
        message: '성공적으로 해당 사용자를 수정했습니다.'
    },
    LOGS_SUMMARY: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_12',
        message: '성공적으로 감사 및 이용 로그 요약을 조회했습니다.'
    },
    LOG_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_13',
        message: '성공적으로 이용 기록 목록을 조회했습니다.'
    },
    LOG_DETAIL: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_14',
        message: '성공적으로 이용 기록 상세 정보를 조회했습니다.'
    },
    DEPARTMENT_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_15',
        message: '성공적으로 부서 목록을 조회했습니다.'
    },
    CREATE_USER: {
        httpStatus: HttpStatus.CREATED,
        code: 'ADMIN201_1',
        message: '성공적으로 사용자를 생성했습니다.'
    },
    CREATE_DEPARTMENT: {
        httpStatus: HttpStatus.CREATED,
        code: 'ADMIN201_2',
        message: '성공적으로 부서를 생성했습니다.'
    },
    REGISTER_API_KEY: {
        httpStatus: HttpStatus.CREATED,
        code: 'ADMIN201_3',
        message: '성공적으로 부서에 API키를 생성했습니다.'
    }
} as const satisfies Record<string, BaseStatus>;

export const AdminErrorStatus = {
    DUPLICATE_EMAIL: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_1',
        message: '이미 생성된 이메일입니다.'
    },
    DUPLICATE_DEPARTMENT: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_2',
        message: '이미 생성된 부서입니다.'
    },
    INVALID_API_KEY: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_3',
        message: 'API 키가 잘못되었습니다.'
    },
    NOT_MANAGED_DEPARTMENT: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_4',
        message: '관리하는 부서가 아닙니다.'
    },
    INVALID_EMAIL: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_5',
        message: '이메일 형식이 올바르지 않습니다.'
    },
    INVALID_ROLE: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_6',
        message: '사용자 역할이 올바르지 않습니다.'
    },
    LOG_NOT_FOUND: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'ADMIN404_1',
        message: '해당 이용기록이 존재하지 않습니다.'
    },
    DEPARTMENT_NOT_FOUND: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'ADMIN404_2',
        message: '존재하지 않는 부서입니다.'
    }
} as const satisfies Record<string, BaseStatus>;
