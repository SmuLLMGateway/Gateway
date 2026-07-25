import { Injectable, Logger } from '@nestjs/common';
import {
  LlmApiKeyValidationConfig,
  type LlmApiKeyValidationTarget,
} from '../config/llm-api-key-validation.config.js';
import { LlmApiKeyValidationFailure } from '../enum/llm-api-key-validation-failure.enum.js';
import { LlmApiKeyValidationResult } from '../enum/llm-api-key-validation-result.enum.js';
import { LlmProvider } from '../enum/llm-provider.enum.js';
import { LlmApiKeyValidationException } from '../exception/llm-api-key-validation.exception.js';

const ANTHROPIC_API_VERSION = '2023-06-01';

@Injectable()
export class LlmApiKeyValidationClient {
  private readonly logger = new Logger(LlmApiKeyValidationClient.name);

  constructor(private readonly config: LlmApiKeyValidationConfig) {}

  async validate(
    provider: LlmProvider,
    apiKey: string,
  ): Promise<LlmApiKeyValidationResult> {
    if (!this.isUsableApiKey(apiKey)) {
      return LlmApiKeyValidationResult.INVALID;
    }

    const target = this.config.getTarget(provider);
    if (target === undefined) {
      throw new LlmApiKeyValidationException(
        LlmApiKeyValidationFailure.UNSUPPORTED_PROVIDER,
      );
    }

    let response: Response;
    try {
      response = await fetch(target.url, {
        method: 'GET',
        headers: this.createHeaders(provider, apiKey),
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch {
      this.logger.error(
        this.toLogMessage(provider, 'NETWORK_ERROR', 'TRANSIENT'),
      );
      // fetch의 cause에 요청 헤더가 포함될 수 있으므로 원본 예외를 전파하지 않습니다.
      throw new LlmApiKeyValidationException(
        LlmApiKeyValidationFailure.TRANSIENT,
      );
    }

    if (this.isTransientStatus(response.status)) {
      this.logger.warn(
        this.toLogMessage(provider, response.status, 'TRANSIENT'),
      );
      throw new LlmApiKeyValidationException(
        LlmApiKeyValidationFailure.TRANSIENT,
      );
    }

    if (!response.ok) {
      this.logger.warn(
        this.toLogMessage(provider, response.status, 'INVALID'),
      );
      // 인증 실패 응답 본문은 키 또는 provider 진단 정보를 포함할 수 있어 읽지 않습니다.
      return LlmApiKeyValidationResult.INVALID;
    }

    if (!(await this.hasExpectedPayload(response, target))) {
      this.logger.error(
        this.toLogMessage(provider, response.status, 'UNEXPECTED_RESPONSE'),
      );
      throw new LlmApiKeyValidationException(
        LlmApiKeyValidationFailure.UNEXPECTED_RESPONSE,
      );
    }

    this.logger.log(this.toLogMessage(provider, response.status, 'VALID'));
    return LlmApiKeyValidationResult.VALID;
  }

  private createHeaders(
    provider: LlmProvider,
    apiKey: string,
  ): Readonly<Record<string, string>> {
    switch (provider) {
      case LlmProvider.GEMINI:
        return {
          accept: 'application/json',
          'x-goog-api-key': apiKey,
        };
      case LlmProvider.GPT:
        return {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
        };
      case LlmProvider.CLAUDE:
        return {
          accept: 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
        };
      default:
        throw new LlmApiKeyValidationException(
          LlmApiKeyValidationFailure.UNSUPPORTED_PROVIDER,
        );
    }
  }

  private async hasExpectedPayload(
    response: Response,
    target: Readonly<LlmApiKeyValidationTarget>,
  ): Promise<boolean> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return false;
    }

    return this.isRecord(payload)
      && Array.isArray(payload[target.responseArrayField]);
  }

  private isTransientStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
  }

  private isUsableApiKey(apiKey: unknown): apiKey is string {
    return typeof apiKey === 'string'
      && apiKey.trim().length > 0
      && !/[\r\n]/.test(apiKey);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toLogMessage(
    provider: LlmProvider,
    status: number | 'NETWORK_ERROR',
    result: 'VALID' | 'INVALID' | 'TRANSIENT' | 'UNEXPECTED_RESPONSE',
  ): string {
    return `event=llm_api_key_validation provider=${provider} status=${status} result=${result}`;
  }
}
