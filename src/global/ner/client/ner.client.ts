import { Injectable } from '@nestjs/common';
import { NerConfig } from '../config/ner.config.js';
import { NerRequestException } from '../exception/ner-request.exception.js';
import type { NerAnalyzeRequest } from '../type/ner-analyze-request.type.js';

@Injectable()
export class NerClient {
  constructor(private readonly config: NerConfig) {}

  /** NER 서버가 요청을 접수할 때까지 기다리고, 분석 결과는 콜백으로 받습니다. */
  async requestAnalyze(request: Readonly<NerAnalyzeRequest>): Promise<void> {
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
  }
}
