import { BaseError } from "viem";
import { BlockchainException } from "../../../global/apiPayload/exception/blockchain.exception.js";
import { BaseStatus } from "../../../global/apiPayload/code/status.js";

export class TestException extends BlockchainException {
    constructor(code: BaseStatus) {
        super(code)
    }
}