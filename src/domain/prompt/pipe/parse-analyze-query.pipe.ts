import { Injectable, type PipeTransform } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptException } from '../exception/prompt.exception.js';

const ANALYZE_QUERY_FIELDS = ['ticket'] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseAnalyzeQueryPipe
  implements PipeTransform<unknown, PromptReqDTO.Analyze>
{
  transform(value: unknown): PromptReqDTO.Analyze {
    if (!this.isRecord(value) || !this.hasExactFields(value)) {
      this.throwInvalidRequest();
    }

    const { ticket } = value;
    if (typeof ticket !== 'string' || !UUID_PATTERN.test(ticket.trim())) {
      this.throwInvalidRequest();
    }

    return { ticket: ticket.trim().toLowerCase() };
  }

  private hasExactFields(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);
    return keys.length === ANALYZE_QUERY_FIELDS.length
      && ANALYZE_QUERY_FIELDS.every((field) => Object.hasOwn(value, field));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private throwInvalidRequest(): never {
    throw new PromptException(PromptErrorStatus.INVALID_ANALYZE_REQUEST);
  }
}
