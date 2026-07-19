import { BaseStatus } from "../../../global/apiPayload/code/status.js";
import { BlockchainException } from "../../../global/apiPayload/exception/blockchain.exception.js";

export class AuthException extends BlockchainException {
    constructor(code: BaseStatus) {
        super(code)
    }
}