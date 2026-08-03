import { Injectable } from '@nestjs/common';
import { readHttpServerBaseUrl } from '../../config/http-server-endpoint.config.js';

const DEFAULT_NER_REQUEST_TIMEOUT_MS = 5_000;
const NER_ANALYZE_PATH = '/detect';

function readOptionalNonEmptyEnvironment(name: string): string | null {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? null : value;
}

@Injectable()
export class NerConfig {
  readonly baseUrl = readHttpServerBaseUrl('NER');
  readonly analyzeUrl = new URL(NER_ANALYZE_PATH, this.baseUrl).toString();
  readonly healthUrl = new URL('/health', this.baseUrl).toString();
  readonly llmDeploymentsUrl = new URL('/deployments/llm', this.baseUrl).toString();
  readonly requestTimeoutMs = DEFAULT_NER_REQUEST_TIMEOUT_MS;
  /**
   * 임시 서버 설정입니다. 향후 클라이언트가 선택한 NER·LLM 배포 ID로
   * 요청별 대체할 수 있도록 NerClient 경계에서만 사용합니다.
   */
  readonly nerDeploymentId = readOptionalNonEmptyEnvironment('NER_DEPLOYMENT_ID');
  readonly llmDeploymentId = readOptionalNonEmptyEnvironment('NER_LLM_DEPLOYMENT_ID');
}
