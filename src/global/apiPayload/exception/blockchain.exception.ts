import { HttpException } from '@nestjs/common';
import { BaseStatus } from '../code/status.js';

/**
 * 도메인에서 에러를 던질 때 사용하는 커스텀 예외 클래스입니다.
 * 스프링의 ScoiException 역할과 동일합니다.
 */
export class BlockchainException extends HttpException {
  constructor(public readonly baseStatus: BaseStatus) {
    // HttpException의 부모 생성자에게 메시지와 실제 HTTP 상태 코드를 넘겨줍니다.
    super(baseStatus.message, baseStatus.httpStatus);
  }
}
