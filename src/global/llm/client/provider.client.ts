import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import { ProviderConfig } from '../config/provider.config.js';

const MAX_PROVIDER_LOG_BODY_LENGTH = 4_096;
const REDACTED_API_KEY = '[REDACTED]';

export interface ProviderFile {
  readonly stream: Readable;
  readonly fileName: string;
}

export interface ProviderRequest {
  readonly ticket: string;
  readonly model: string;
  readonly apiKey: string;
  readonly text: string;
  readonly files: readonly ProviderFile[];
}

export interface ProviderResponse {
  readonly outputText: string;
  readonly totalUsd: number;
  readonly responseId: string;
  readonly provider: string;
}

@Injectable()
export class ProviderClient {
  private readonly logger = new Logger(ProviderClient.name);

  constructor(private readonly config: ProviderConfig) {}

  async request(request: Readonly<ProviderRequest>): Promise<ProviderResponse> {
    const endpoint = new URL('/api/v1/request', this.config.baseUrl);
    const requestMode = request.files.length === 0 ? 'json' : 'multipart';
    const requestBody = this.toLoggableRequestBody(request);
    this.logger.log(
      `event=provider_request_started ticket=${request.ticket} endpoint=${endpoint.origin}${endpoint.pathname} method=POST mode=${requestMode} model=${request.model} text_chars=${request.text.length} file_count=${request.files.length} request_body=${requestBody}`,
    );
    let response: Response;
    try {
      response = await fetch(
        endpoint,
        request.files.length === 0 ? this.jsonRequest(request) : this.multipartRequest(request),
      );
    } catch (error: unknown) {
      this.logRequestFailure({
        ticket: request.ticket,
        endpoint,
        requestMode,
        requestBody,
        responseBody: '<not_received>',
        result: 'network_error',
        error,
      });
      throw new Error('Provider 네트워크 요청에 실패했습니다.');
    }

    let responseBody: string | undefined;
    try {
      responseBody = await response.text();
    } catch (error: unknown) {
      this.logRequestFailure({
        ticket: request.ticket,
        endpoint,
        requestMode,
        requestBody,
        responseBody: '<unavailable>',
        result: 'response_body_unavailable',
        error,
        status: response.status,
      });
      throw new Error('Provider 응답 본문을 읽을 수 없습니다.');
    }

    if (!response.ok) {
      this.logRequestFailure({
        ticket: request.ticket,
        endpoint,
        requestMode,
        requestBody,
        responseBody: this.toLoggableBody(responseBody),
        result: 'http_error',
        status: response.status,
      });
      throw new Error(`Provider 요청이 실패했습니다. status=${response.status}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseBody);
    } catch (error: unknown) {
      this.logRequestFailure({
        ticket: request.ticket,
        endpoint,
        requestMode,
        requestBody,
        responseBody: this.toLoggableBody(responseBody),
        result: 'invalid_response',
        status: response.status,
        error,
      });
      throw new Error('Provider 응답 형식이 올바르지 않습니다.');
    }
    if (!this.isResponse(payload)) {
      this.logRequestFailure({
        ticket: request.ticket,
        endpoint,
        requestMode,
        requestBody,
        responseBody: this.toLoggableBody(responseBody),
        result: 'invalid_response',
        status: response.status,
      });
      throw new Error('Provider 응답 형식이 올바르지 않습니다.');
    }
    this.logger.log(
      `event=provider_response_received ticket=${request.ticket} status=${response.status} provider=${payload.provider} model=${payload.model} response_id=${payload.response_id} output_chars=${payload.output_text.length} total_usd=${payload.total_usd} response_body=${this.toLoggableBody(responseBody)}`,
    );
    return {
      outputText: payload.output_text,
      totalUsd: payload.total_usd,
      responseId: payload.response_id,
      provider: payload.provider,
    };
  }

  private jsonRequest(request: Readonly<ProviderRequest>): RequestInit {
    return {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ model: request.model, api_key: request.apiKey, text: request.text }),
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    };
  }

  private multipartRequest(request: Readonly<ProviderRequest>): RequestInit {
    const boundary = `----gateway-${crypto.randomUUID()}`;
    const encoder = new TextEncoder();
    const field = (name: string, value: string) => encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
    const body = Readable.from((async function* () {
      yield field('model', request.model);
      yield field('api_key', request.apiKey);
      yield field('text', request.text);
      for (const file of request.files) {
        const safeName = file.fileName.replace(/[\r\n"]/g, '_');
        yield encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${safeName}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
        yield* file.stream;
        yield encoder.encode('\r\n');
      }
      yield encoder.encode(`--${boundary}--\r\n`);
    })());
    return {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': `multipart/form-data; boundary=${boundary}` },
      body: Readable.toWeb(body) as unknown as RequestInit['body'],
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      // Node fetch에서 요청 본문을 스트리밍하기 위한 옵션입니다.
      duplex: 'half',
    } as RequestInit;
  }

  /** API 키·첨부 원문을 제외한 실제 Provider 요청의 안전한 로그 표현입니다. */
  private toLoggableRequestBody(request: Readonly<ProviderRequest>): string {
    return this.toLoggableBody(JSON.stringify({
      model: request.model,
      api_key: REDACTED_API_KEY,
      text: request.text,
      files: request.files.map((file) => ({
        fileName: file.fileName.replace(/[\r\n"]/g, '_'),
      })),
    }) ?? '<unserializable>');
  }

  private logRequestFailure(input: Readonly<{
    ticket: string;
    endpoint: URL;
    requestMode: 'json' | 'multipart';
    requestBody: string;
    responseBody: string;
    result: 'network_error' | 'http_error' | 'response_body_unavailable' | 'invalid_response';
    status?: number;
    error?: unknown;
  }>): void {
    const status = input.status === undefined ? '' : ` status=${input.status}`;
    const reason = input.error === undefined
      ? ''
      : ` reason=${this.toLoggableErrorReason(input.error)}`;
    this.logger.error(
      `event=provider_request_failed ticket=${input.ticket} endpoint=${input.endpoint.origin}${input.endpoint.pathname} method=POST mode=${input.requestMode}${status} result=${input.result} request_body=${input.requestBody} response_body=${input.responseBody}${reason}`,
    );
  }

  private toLoggableBody(body: string): string {
    const normalized = body.replace(/[\r\n\t]+/g, ' ').trim();
    if (normalized === '') {
      return '<empty>';
    }
    if (normalized.length <= MAX_PROVIDER_LOG_BODY_LENGTH) {
      return normalized;
    }
    return `${normalized.slice(0, MAX_PROVIDER_LOG_BODY_LENGTH)}…[truncated]`;
  }

  private toLoggableErrorReason(error: unknown): string {
    if (!(error instanceof Error)) {
      return this.toLoggableBody(String(error));
    }

    const cause = error.cause;
    const causeMessage = cause instanceof Error
      ? ` cause=${cause.name}: ${cause.message}`
      : cause === undefined
        ? ''
        : ` cause=${String(cause)}`;

    return this.toLoggableBody(`${error.name}: ${error.message}${causeMessage}`);
  }

  private isResponse(value: unknown): value is {
    output_text: string; total_usd: number; response_id: string; provider: string; model: string;
  } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const response = value as Record<string, unknown>;
    return typeof response.output_text === 'string'
      && typeof response.total_usd === 'number'
      && typeof response.response_id === 'string'
      && typeof response.provider === 'string'
      && typeof response.model === 'string'
      && Number.isFinite(response.total_usd)
      && response.total_usd >= 0;
  }
}
