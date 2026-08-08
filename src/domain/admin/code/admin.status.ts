import { HttpStatus } from "@nestjs/common";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";

export const AdminSuccessStatus = {
    DASHBOARD: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_1',
        message: '성공적으로 운영 현황을 조회했습니다.'
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
    LOGS_SUMMARY: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_12',
        message: '성공적으로 감사 및 이용 로그 요약을 조회했습니다.'
    },
    USER_PROMPT_OVERVIEW: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_13',
        message: '성공적으로 사용자별 프롬프트 목록을 조회했습니다.'
    },
    USER_PROMPT_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_14',
        message: '성공적으로 사용자 프롬프트 목록을 조회했습니다.'
    },
    PROMPT_DETAIL: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_15',
        message: '성공적으로 프롬프트 상세 정보를 조회했습니다.'
    },
    DEPARTMENT_SUMMARY: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_16',
        message: '성공적으로 부서 관리 요약을 조회했습니다.'
    },
    DEPARTMENT_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_17',
        message: '성공적으로 부서 목록을 조회했습니다.'
    },
    DEPARTMENT_DETAIL: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_18',
        message: '성공적으로 부서 상세정보를 조회했습니다.'
    },
    SYNC_POLICIES: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_19',
        message: '성공적으로 부서 정책을 동기화했습니다.'
    },
    DEPARTMENT_API_KEY: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_20',
        message: '성공적으로 부서 API키를 조회했습니다.'
    },
    POLICY_CATALOG: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_21',
        message: '성공적으로 보안 정책 목록을 조회했습니다.'
    },
    SYNC_GLOBAL_POLICIES: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_22',
        message: '성공적으로 보안 정책을 동기화했습니다.'
    },
    SYSTEM_HEALTH: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_23',
        message: '성공적으로 시스템 상태를 조회했습니다.'
    },
    LLM_HEALTH: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_24',
        message: '성공적으로 모델 상태를 조회했습니다.'
    },
    DASHBOARD_TRENDS: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_26',
        message: '성공적으로 운영 추이 정보를 조회했습니다.'
    },
    LOCAL_LLM_LIST: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_25',
        message: '성공적으로 로컬 LLM 목록을 조회했습니다.'
    },
    UPDATE_LOCAL_LLM_STATUS: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_27',
        message: '성공적으로 로컬 LLM 활성화 상태를 변경했습니다.'
    },
    UPDATE_LOCAL_NER_STATUS: {
        httpStatus: HttpStatus.OK,
        code: 'ADMIN200_28',
        message: '성공적으로 로컬 NER 활성화 상태를 변경했습니다.'
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
    },
    CREATE_USERS_BATCH: {
        httpStatus: HttpStatus.CREATED,
        code: 'ADMIN201_4',
        message: '성공적으로 사용자를 일괄 생성했습니다.'
    },
    LINK_DEPARTMENT_USERS: {
        httpStatus: HttpStatus.CREATED,
        code: 'ADMIN201_5',
        message: '성공적으로 부서에 사용자를 연동했습니다.'
    },
    REGISTER_LOCAL_LLM: {
        httpStatus: HttpStatus.CREATED,
        code: 'ADMIN201_6',
        message: '성공적으로 로컬 LLM을 등록했습니다.'
    },
    REGISTER_LOCAL_NER: {
        httpStatus: HttpStatus.CREATED,
        code: 'ADMIN201_7',
        message: '성공적으로 로컬 NER를 등록했습니다.'
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
    INVALID_DEPARTMENT_NAME: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_7',
        message: '부서 이름이 올바르지 않습니다.'
    },
    DUPLICATE_POLICY: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_8',
        message: '중복된 부서 정책이 요청되었습니다.'
    },
    INVALID_POLICY: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_9',
        message: '부서 정책 형식이 올바르지 않습니다.'
    },
    INVALID_USER_LIST_QUERY: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_10',
        message: '사용자 목록 조회 조건이 올바르지 않습니다.'
    },
    INVALID_DEPARTMENT_LIST_QUERY: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_11',
        message: '부서 목록 조회 조건이 올바르지 않습니다.'
    },
    DEPARTMENT_NOT_FOUND: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'ADMIN404_2',
        message: '존재하지 않는 부서입니다.'
    },
    POLICY_NOT_FOUND: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'ADMIN404_3',
        message: '해당 부서 정책이 존재하지 않습니다.'
    },
    API_KEY_NOT_FOUND: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'ADMIN404_4',
        message: '해당 부서의 API 키가 존재하지 않습니다.'
    },
    LOCAL_DEPLOYMENT_NOT_FOUND: {
        httpStatus: HttpStatus.NOT_FOUND,
        code: 'ADMIN404_5',
        message: '로컬 Deployment를 찾을 수 없습니다.'
    },
    NOT_IMPLEMENTED: {
        httpStatus: HttpStatus.NOT_IMPLEMENTED,
        code: 'ADMIN501_1',
        message: '아직 구현되지 않은 API입니다.'
    },
    INVALID_USER_IDS: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_12',
        message: '사용자 ID 목록이 올바르지 않습니다.'
    },
    NO_LINKABLE_USERS: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_13',
        message: '연동 가능한 사용자가 없습니다.'
    },
    INVALID_DEPARTMENT_ADMIN: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_14',
        message: '부서 관리자 지정이 올바르지 않습니다.'
    },
    INVALID_LOCAL_DEPLOYMENT: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_15',
        message: '로컬 Deployment 등록 정보가 올바르지 않습니다.'
    },
    INVALID_LOCAL_DEPLOYMENT_STATE: {
        httpStatus: HttpStatus.BAD_REQUEST,
        code: 'ADMIN400_16',
        message: '로컬 Deployment 활성화 상태가 올바르지 않습니다.'
    },
    DUPLICATE_LOCAL_DEPLOYMENT: {
        httpStatus: HttpStatus.CONFLICT,
        code: 'ADMIN409_1',
        message: '이미 등록된 로컬 Deployment ID입니다.'
    },
    INVALID_LOCAL_DEPLOYMENT_CONFIGURATION: {
        httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'ADMIN422_1',
        message: '로컬 Deployment 설정을 처리할 수 없습니다.'
    },
    LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE: {
        httpStatus: HttpStatus.BAD_GATEWAY,
        code: 'ADMIN502_1',
        message: '로컬 Deployment Provider 요청에 실패했습니다.'
    }
} as const satisfies Record<string, BaseStatus>;
