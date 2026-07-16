import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { GeneralResponse } from '../general.response.js';
import { ErrorStatus } from '../code/status.js';
import { BlockchainException } from '../exception/blockchain.exception.js';

/**
 * 1. BlockchainException 전담 필터
 */
@Catch(BlockchainException)
export class BlockchainExceptionFilter implements ExceptionFilter {
  catch(exception: BlockchainException, host: ArgumentsHost) {
    console.log("[ %s ]: %s", exception.name, exception.baseStatus.message);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusData = exception.baseStatus;

    response
      .status(statusData.httpStatus)
      .json(GeneralResponse.onFailure(statusData));
  }
}

/**
 * 2. HttpException 전담 필터
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {

    console.log('[ %s ]: %s', exception.name, exception.message);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const statusData = {
      httpStatus: exception.getStatus(),
      code: `COMMON${exception.getStatus()}`,
      message: exception.message,
    };

    response
      .status(statusData.httpStatus)
      .json(GeneralResponse.onFailure(statusData));
  }
}

/**
 * 3. 그 외 아예 핸들링되지 않은 서버 에러 전담 필터
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    console.error('[ GlobalException ]: %s', exception);
    const statusData = ErrorStatus.INTERNAL_SERVER_ERROR;

    response
      .status(statusData.httpStatus)
      .json(GeneralResponse.onFailure(statusData));
  }
}
