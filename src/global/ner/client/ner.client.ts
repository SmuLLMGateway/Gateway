import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NerConfig } from '../config/ner.config.js';
import { NerRequestException } from '../exception/ner-request.exception.js';
import type {
  NerAnalyzeRequest,
  NerAnalyzeResponse,
  NerDetection,
} from '../type/ner-analyze-request.type.js';
import type {
  LplLlmGenerateRequest,
  LplLlmGenerateResponse,
  LplLlmGenerateUsage,
} from '../type/lpl-llm-generate.type.js';
import type {
  LplChatTitleRequest,
  LplChatTitleResponse,
} from '../type/lpl-chat-title.type.js';
import type {
  NerLlmDeployment,
  NerLlmDeploymentDetail,
} from '../type/ner-llm-deployment.type.js';
import type {
  NerDeploymentDetail,
  NerDeploymentSummary,
} from '../type/ner-deployment-summary.type.js';
import type {
  DeploymentCreateResponse,
  DeploymentEnabledUpdateRequest,
  LlmDeploymentCreateRequest,
  NerDeploymentCreateRequest,
} from '../type/ner-deployment-registration.type.js';
import {
  isLocalLlmModelName,
  toLocalLlmModelName,
} from '../../llm/llm-service.mapping.js';

const MAX_LPL_LOG_BODY_LENGTH = 4_096;
const MAX_LPL_CHAT_TITLE_LENGTH = 30;
const MAX_LPL_CHAT_TITLE_BYTES = 120;

@Injectable()
export class NerClient {
  private readonly logger = new Logger(NerClient.name);

  constructor(private readonly config: NerConfig) {}

  /** LPL Registry 목록에서 활성화된 첫 NER Deployment를 반환합니다. */
  async getFirstNerDeploymentId(): Promise<string> {
    return this.getFirstDeploymentId(this.config.nerDeploymentsUrl);
  }

  /** LPL Registry 목록에서 활성화된 첫 Local LLM Deployment를 반환합니다. */
  async getFirstLlmDeploymentId(): Promise<string> {
    return this.getFirstDeploymentId(this.config.llmDeploymentsUrl);
  }

  /** LPL Provider에 지원하는 NER Deployment를 등록합니다. */
  async createNerDeployment(
    request: Readonly<NerDeploymentCreateRequest>,
  ): Promise<DeploymentCreateResponse> {
    return this.createDeployment(this.config.nerDeploymentsUrl, request);
  }

  /** LPL Provider에 지원하는 로컬 LLM Deployment를 등록합니다. */
  async createLlmDeployment(
    request: Readonly<LlmDeploymentCreateRequest>,
  ): Promise<DeploymentCreateResponse> {
    return this.createDeployment(this.config.llmDeploymentsUrl, request);
  }

  /** LPL Provider에 등록된 로컬 LLM Deployment의 활성 상태를 변경합니다. */
  async updateLlmDeploymentEnabled(
    deploymentId: string,
    enabled: boolean,
  ): Promise<NerLlmDeploymentDetail> {
    return this.updateDeploymentEnabled(
      this.config.llmDeploymentsUrl,
      deploymentId,
      enabled,
      (payload) => this.toLlmDeploymentDetail(payload),
    );
  }

  /** LPL Provider에 등록된 NER Deployment의 활성 상태를 변경합니다. */
  async updateNerDeploymentEnabled(
    deploymentId: string,
    enabled: boolean,
  ): Promise<NerDeploymentDetail> {
    return this.updateDeploymentEnabled(
      this.config.nerDeploymentsUrl,
      deploymentId,
      enabled,
      (payload) => this.toNerDeploymentDetail(payload),
    );
  }

  /** LPL Provider에 등록된 NER Deployment 요약 목록을 조회합니다. */
  async getNerDeployments(): Promise<readonly NerDeploymentSummary[]> {
    return this.getDeploymentSummaries(this.config.nerDeploymentsUrl);
  }

