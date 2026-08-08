import { Injectable } from '@nestjs/common';
import { readHttpServerBaseUrl } from '../../config/http-server-endpoint.config.js';

// LPL이 허용하는 Local LLM 요청 최대 5분보다 여유를 둔 Gateway→LPL 제한 시간입니다.
const DEFAULT_NER_REQUEST_TIMEOUT_MS = 360_000;
const NER_ANALYZE_PATH = '/detect';
const LPL_LLM_GENERATE_PATH = '/generate';
const LPL_CHAT_TITLE_PATH = '/titles';

@Injectable()
export class NerConfig {
  readonly baseUrl = readHttpServerBaseUrl('NER');
  readonly analyzeUrl = new URL(NER_ANALYZE_PATH, this.baseUrl).toString();
  readonly generateUrl = new URL(LPL_LLM_GENERATE_PATH, this.baseUrl).toString();
  readonly titlesUrl = new URL(LPL_CHAT_TITLE_PATH, this.baseUrl).toString();
  readonly healthUrl = new URL('/health', this.baseUrl).toString();
  readonly nerDeploymentsUrl = new URL('/deployments/ner', this.baseUrl).toString();
  readonly llmDeploymentsUrl = new URL('/deployments/llm', this.baseUrl).toString();
  readonly requestTimeoutMs = DEFAULT_NER_REQUEST_TIMEOUT_MS;
}
