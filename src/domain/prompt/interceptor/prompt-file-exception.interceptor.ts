import {
  HttpException,
  HttpStatus,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, throwError, type Observable } from 'rxjs';
import { GatewayException } from '../../../global/apiPayload/exception/gateway.exception.js';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptException } from '../exception/prompt.exception.js';

/** Multer 자체 오류를 프로젝트의 파일 형식 오류로 변환합니다. */
@Injectable()
export class PromptFileExceptionInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (this.isMulterError(error) || this.isTransformedMulterError(error)) {
          return throwError(
            () => new PromptException(PromptErrorStatus.INVALID_FILE_FORM),
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private isMulterError(error: unknown): boolean {
    return error instanceof Error
      && error.name === 'MulterError'
      && 'code' in error
      && typeof error.code === 'string';
  }

  private isTransformedMulterError(error: unknown): boolean {
    return error instanceof HttpException
      && !(error instanceof GatewayException)
      && (
        error.getStatus() === HttpStatus.BAD_REQUEST
        || error.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE
      );
  }
}
