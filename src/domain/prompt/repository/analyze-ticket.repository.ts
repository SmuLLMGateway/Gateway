import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { RedisService } from '../../../global/redis/service/redis.service.js';
import { AnalyzeTicketConfig } from '../config/analyze-ticket.config.js';
import type { PromptResDTO } from '../dto/prompt.response.dto.js';
import type {
  AnalyzeTicketAcquireResult,
  AnalyzeTicketCompletedRecord,
  AnalyzeTicketFailedRecord,
  AnalyzeTicketRecord,
} from '../type/analyze-ticket.type.js';

const TRANSITION_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 0
end

local decodeSucceeded, current = pcall(cjson.decode, raw)
if not decodeSucceeded then
  return -2
end

if current.status ~= 'PROCESSING'
  or current.operationId ~= ARGV[1]
  or current.fingerprint ~= ARGV[2] then
  return -1
end

redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])
return 1
`;

@Injectable()
export class AnalyzeTicketRepository {
  private static readonly MAX_ACQUIRE_ATTEMPTS = 3;
  private static readonly KEY_PREFIX = 'llm-gateway:v1:idem:analyze';

  constructor(
    private readonly redisService: RedisService,
    private readonly config: AnalyzeTicketConfig,
  ) {}

  createFingerprint(
    model: string,
    text: string,
    fileBuffer?: Buffer,
  ): string {
    const textHash = this.hash(text);
    const fileHash = fileBuffer === undefined
      ? null
      : this.hash(fileBuffer);

    return this.hash(JSON.stringify({
      version: 1,
      model,
      textHash,
      fileHash,
    }));
  }

  async acquire(
    memberId: number,
    ticket: string,
    fingerprint: string,
  ): Promise<AnalyzeTicketAcquireResult> {
    const key = this.createKey(memberId, ticket);

    for (
      let attempt = 0;
      attempt < AnalyzeTicketRepository.MAX_ACQUIRE_ATTEMPTS;
      attempt += 1
    ) {
      const operationId = randomUUID();
      const record: AnalyzeTicketRecord = {
        version: 1,
        status: 'PROCESSING',
        fingerprint,
        operationId,
        createdAt: new Date().toISOString(),
      };

      const acquired = await this.redisService.setIfAbsent(
        key,
        JSON.stringify(record),
        this.config.processingTtlSeconds,
      );

      if (acquired) {
        return { type: 'ACQUIRED', operationId };
      }

      const storedValue = await this.redisService.get(key);

      // SET NX 실패 직후 기존 키가 만료될 수 있으므로 제한적으로 재시도합니다.
      if (storedValue === null) {
        continue;
      }

      const storedRecord = this.parseRecord(storedValue);

      if (storedRecord.fingerprint !== fingerprint) {
        return { type: 'CONFLICT' };
      }

      return { type: 'REPLAY', record: storedRecord };
    }

    throw new Error('분석 티켓을 원자적으로 획득하지 못했습니다.');
  }

  async complete(
    memberId: number,
    ticket: string,
    operationId: string,
    fingerprint: string,
    result: PromptResDTO.Analyze,
  ): Promise<boolean> {
    const record: AnalyzeTicketCompletedRecord = {
      version: 1,
      status: 'COMPLETED',
      fingerprint,
      operationId,
      completedAt: new Date().toISOString(),
      result,
    };

    return this.transition(
      this.createKey(memberId, ticket),
      operationId,
      fingerprint,
      record,
      this.config.resultTtlSeconds,
    );
  }

  async fail(
    memberId: number,
    ticket: string,
    operationId: string,
    fingerprint: string,
    errorCode: string,
  ): Promise<boolean> {
    const record: AnalyzeTicketFailedRecord = {
      version: 1,
      status: 'FAILED',
      fingerprint,
      operationId,
      failedAt: new Date().toISOString(),
      errorCode,
    };

    return this.transition(
      this.createKey(memberId, ticket),
      operationId,
      fingerprint,
      record,
      this.config.failedTtlSeconds,
    );
  }

  private async transition(
    key: string,
    operationId: string,
    fingerprint: string,
    record: AnalyzeTicketRecord,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.redisService.eval(
      TRANSITION_SCRIPT,
      [key],
      [
        operationId,
        fingerprint,
        JSON.stringify(record),
        String(ttlSeconds),
      ],
    );

    return Number(result) === 1;
  }

  private createKey(memberId: number, ticket: string): string {
    const ticketScope = this.hash(`${memberId}:${ticket}`);
    return `${AnalyzeTicketRepository.KEY_PREFIX}:{${ticketScope}}`;
  }

  private hash(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private parseRecord(rawValue: string): AnalyzeTicketRecord {
    let value: unknown;

    try {
      value = JSON.parse(rawValue);
    } catch {
      throw new Error('Redis에 저장된 분석 티켓 형식이 올바르지 않습니다.');
    }

    if (!this.isRecord(value)) {
      throw new Error('Redis에 저장된 분석 티켓 형식이 올바르지 않습니다.');
    }

    return value;
  }

  private isRecord(value: unknown): value is AnalyzeTicketRecord {
    if (!this.isObject(value)
      || value.version !== 1
      || typeof value.fingerprint !== 'string'
      || typeof value.operationId !== 'string'
      || typeof value.status !== 'string') {
      return false;
    }

    switch (value.status) {
      case 'PROCESSING':
        return typeof value.createdAt === 'string';
      case 'COMPLETED':
        return typeof value.completedAt === 'string'
          && this.isAnalyzeResult(value.result);
      case 'FAILED':
        return typeof value.failedAt === 'string'
          && typeof value.errorCode === 'string';
      default:
        return false;
    }
  }

  private isAnalyzeResult(value: unknown): value is PromptResDTO.Analyze {
    if (!this.isObject(value)
      || typeof value.originText !== 'string'
      || !this.isObject(value.masking)
      || !Array.isArray(value.masking.text)) {
      return false;
    }

    const file = value.masking.file;
    const validFile = file === null
      || (this.isObject(file)
        && typeof file.fileObjectId === 'number'
        && typeof file.maskingCategory === 'string'
        && typeof file.detectCnt === 'number');

    return validFile && value.masking.text.every((item) =>
      this.isObject(item)
      && typeof item.targetText === 'string'
      && typeof item.startIdx === 'number'
      && typeof item.endIdx === 'number'
      && typeof item.maskingCategory === 'string'
      && typeof item.detailCategory === 'string',
    );
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