  /** LPL Provider에 NER·로컬 LLM 통합 탐지를 요청하고 결과를 즉시 받습니다. */
  async requestAnalyze(
    request: Readonly<NerAnalyzeRequest>,
  ): Promise<NerAnalyzeResponse> {
    const endpoint = new URL(this.config.analyzeUrl).pathname;
    const requestBody = JSON.stringify(request);
    const loggableRequestBody = this.toLoggableAnalyzeRequestBody(request);
    let response: Response;

    try {
      response = await fetch(this.config.analyzeUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: requestBody,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      this.logAnalyzeRequestFailure({
        endpoint,
        status: 'NETWORK_ERROR',
        request,
        requestBody: loggableRequestBody,
        responseBody: '<not_received>',
        error,
      });
      throw new NerRequestException({ cause: error });
    }

    if (!response.ok) {
      const responseBody = await this.toLoggableResponseBody(response);
      this.logAnalyzeRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody,
      });
      throw new NerRequestException({ status: response.status });
    }

    let responseBody: string | undefined;
    try {
      responseBody = await response.text();
      const result = this.toAnalyzeResponse(JSON.parse(responseBody));
      this.logger.log(
        `event=ner_analyze_response_received method=POST endpoint=${endpoint} status=${response.status} text_chars=${request.text.length} existing_detection_count=${request.existingDetections.length} request_body=${loggableRequestBody} response_body=${this.toLoggableBody(responseBody)}`,
      );
      return result;
    } catch (error: unknown) {
      this.logAnalyzeRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody: responseBody === undefined
          ? '<unavailable>'
          : this.toLoggableBody(responseBody),
        error,
      });
      throw new NerRequestException({ cause: error });
    }
  }

  /**
   * API 키 없이 LPL Provider의 활성 로컬 LLM에 응답 생성을 요청합니다.
   * Gateway의 local-* 모델명과 LPL Deployment ID는 등록 시 동일하게 저장됩니다.
   */
  async requestLlmGenerate(
    request: Readonly<LplLlmGenerateRequest>,
  ): Promise<LplLlmGenerateResponse> {
    const endpoint = new URL(this.config.generateUrl).pathname;
    const requestBody = JSON.stringify(request);
    const loggableRequestBody = this.toLoggableBody(requestBody);
    let response: Response;

    try {
      response = await fetch(this.config.generateUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: requestBody,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      this.logLlmGenerateRequestFailure({
        endpoint,
        status: 'NETWORK_ERROR',
        request,
        requestBody: loggableRequestBody,
        responseBody: '<not_received>',
        error,
      });
      throw new NerRequestException({ cause: error });
    }

    let responseBody: string | undefined;
    try {
      responseBody = await response.text();
    } catch (error: unknown) {
      this.logLlmGenerateRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody: '<unavailable>',
        error,
      });
      throw new NerRequestException({ cause: error });
    }

    const loggableResponseBody = this.toLoggableBody(responseBody);
    if (response.status !== HttpStatus.OK) {
      this.logLlmGenerateRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody: loggableResponseBody,
      });
      throw new NerRequestException({ status: response.status });
    }

    try {
      const result = this.toLplLlmGenerateResponse(JSON.parse(responseBody));
      this.logger.log(
        `event=lpl_llm_generate_response_received method=POST endpoint=${endpoint} status=${response.status} llm_deployment_id=${request.llmDeploymentId} text_chars=${request.text.length} request_body=${loggableRequestBody} response_body=${loggableResponseBody}`,
      );
      return result;
    } catch (error: unknown) {
      this.logLlmGenerateRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody: loggableResponseBody,
        error,
      });
      throw new NerRequestException({ cause: error });
    }
  }

  /** LPL Provider에 마스킹된 사용자 입력의 짧은 제목 생성을 요청합니다. */
  async requestChatTitle(
    request: Readonly<LplChatTitleRequest>,
  ): Promise<LplChatTitleResponse> {
    const endpoint = new URL(this.config.titlesUrl).pathname;
    const requestBody = JSON.stringify(request);
    const loggableRequestBody = this.toLoggableBody(requestBody);
    let response: Response;

    try {
      response = await fetch(this.config.titlesUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: requestBody,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      this.logChatTitleRequestFailure({
        endpoint,
        status: 'NETWORK_ERROR',
        request,
        requestBody: loggableRequestBody,
        responseBody: '<not_received>',
        error,
      });
      throw new NerRequestException({ cause: error });
    }

    let responseBody: string | undefined;
    try {
      responseBody = await response.text();
    } catch (error: unknown) {
      this.logChatTitleRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody: '<unavailable>',
        error,
      });
      throw new NerRequestException({ cause: error });
    }

    const loggableResponseBody = this.toLoggableBody(responseBody);
    if (response.status !== HttpStatus.OK) {
      this.logChatTitleRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody: loggableResponseBody,
      });
      throw new NerRequestException({ status: response.status });
    }

    try {
      const result = this.toLplChatTitleResponse(JSON.parse(responseBody));
      this.logger.log(
        `event=lpl_chat_title_response_received method=POST endpoint=${endpoint} status=${response.status} llm_deployment_id=${request.llmDeploymentId} text_chars=${request.text.length} request_body=${loggableRequestBody} response_body=${loggableResponseBody}`,
      );
      return result;
    } catch (error: unknown) {
      this.logChatTitleRequestFailure({
        endpoint,
        status: String(response.status),
        request,
        requestBody: loggableRequestBody,
        responseBody: loggableResponseBody,
        error,
      });
      throw new NerRequestException({ cause: error });
    }
  }

  /** NER 분석 요청·응답 본문은 로그 주입·과도한 적재를 막아 정규화해 남깁니다. */
  private toLoggableAnalyzeRequestBody(
    request: Readonly<NerAnalyzeRequest>,
  ): string {
    return this.toLoggableBody(JSON.stringify({
      nerDeploymentId: request.nerDeploymentId,
      llmDeploymentId: request.llmDeploymentId,
      existingDetections: request.existingDetections,
      text: request.text,
    }) ?? '<unserializable>');
  }

  private async toLoggableResponseBody(response: Response): Promise<string> {
    try {
      return this.toLoggableBody(await response.text());
    } catch {
      return '<unavailable>';
    }
  }

  private toLoggableBody(body: string): string {
    const normalized = body.replace(/[\r\n\t]+/g, ' ').trim();
    if (normalized === '') {
      return '<empty>';
    }
    if (normalized.length <= MAX_LPL_LOG_BODY_LENGTH) {
      return normalized;
    }
    return `${normalized.slice(0, MAX_LPL_LOG_BODY_LENGTH)}…[truncated]`;
  }

  private logAnalyzeRequestFailure(input: Readonly<{
    endpoint: string;
    status: string;
    request: NerAnalyzeRequest;
    requestBody: string;
    responseBody: string;
    error?: unknown;
  }>): void {
    const reason = input.error === undefined
      ? ''
      : ` reason=${this.toLoggableErrorReason(input.error)}`;
    this.logger.error(
      `event=ner_analyze_request_failed method=POST endpoint=${input.endpoint} status=${input.status} text_chars=${input.request.text.length} existing_detection_count=${input.request.existingDetections.length} request_body=${input.requestBody} response_body=${input.responseBody}${reason}`,
    );
  }

  private logLlmGenerateRequestFailure(input: Readonly<{
    endpoint: string;
    status: string;
    request: LplLlmGenerateRequest;
    requestBody: string;
    responseBody: string;
    error?: unknown;
  }>): void {
    const reason = input.error === undefined
      ? ''
      : ` reason=${this.toLoggableErrorReason(input.error)}`;
    this.logger.error(
      `event=lpl_llm_generate_request_failed method=POST endpoint=${input.endpoint} status=${input.status} llm_deployment_id=${input.request.llmDeploymentId} text_chars=${input.request.text.length} request_body=${input.requestBody} response_body=${input.responseBody}${reason}`,
    );
  }

  private logChatTitleRequestFailure(input: Readonly<{
    endpoint: string;
    status: string;
    request: LplChatTitleRequest;
    requestBody: string;
    responseBody: string;
    error?: unknown;
  }>): void {
    const reason = input.error === undefined
      ? ''
      : ` reason=${this.toLoggableErrorReason(input.error)}`;
    this.logger.error(
      `event=lpl_chat_title_request_failed method=POST endpoint=${input.endpoint} status=${input.status} llm_deployment_id=${input.request.llmDeploymentId} text_chars=${input.request.text.length} request_body=${input.requestBody} response_body=${input.responseBody}${reason}`,
    );
  }

  /**
   * Deployment 등록·상태 변경·조회처럼 공통 LPL JSON 계약을 사용하는 요청의
   * 요청/응답 본문을 성공·실패 모두 기록합니다.
   */
  private async requestLplJson<T>(input: Readonly<{
    url: string;
    method: 'GET' | 'POST' | 'PATCH';
    requestBody?: string;
    expectedStatus: number;
    parseResponse: (payload: unknown) => T;
  }>): Promise<T> {
    const endpoint = new URL(input.url).pathname;
    const requestBody = input.requestBody === undefined
      ? '<empty>'
      : this.toLoggableBody(input.requestBody);
    const init: RequestInit = input.method === 'GET'
      ? {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      }
      : {
        method: input.method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: input.requestBody,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      };
    let response: Response;

    try {
      response = await fetch(input.url, init);
    } catch (error: unknown) {
      this.logLplRequestFailure({
        method: input.method,
        endpoint,
        status: 'NETWORK_ERROR',
        result: 'network_error',
        requestBody,
        responseBody: '<not_received>',
        error,
      });
      throw new NerRequestException({ cause: error });
    }

    let responseBody: string;
    try {
      responseBody = await response.text();
    } catch (error: unknown) {
      this.logLplRequestFailure({
        method: input.method,
        endpoint,
        status: String(response.status),
        result: 'response_body_unavailable',
        requestBody,
        responseBody: '<unavailable>',
        error,
      });
      throw new NerRequestException({ cause: error });
    }

    const loggableResponseBody = this.toLoggableBody(responseBody);
    if (response.status !== input.expectedStatus) {
      this.logLplRequestFailure({
        method: input.method,
        endpoint,
        status: String(response.status),
        result: 'http_error',
        requestBody,
        responseBody: loggableResponseBody,
      });
      throw new NerRequestException({ status: response.status });
    }

    try {
      const result = input.parseResponse(JSON.parse(responseBody));
      this.logger.log(
        `event=lpl_response_received method=${input.method} endpoint=${endpoint} status=${response.status} request_body=${requestBody} response_body=${loggableResponseBody}`,
      );
      return result;
    } catch (error: unknown) {
      this.logLplRequestFailure({
        method: input.method,
        endpoint,
        status: String(response.status),
        result: 'invalid_response',
        requestBody,
        responseBody: loggableResponseBody,
        error,
      });
      throw new NerRequestException({ cause: error });
    }
  }

  private logLplRequestFailure(input: Readonly<{
    method: 'GET' | 'POST' | 'PATCH';
    endpoint: string;
    status: string;
    result: 'network_error' | 'response_body_unavailable' | 'http_error' | 'invalid_response';
    requestBody: string;
    responseBody: string;
    error?: unknown;
  }>): void {
    const reason = input.error === undefined
      ? ''
      : ` reason=${this.toLoggableErrorReason(input.error)}`;
    this.logger.error(
      `event=lpl_request_failed method=${input.method} endpoint=${input.endpoint} status=${input.status} result=${input.result} request_body=${input.requestBody} response_body=${input.responseBody}${reason}`,
    );
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

  private async createDeployment(
    url: string,
    request: Readonly<NerDeploymentCreateRequest | LlmDeploymentCreateRequest>,
  ): Promise<DeploymentCreateResponse> {
    return this.requestLplJson({
      url,
      method: 'POST',
      requestBody: JSON.stringify(request),
      expectedStatus: HttpStatus.CREATED,
      parseResponse: (payload) => this.toDeploymentCreateResponse(payload),
    });
  }

  private async updateDeploymentEnabled<T>(
    deploymentsUrl: string,
    deploymentId: string,
    enabled: boolean,
    parseResponse: (payload: unknown) => T,
  ): Promise<T> {
    const normalizedDeploymentId = this.normalizeDeploymentId(deploymentId);
    const request: DeploymentEnabledUpdateRequest = { enabled };

    if (typeof enabled !== 'boolean') {
      throw new NerRequestException({
        cause: new TypeError('NER Deployment 활성 상태 형식이 올바르지 않습니다.'),
      });
    }

    return this.requestLplJson({
      url: this.toDeploymentEnabledUrl(deploymentsUrl, normalizedDeploymentId),
      method: 'PATCH',
      requestBody: JSON.stringify(request),
      expectedStatus: HttpStatus.OK,
      parseResponse,
    });
  }

  private toDeploymentCreateResponse(payload: unknown): DeploymentCreateResponse {
    if (
      typeof payload !== 'object'
      || payload === null
      || typeof (payload as { deploymentId?: unknown }).deploymentId !== 'string'
      || (payload as { deploymentId: string }).deploymentId.trim().length === 0
    ) {
      throw new TypeError('NER Deployment 등록 응답 형식이 올바르지 않습니다.');
    }

    return {
      deploymentId: (payload as { deploymentId: string }).deploymentId,
    };
  }

  private toAnalyzeResponse(payload: unknown): NerAnalyzeResponse {
    if (
      typeof payload !== 'object'
      || payload === null
      || !Array.isArray((payload as { detections?: unknown }).detections)
    ) {
      throw new TypeError('NER 탐지 응답 형식이 올바르지 않습니다.');
    }

    const detections = (payload as { detections: unknown[] }).detections.map(
      (detection): NerDetection => {
        if (!this.isDetection(detection)) {
          throw new TypeError('NER 탐지 항목 형식이 올바르지 않습니다.');
        }
        return detection;
      },
    );

    return { detections };
  }

  private toLplLlmGenerateResponse(payload: unknown): LplLlmGenerateResponse {
    if (
      typeof payload !== 'object'
      || payload === null
      || typeof (payload as { text?: unknown }).text !== 'string'
    ) {
      throw new TypeError('LPL LLM 응답 생성 응답 형식이 올바르지 않습니다.');
    }

    const value = payload as {
      text: string;
      modelName?: unknown;
      finishReason?: unknown;
      usage?: unknown;
    };
    const modelName = this.toOptionalLplResponseText(value.modelName, 'modelName');
    const finishReason = this.toOptionalLplResponseText(
      value.finishReason,
      'finishReason',
    );
    const usage = value.usage === undefined
      ? undefined
      : this.toLplLlmGenerateUsage(value.usage);

    return {
      text: value.text,
      ...(modelName === undefined ? {} : { modelName }),
      ...(finishReason === undefined ? {} : { finishReason }),
      ...(usage === undefined ? {} : { usage }),
    };
  }

  private toLplChatTitleResponse(payload: unknown): LplChatTitleResponse {
    if (
      typeof payload !== 'object'
      || payload === null
      || typeof (payload as { title?: unknown }).title !== 'string'
    ) {
      throw new TypeError('LPL 채팅방 제목 생성 응답 형식이 올바르지 않습니다.');
    }

    const title = (payload as { title: string }).title.trim();
    if (
      title.length === 0
      || Array.from(title).length > MAX_LPL_CHAT_TITLE_LENGTH
      || /[\r\n]/.test(title)
      || Buffer.byteLength(title, 'utf8') > MAX_LPL_CHAT_TITLE_BYTES
    ) {
      throw new TypeError('LPL 채팅방 제목 생성 응답 title 형식이 올바르지 않습니다.');
    }

    return { title };
  }

  private toOptionalLplResponseText(
    value: unknown,
    field: string,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new TypeError(`LPL LLM 응답 생성 ${field} 형식이 올바르지 않습니다.`);
    }
    return value;
  }

  private toLplLlmGenerateUsage(value: unknown): LplLlmGenerateUsage {
    if (typeof value !== 'object' || value === null) {
      throw new TypeError('LPL LLM 응답 생성 usage 형식이 올바르지 않습니다.');
    }

    const usage = value as {
      inputTokens?: unknown;
      outputTokens?: unknown;
      totalTokens?: unknown;
    };
    const tokenValues = [
      usage.inputTokens,
      usage.outputTokens,
      usage.totalTokens,
    ];
    if (tokenValues.some((token) => (
      typeof token !== 'number'
      || !Number.isSafeInteger(token)
      || token < 0
    ))) {
      throw new TypeError('LPL LLM 응답 생성 usage 토큰 형식이 올바르지 않습니다.');
    }

    return {
      inputTokens: usage.inputTokens as number,
      outputTokens: usage.outputTokens as number,
      totalTokens: usage.totalTokens as number,
    };
  }

  private async getFirstDeploymentId(url: string): Promise<string> {
    let payload: unknown;
    try {
      payload = await this.requestLplJson({
        url,
        method: 'GET',
        expectedStatus: HttpStatus.OK,
        parseResponse: (value) => value,
      });
      if (
        typeof payload !== 'object'
        || payload === null
        || !Array.isArray((payload as { deployments?: unknown }).deployments)
      ) {
        this.throwInvalidDeploymentList(url, 'null_or_invalid_payload');
      }
      const deployment = (payload as { deployments: unknown[] }).deployments.find(
        (candidate) => typeof candidate === 'object'
          && candidate !== null
          && (candidate as { enabled?: unknown }).enabled === true,
      );
      if (deployment === undefined) {
        this.throwInvalidDeploymentList(url, 'no_enabled_deployments');
      }
      if (
        typeof deployment !== 'object'
        || deployment === null
        || typeof (deployment as { deploymentId?: unknown }).deploymentId !== 'string'
        || (deployment as { deploymentId: string }).deploymentId.trim().length === 0
        || typeof (deployment as { enabled?: unknown }).enabled !== 'boolean'
      ) {
        this.throwInvalidDeploymentList(url, 'invalid_first_deployment');
      }
      return (deployment as { deploymentId: string }).deploymentId;
    } catch (error: unknown) {
      if (error instanceof NerRequestException) {
        throw error;
      }
      throw new NerRequestException({ cause: error });
    }
  }

  private throwInvalidDeploymentList(url: string, reason: string): never {
    const endpoint = new URL(url).pathname;
    this.logger.error(
      `event=ner_deployment_list_unavailable endpoint=${endpoint} reason=${reason}`,
    );
    throw new TypeError('사용할 NER Deployment가 없습니다.');
  }

  private isDetection(value: unknown): value is NerDetection {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const detection = value as Record<string, unknown>;
    return Number.isInteger(detection.start)
      && (detection.start as number) >= 0
      && Number.isInteger(detection.end)
      && (detection.end as number) > (detection.start as number)
      && typeof detection.text === 'string'
      && detection.text.length > 0
      && typeof detection.type === 'string'
      && detection.type.trim().length > 0
      && (detection.source === 'ner' || detection.source === 'llm')
      && typeof detection.score === 'number'
      && Number.isFinite(detection.score)
      && detection.score >= 0
      && detection.score <= 1
      && (detection.maskingText === undefined
        || (typeof detection.maskingText === 'string'
          && detection.maskingText.trim().length > 0));
  }

  /** LPL Provider에 등록된 로컬 LLM 배포 목록을 조회합니다. */
  async getLlmDeployments(): Promise<readonly NerLlmDeployment[]> {
    return this.getDeploymentSummaries(this.config.llmDeploymentsUrl);
  }

  /**
   * Gateway DB에 저장할 활성 로컬 LLM 식별자입니다. modelName이 아닌 LPL의
   * deploymentId를 그대로 반환합니다. 등록 규칙상 이 값은 local-* 형식입니다.
   */
  async getEnabledLocalLlmDeploymentIds(): Promise<readonly string[]> {
    const deployments = await this.getLlmDeployments();
    return [...new Set(
      deployments.flatMap(({ deploymentId, enabled }) => (
        enabled && isLocalLlmModelName(deploymentId)
          ? [deploymentId]
          : []
      )),
    )];
  }

  private async getDeploymentSummaries(
    url: string,
  ): Promise<readonly NerDeploymentSummary[]> {
    return this.requestLplJson({
      url,
      method: 'GET',
      expectedStatus: HttpStatus.OK,
      parseResponse: (payload) => this.toLlmDeployments(payload),
    });
  }

  /**
   * 활성 LLM Deployment를 목록에서 찾고, 각 상세 설정의 modelName을 반환합니다.
   * 목록 응답에는 modelName이 포함되지 않으므로 상세 API 조회가 필요합니다.
   */
  async getEnabledLlmModelNames(): Promise<readonly string[]> {
    const deployments = await this.getLlmDeployments();
    const details = await Promise.all(
      deployments
        .filter((deployment) => deployment.enabled)
        .map((deployment) => this.getLlmDeployment(deployment.deploymentId)),
    );

    return [...new Set(details.flatMap((deployment) => (
      deployment.enabled && deployment.modelName !== undefined
        ? [deployment.modelName]
        : []
    )))];
  }

  /**
   * llm_detail_model.llm_name과 동일한 local-* Deployment ID가 활성 상태인지
   * 확인합니다. 레거시 modelName 보정은 새 등록 규칙과 혼동되므로 사용하지 않습니다.
   */
  async getEnabledLlmDeploymentIdByModelName(
    modelName: string,
  ): Promise<string | null> {
    const normalizedModelName = modelName.trim();
    if (!isLocalLlmModelName(normalizedModelName)) {
      return null;
    }

    const deploymentIds = await this.getEnabledLocalLlmDeploymentIds();
    return deploymentIds.find((deploymentId) => (
      deploymentId.toLowerCase() === normalizedModelName.toLowerCase()
    )) ?? null;
  }

  /** LPL에서 특정 로컬 LLM Deployment의 상세 실행 설정을 조회합니다. */
  async getLlmDeployment(
    deploymentId: string,
  ): Promise<NerLlmDeploymentDetail> {
    const normalizedDeploymentId = this.normalizeDeploymentId(deploymentId);
    return this.requestLplJson({
      url: this.toLlmDeploymentDetailUrl(normalizedDeploymentId),
      method: 'GET',
      expectedStatus: HttpStatus.OK,
      parseResponse: (payload) => this.toLlmDeploymentDetail(payload),
    });
  }

  private toLlmDeployments(payload: unknown): readonly NerLlmDeployment[] {
    if (
      typeof payload !== 'object'
      || payload === null
      || !Array.isArray((payload as { deployments?: unknown }).deployments)
    ) {
      throw new TypeError('NER LLM deployments 응답 형식이 올바르지 않습니다.');
    }

    return (payload as { deployments: unknown[] }).deployments.map(
      (deployment) => this.toLlmDeploymentSummary(deployment),
    );
  }

  private toLlmDeploymentDetail(payload: unknown): NerLlmDeploymentDetail {
    const deployment = this.toLlmDeploymentSummary(payload);
    if (
      typeof payload !== 'object'
      || payload === null
      || typeof (payload as { adapterType?: unknown }).adapterType !== 'string'
      || (payload as { adapterType: string }).adapterType.trim().length === 0
    ) {
      throw new TypeError('NER LLM deployment 상세 응답 형식이 올바르지 않습니다.');
    }

    const value = payload as {
      adapterType: string;
      baseUrl?: unknown;
      modelName?: unknown;
      timeoutMs?: unknown;
    };
    const baseUrl = this.toOptionalNonBlankText(value.baseUrl);
    const modelName = this.toOptionalNonBlankText(value.modelName);
    const timeoutMs = value.timeoutMs;
    if (
      timeoutMs !== undefined
      && (typeof timeoutMs !== 'number'
        || !Number.isSafeInteger(timeoutMs)
        || timeoutMs <= 0)
    ) {
      throw new TypeError('NER LLM deployment timeoutMs 형식이 올바르지 않습니다.');
    }

    return {
      ...deployment,
      adapterType: value.adapterType.trim(),
      ...(baseUrl === undefined ? {} : { baseUrl }),
      ...(modelName === undefined ? {} : { modelName }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    };
  }

  private toNerDeploymentDetail(payload: unknown): NerDeploymentDetail {
    const deployment = this.toLlmDeploymentSummary(payload);
    if (
      typeof payload !== 'object'
      || payload === null
      || typeof (payload as { adapterType?: unknown }).adapterType !== 'string'
      || (payload as { adapterType: string }).adapterType.trim().length === 0
    ) {
      throw new TypeError('NER deployment 상세 응답 형식이 올바르지 않습니다.');
    }

    const value = payload as {
      adapterType: string;
      baseUrl?: unknown;
      timeoutMs?: unknown;
    };
    const baseUrl = this.toOptionalNonBlankText(value.baseUrl);
    const timeoutMs = value.timeoutMs;
    if (
      timeoutMs !== undefined
      && (typeof timeoutMs !== 'number'
        || !Number.isSafeInteger(timeoutMs)
        || timeoutMs <= 0)
    ) {
      throw new TypeError('NER deployment timeoutMs 형식이 올바르지 않습니다.');
    }

    return {
      ...deployment,
      adapterType: value.adapterType.trim(),
      ...(baseUrl === undefined ? {} : { baseUrl }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    };
  }

  private toLlmDeploymentSummary(payload: unknown): NerLlmDeployment {
    if (
      typeof payload !== 'object'
      || payload === null
      || typeof (payload as { deploymentId?: unknown }).deploymentId !== 'string'
      || (payload as { deploymentId: string }).deploymentId.trim().length === 0
      || typeof (payload as { enabled?: unknown }).enabled !== 'boolean'
    ) {
      throw new TypeError('NER LLM deployment 항목 형식이 올바르지 않습니다.');
    }

    return {
      deploymentId: (payload as { deploymentId: string }).deploymentId.trim(),
      enabled: (payload as { enabled: boolean }).enabled,
    };
  }

  private normalizeDeploymentId(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new TypeError('NER LLM deployment ID 형식이 올바르지 않습니다.');
    }

    return value.trim();
  }

  private toLlmDeploymentDetailUrl(deploymentId: string): string {
    const url = new URL(this.config.llmDeploymentsUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(deploymentId)}`;
    return url.toString();
  }

  private toDeploymentEnabledUrl(
    deploymentsUrl: string,
    deploymentId: string,
  ): string {
    const url = new URL(deploymentsUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(deploymentId)}/enabled`;
    return url.toString();
  }

  private toOptionalNonBlankText(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new TypeError('NER LLM deployment 상세 문자열 형식이 올바르지 않습니다.');
    }

    return value.trim();
  }
}
