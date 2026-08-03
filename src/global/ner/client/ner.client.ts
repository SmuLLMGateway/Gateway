import { Injectable } from '@nestjs/common';
import { NerConfig } from '../config/ner.config.js';
import { NerRequestException } from '../exception/ner-request.exception.js';
import type {
  NerAnalyzeRequest,
  NerAnalyzeResponse,
  NerDetection,
} from '../type/ner-analyze-request.type.js';
import type { NerLlmDeployment } from '../type/ner-llm-deployment.type.js';

@Injectable()
export class NerClient {
  constructor(private readonly config: NerConfig) {}

  getDetectionConfiguration(): {
    nerDeploymentId: string;
    llmDeploymentId: string;
  } {
    if (
      this.config.nerDeploymentId === null
      || this.config.llmDeploymentId === null
    ) {
      throw new NerRequestException({
        cause: new Error('NER 배포 ID가 설정되지 않았습니다.'),
      });
    }

    return {
      nerDeploymentId: this.config.nerDeploymentId,
      llmDeploymentId: this.config.llmDeploymentId,
    };
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
      throw new NerRequestException();
    }

    try {
      return this.toAnalyzeResponse(await response.json());
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }
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

  /** NER 서버에 등록된 로컬 LLM 배포 목록을 조회합니다. */
  async getLlmDeployments(): Promise<readonly NerLlmDeployment[]> {
    let response: Response;

    try {
      response = await fetch(this.config.llmDeploymentsUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error: unknown) {
      throw new NerRequestException({ cause: error });
    }

    if (!response.ok) {
      throw new NerRequestException();
    }

    try {
      return this.toLlmDeployments(await response.json());
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

    return (payload as { deployments: unknown[] }).deployments.map((deployment) => {
      if (
        typeof deployment !== 'object'
        || deployment === null
        || typeof (deployment as { deploymentId?: unknown }).deploymentId !== 'string'
        || typeof (deployment as { displayName?: unknown }).displayName !== 'string'
        || typeof (deployment as { enabled?: unknown }).enabled !== 'boolean'
        || !(
          (deployment as { modelId?: unknown }).modelId === null
          || typeof (deployment as { modelId?: unknown }).modelId === 'string'
        )
      ) {
        throw new TypeError('NER LLM deployment 항목 형식이 올바르지 않습니다.');
      }

      const value = deployment as NerLlmDeployment;
      return {
        deploymentId: value.deploymentId,
        displayName: value.displayName,
        modelId: value.modelId,
        enabled: value.enabled,
      };
    });
  }
}
