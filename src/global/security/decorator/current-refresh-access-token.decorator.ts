import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SecurityRequest } from '../type/security-request.type.js';

export const CurrentRefreshAccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    return context.switchToHttp().getRequest<SecurityRequest>()
      .refreshAccessToken;
  },
);
