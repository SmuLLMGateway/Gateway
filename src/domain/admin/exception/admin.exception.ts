import type { BaseStatus } from '../../../global/apiPayload/code/status.js';
import { GatewayException } from '../../../global/apiPayload/exception/gateway.exception.js';

export class AdminException extends GatewayException {
  constructor(code: BaseStatus) {
    super(code);
  }
}
