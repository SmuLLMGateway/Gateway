import { Injectable, type PipeTransform } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptException } from '../exception/prompt.exception.js';

const PROMPT_LIST_QUERY_FIELDS = ['cursor', 'pageSize'] as const;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const UNIX_MILLISECONDS_PATTERN = /^\d+$/;
const MAX_PROMPT_LIST_PAGE_SIZE = 100;

@Injectable()
export class ParsePromptListQueryPipe
  implements PipeTransform<unknown, PromptReqDTO.PromptList>
{
  transform(value: unknown): PromptReqDTO.PromptList {
    if (!this.isRecord(value) || !this.hasAllowedFields(value)) {
      this.throwInvalidRequest();
    }

    const pageSize = this.parsePageSize(value.pageSize);
    const cursor = this.parseCursor(value.cursor);

    return cursor === undefined ? { pageSize } : { cursor, pageSize };
  }

  private hasAllowedFields(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);
    return Object.hasOwn(value, 'pageSize')
      && keys.every((field) =>
        (PROMPT_LIST_QUERY_FIELDS as readonly string[]).includes(field)
      );
  }

  private parsePageSize(value: unknown): number {
    if (typeof value !== 'string') {
      this.throwInvalidRequest();
    }

    const normalized = value.trim();
    if (!POSITIVE_INTEGER_PATTERN.test(normalized)) {
      this.throwInvalidRequest();
    }

    const pageSize = Number(normalized);
    if (
      !Number.isSafeInteger(pageSize)
      || pageSize > MAX_PROMPT_LIST_PAGE_SIZE
    ) {
      this.throwInvalidRequest();
    }

    return pageSize;
  }

  private parseCursor(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      this.throwInvalidRequest();
    }

    const normalized = value.trim();
    // 일부 HTTP 클라이언트는 optional query 값을 생략하지 않고 "null" 문자열로
    // 직렬화합니다. 이 경우도 첫 페이지 조회로 취급합니다.
    if (normalized.toLowerCase() === 'null') {
      return undefined;
    }
    if (!UNIX_MILLISECONDS_PATTERN.test(normalized)) {
      this.throwInvalidRequest();
    }

    const milliseconds = Number(normalized);
    if (
      !Number.isSafeInteger(milliseconds)
      || !Number.isFinite(new Date(milliseconds).getTime())
    ) {
      this.throwInvalidRequest();
    }

    return String(milliseconds);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private throwInvalidRequest(): never {
    throw new PromptException(PromptErrorStatus.INVALID_PROMPT_LIST_REQUEST);
  }
}
