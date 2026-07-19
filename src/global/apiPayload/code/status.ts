import { HttpStatus } from '@nestjs/common';

export interface BaseStatus {
  httpStatus: HttpStatus; // 실제 HTTP 상태 코드 (200, 400 등)
  code: string;
  message: string;
}

// 성공 상태 코드
export const SuccessStatus = {
  OK: {
    httpStatus: HttpStatus.OK,
    code: 'COMMON200',
    message: '요청에 성공하였습니다.'
  },

  CREATED: {
    httpStatus: HttpStatus.CREATED,
    code: 'COMMON201',
    message: '요청이 성공적으로 생성되었습니다.'
  },

} as const satisfies Record<string, BaseStatus>;

// 에러 상태 코드
export const ErrorStatus = {
  INTERNAL_SERVER_ERROR: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'COMMON500_1',
    message: '서버 내부 오류입니다.'
  },

  BAD_REQUEST: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'COMMON400',
    message: '잘못된 요청입니다.'
  },

  UNAUTHORIZED: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    code: 'COMMON401',
    message: '인증이 필요합니다.'
  },

  NOT_FOUND: {
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'COMMON404',
    message: '대상을 찾을 수 없습니다.'
  },
  
} as const satisfies Record<string, BaseStatus>;
