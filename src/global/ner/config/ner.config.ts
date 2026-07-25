import { Injectable } from '@nestjs/common';

const DEFAULT_NER_CALLBACK_SECRET = 'local-ner-callback-secret';
const DEFAULT_NER_REQUEST_TIMEOUT_MS = 5_000;
// NER API 경로가 확정되면 이 상수만 실제 분석 경로로 변경합니다.
const NER_ANALYZE_PATH = '/';

@Injectable()
export class NerConfig {
  readonly analyzeUrl = this.readAnalyzeUrl();
  readonly requestTimeoutMs = DEFAULT_NER_REQUEST_TIMEOUT_MS;
  readonly callbackSecret = this.readCallbackSecret();

  private readAnalyzeUrl(): string {
    const serverIp = process.env.NER_SERVER_IP?.trim();

    if (serverIp === undefined || serverIp.length === 0) {
      throw new Error('NER_SERVER_IP 환경 변수가 필요합니다.');
    }

    const serverUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(serverIp)
      ? serverIp
      : `http://${serverIp}`;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(serverUrl);
    } catch {
      throw new Error('NER_SERVER_IP 형식이 올바르지 않습니다.');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('NER_SERVER_IP는 HTTP 또는 HTTPS 주소여야 합니다.');
    }

    if (
      parsedUrl.username.length > 0
      || parsedUrl.password.length > 0
      || parsedUrl.search.length > 0
      || parsedUrl.hash.length > 0
      || parsedUrl.pathname !== '/'
    ) {
      throw new Error(
        'NER_SERVER_IP에는 인증 정보, 경로, 쿼리 또는 fragment를 입력할 수 없습니다.',
      );
    }

    return new URL(NER_ANALYZE_PATH, parsedUrl).toString();
  }

  private readCallbackSecret(): string {
    const secret = process.env.NER_CALLBACK_SECRET?.trim();

    if (secret !== undefined && secret.length > 0) {
      return secret;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('production 환경에서는 NER_CALLBACK_SECRET이 필요합니다.');
    }

    return DEFAULT_NER_CALLBACK_SECRET;
  }
}
