import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NerConfig } from '../config/ner.config.js';
import { NerRequestException } from '../exception/ner-request.exception.js';
import type {
  NerAnalyzeRequest,
  NerAnalyzeResponse,
  NerDetection,
} from '../type/ner-analyze-request.type.js';
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
import { toLocalLlmModelName } from '../../llm/llm-service.mapping.js';

const MAX_NER_ERROR_RESPONSE_BODY_LOG_LENGTH = 4_096;

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
    let response: Response;

    try {
      response = await fetch(this.config.analyzeUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }

    if (!response.ok) {
      const responseBody = await this.toLoggableErrorResponseBody(response);
      this.logger.error(
        `event=ner_analyze_request_failed endpoint=${new URL(this.config.analyzeUrl).pathname} status=${response.status} response_body=${responseBody}`,
      );
      throw new NerRequestException({ status: response.status });
    }

    try {
      return this.toAnalyzeResponse(await response.json());
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }
  }

  /** 실패 응답은 원문을 보존하되 로그 주입과 과도한 로그 적재를 막습니다. */
  private async toLoggableErrorResponseBody(response: Response): Promise<string> {
    try {
      const body = (await response.text())
        .replace(/[\r\n\t]+/g, ' ')
        .trim();
      if (body === '') {
        return '<empty>';
      }
      if (body.length <= MAX_NER_ERROR_RESPONSE_BODY_LOG_LENGTH) {
        return body;
      }
      return `${body.slice(0, MAX_NER_ERROR_RESPONSE_BODY_LOG_LENGTH)}…[truncated]`;
    } catch {
      return '<unavailable>';
    }
  }

  private async createDeployment(
    url: string,
    request: Readonly<NerDeploymentCreateRequest | LlmDeploymentCreateRequest>,
  ): Promise<DeploymentCreateResponse> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }

    if (response.status !== HttpStatus.CREATED) {
      throw new NerRequestException({ status: response.status });
    }

    try {
      return this.toDeploymentCreateResponse(await response.json());
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }
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

    let response: Response;

    try {
      response = await fetch(
        this.toDeploymentEnabledUrl(deploymentsUrl, normalizedDeploymentId),
        {
          method: 'PATCH',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        },
      );
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }

    if (response.status !== HttpStatus.OK) {
      throw new NerRequestException({ status: response.status });
    }

    try {
      return parseResponse(await response.json());
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }
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

  private async getFirstDeploymentId(url: string): Promise<string> {
    let response: Response;

    try {
      response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }

    if (!response.ok) {
      throw new NerRequestException({ status: response.status });
    }

    try {
      const payload: unknown = await response.json();
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

  private async getDeploymentSummaries(
    url: string,
  ): Promise<readonly NerDeploymentSummary[]> {
    let response: Response;

    try {
      response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }

    if (!response.ok) {
      throw new NerRequestException({ status: response.status });
    }

    try {
      return this.toLlmDeployments(await response.json());
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }
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
   * Gateway의 local-* 모델명에 대응하는 첫 활성 LPL LLM Deployment ID를 찾습니다.
   * 신규 등록 Deployment는 ID 자체가 llm_detail_model.llm_name과 같으므로 목록에서
   * 먼저 직접 찾고, 이전 ollama-* 등록 항목은 상세 modelName 비교로 호환합니다.
   */
  async getEnabledLlmDeploymentIdByModelName(
    modelName: string,
  ): Promise<string | null> {
    const normalizedModelName = toLocalLlmModelName(modelName);
    if (normalizedModelName === null) {
      return null;
    }

    const deployments = await this.getLlmDeployments();
    const directDeployment = deployments.find((deployment) => (
      deployment.enabled
      && deployment.deploymentId.toLowerCase()
        === normalizedModelName.toLowerCase()
    ));
    if (directDeployment !== undefined) {
      return directDeployment.deploymentId;
    }

    for (const deployment of deployments) {
      if (!deployment.enabled) {
        continue;
      }

      const detail = await this.getLlmDeployment(deployment.deploymentId);
      if (!detail.enabled || detail.modelName === undefined) {
        continue;
      }

      const normalizedDetailModelName = toLocalLlmModelName(detail.modelName);
      if (
        normalizedDetailModelName !== null
        && normalizedDetailModelName.toLowerCase()
          === normalizedModelName.toLowerCase()
      ) {
        return detail.deploymentId;
      }
    }

    return null;
  }

  /** LPL에서 특정 로컬 LLM Deployment의 상세 실행 설정을 조회합니다. */
  async getLlmDeployment(
    deploymentId: string,
  ): Promise<NerLlmDeploymentDetail> {
    const normalizedDeploymentId = this.normalizeDeploymentId(deploymentId);
    let response: Response;

    try {
      response = await fetch(
        this.toLlmDeploymentDetailUrl(normalizedDeploymentId),
        {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        },
      );
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }

    if (!response.ok) {
      throw new NerRequestException({ status: response.status });
    }

    try {
      return this.toLlmDeploymentDetail(await response.json());
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }
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
