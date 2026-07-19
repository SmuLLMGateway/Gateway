import { BaseStatus } from "../../../global/apiPayload/code/status.js";
import { GatewayException } from "../../../global/apiPayload/exception/gateway.exception.js";

export class AuthException extends GatewayException {
    constructor(code: BaseStatus) {
        super(code)
    }
}
