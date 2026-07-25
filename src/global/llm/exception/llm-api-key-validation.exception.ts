import { LlmApiKeyValidationFailure } from '../enum/llm-api-key-validation-failure.enum.js';

export class LlmApiKeyValidationException extends Error {
  readonly transient: boolean;

  constructor(public readonly failure: LlmApiKeyValidationFailure) {
    super('LLM API 키 검증 요청을 완료하지 못했습니다.');
    this.name = LlmApiKeyValidationException.name;
    this.transient = failure === LlmApiKeyValidationFailure.TRANSIENT;
  }
}
