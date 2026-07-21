import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyzeTicketConfig {
  readonly processingTtlSeconds = this.readPositiveInteger(
    'ANALYZE_PROCESSING_TTL_SECONDS',
    120,
  );
  readonly resultTtlSeconds = this.readPositiveInteger(
    'ANALYZE_RESULT_TTL_SECONDS',
    86400,
  );
  readonly failedTtlSeconds = this.readPositiveInteger(
    'ANALYZE_FAILED_TTL_SECONDS',
    600,
  );

  private readPositiveInteger(key: string, defaultValue: number): number {
    const rawValue = process.env[key];
    const value = rawValue === undefined || rawValue === ''
      ? defaultValue
      : Number(rawValue);

    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${key}는 양의 정수(초)여야 합니다.`);
    }

    return value;
  }
}
