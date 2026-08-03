import { Injectable } from '@nestjs/common';
import { readHttpServerBaseUrl } from '../../config/http-server-endpoint.config.js';

const DEFAULT_NER_REQUEST_TIMEOUT_MS = 5_000;
const NER_ANALYZE_PATH = '/detect';

@Injectable()
export class NerConfig {
  readonly baseUrl = readHttpServerBaseUrl('NER');
  readonly analyzeUrl = new URL(NER_ANALYZE_PATH, this.baseUrl).toString();
  readonly healthUrl = new URL('/health', this.baseUrl).toString();
  readonly nerDeploymentsUrl = new URL('/deployments/ner', this.baseUrl).toString();
  readonly llmDeploymentsUrl = new URL('/deployments/llm', this.baseUrl).toString();
  readonly requestTimeoutMs = DEFAULT_NER_REQUEST_TIMEOUT_MS;
}
