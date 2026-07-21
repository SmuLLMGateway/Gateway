import { Injectable } from '@nestjs/common';

const DEFAULT_NER_SERVER_URL = 'http://localhost:8000';
const DEFAULT_NER_ANALYZE_PATH = '/analyze';
const DEFAULT_NER_TIMEOUT_MS = 10_000;

@Injectable()
export class NerConfig {
  readonly serverUrl = this.readServerUrl();
  readonly analyzePath = this.readAnalyzePath();
  readonly timeoutMs = this.readTimeout();
  readonly apiKey = this.readOptionalApiKey();
  readonly analyzeUrl = new URL(this.analyzePath, `${this.serverUrl}/`).toString();

  private readServerUrl(): string {
    const rawValue = process.env.NER_SERVER_URL?.trim() || DEFAULT_NER_SERVER_URL;

    let url: URL;

    try {
      url = new URL(rawValue);
    } catch {
      throw new Error('NER_SERVER_URL은 유효한 HTTP(S) URL이어야 합니다.');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('NER_SERVER_URL은 HTTP 또는 HTTPS URL이어야 합니다.');
    }

    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/$/, '');
  }

  private readAnalyzePath(): string {
    const path = process.env.NER_ANALYZE_PATH?.trim() || DEFAULT_NER_ANALYZE_PATH;

    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      throw new Error('NER_ANALYZE_PATH는 /로 시작하는 경로여야 합니다.');
    }

    return path;
  }

  private readTimeout(): number {
    const rawValue = process.env.NER_TIMEOUT_MS;
    const timeout = rawValue === undefined
      ? DEFAULT_NER_TIMEOUT_MS
      : Number(rawValue);

    if (!Number.isInteger(timeout) || timeout <= 0 || timeout > 60_000) {
      throw new Error('NER_TIMEOUT_MS는 1부터 60000 사이의 정수여야 합니다.');
    }

    return timeout;
  }

  private readOptionalApiKey(): string | undefined {
    const apiKey = process.env.NER_API_KEY?.trim();
    return apiKey === undefined || apiKey.length === 0 ? undefined : apiKey;
  }
}
