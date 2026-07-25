import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { SecurityErrorStatus } from '../../../global/security/code/security.status.js';
import { SecurityException } from '../../../global/security/exception/security.exception.js';
import { NerConfig } from '../../../global/ner/config/ner.config.js';

const CALLBACK_SECRET_HEADER = 'x-ner-callback-secret';

@Injectable()
export class NerCallbackGuard implements CanActivate {
  constructor(private readonly config: NerConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedSecret = request.headers[CALLBACK_SECRET_HEADER];

    if (
      typeof providedSecret !== 'string' ||
      providedSecret.length === 0 ||
      !this.matchesSecret(providedSecret, this.config.callbackSecret)
    ) {
      throw new SecurityException(SecurityErrorStatus.TOKEN_INVALID);
    }

    return true;
  }

  private matchesSecret(provided: string, expected: string): boolean {
    const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
    const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
    return timingSafeEqual(providedDigest, expectedDigest);
  }
}
