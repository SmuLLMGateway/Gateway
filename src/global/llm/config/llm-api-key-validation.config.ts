import { Injectable } from '@nestjs/common';
import { LlmProvider } from '../enum/llm-provider.enum.js';

export interface LlmApiKeyValidationTarget {
  readonly url: string;
  readonly responseArrayField: 'data' | 'models';
}

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

const VALIDATION_TARGETS: Readonly<
  Record<LlmProvider, LlmApiKeyValidationTarget>
> = Object.freeze({
  [LlmProvider.GEMINI]: Object.freeze({
    url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
    responseArrayField: 'models',
  }),
  [LlmProvider.GPT]: Object.freeze({
    url: 'https://api.openai.com/v1/models',
    responseArrayField: 'data',
  }),
  [LlmProvider.CLAUDE]: Object.freeze({
    url: 'https://api.anthropic.com/v1/models?limit=1',
    responseArrayField: 'data',
  }),
});

@Injectable()
export class LlmApiKeyValidationConfig {
  readonly requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;

  getTarget(provider: LlmProvider): LlmApiKeyValidationTarget | undefined {
    switch (provider) {
      case LlmProvider.GEMINI:
      case LlmProvider.GPT:
      case LlmProvider.CLAUDE:
        return VALIDATION_TARGETS[provider];
      default:
        return undefined;
    }
  }
}
