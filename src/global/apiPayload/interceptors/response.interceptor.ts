import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GeneralResponse } from '../general.response.js';
import { SuccessStatus } from '../code/status.js';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, GeneralResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<GeneralResponse<T>> {
    return next.handle().pipe(
      map(data => {
        // 이미 ApiResponse 형태로 반환된 거라면 그대로 패스
        if (data instanceof GeneralResponse) {
          return data;
        }
        // 컨트롤러에서 일반 객체/값을 반환했다면 일괄적으로 기본 성공(OK)으로 감싸줍니다.
        return GeneralResponse.onSuccess(data, SuccessStatus.OK);
      }),
    );
  }
}
