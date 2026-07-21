import type { BaseStatus } from '../../apiPayload/code/status.js';
import { GatewayException } from '../../apiPayload/exception/gateway.exception.js';

export class SecurityException extends GatewayException {
  constructor(status: BaseStatus) {
    super(status);
  }
}
