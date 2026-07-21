import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SecurityRequest } from '../type/security-request.type.js';

export const CurrentRefreshToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    return context.switchToHttp().getRequest<SecurityRequest>().refreshToken;
  },
);
