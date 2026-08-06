import { Injectable } from '@nestjs/common';
import { readHttpServerBaseUrl } from '../../config/http-server-endpoint.config.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;

/** Provider 서버 연동의 공통 접속 설정입니다. 실제 LLM 요청 경로는 Provider 계약 확정 후 클라이언트에서 추가합니다. */
@Injectable()
export class ProviderConfig {
  readonly baseUrl = readHttpServerBaseUrl('PROVIDER');
  readonly healthUrl = new URL('/health', this.baseUrl).toString();
  readonly requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;
}
