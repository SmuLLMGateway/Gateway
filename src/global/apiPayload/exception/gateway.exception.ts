import { HttpException } from '@nestjs/common';
import type { BaseStatus } from '../code/status.js';

/**
 * 모든 도메인 예외의 기반이 되는 Gateway 공통 예외입니다.
 * 도메인 상태 코드와 실제 HTTP 상태를 전역 예외 필터에 전달합니다.
 */
export class GatewayException extends HttpException {
  constructor(public readonly baseStatus: BaseStatus) {
    super(baseStatus.message, baseStatus.httpStatus);
  }
}
