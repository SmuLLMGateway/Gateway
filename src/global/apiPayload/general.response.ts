import { BaseStatus, SuccessStatus, ErrorStatus } from './code/status.js';

export class GeneralResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result?: T;

  constructor(isSuccess: boolean, status: BaseStatus, result?: T) {
    this.isSuccess = isSuccess;
    this.code = status.code;
    this.message = status.message;
    this.result = result;
  }

  // 성공 시 기본 응답 (Interceptor 등에서 활용)
  static onSuccess<T>(status: BaseStatus, result: T): GeneralResponse<T> {
    return new GeneralResponse(true, status, result);
  }

  // 실패 시 공통 응답 (Exception Filter에서 사용)
  static onFailure<T>(status: BaseStatus, result?: T): GeneralResponse<T> {
    return new GeneralResponse(false, status, result);
  }
}
