import { Injectable, type PipeTransform } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import type { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptException } from '../exception/prompt.exception.js';

const MAX_JSON_LENGTH = 110_000;
const MAX_MODEL_LENGTH = 100;
const MAX_TEXT_LENGTH = 100_000;
const PRE_PROMPT_FIELDS = ['model', 'text', 'ticket'] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ParsePrePromptJsonPipe
  implements PipeTransform<unknown, PromptReqDTO.PrePrompt>
{
  transform(value: unknown): PromptReqDTO.PrePrompt {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_JSON_LENGTH) {
      this.throwInvalidRequest();
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(value);
    } catch {
      this.throwInvalidRequest();
    }

    if (!this.isRecord(parsed) || !this.hasOnlyExpectedFields(parsed)) {
      this.throwInvalidRequest();
    }

    const { model, text, ticket } = parsed;

    if (
      typeof model !== 'string' ||
      model.trim().length === 0 ||
      model.length > MAX_MODEL_LENGTH ||
      typeof text !== 'string' ||
      text.trim().length === 0 ||
      text.length > MAX_TEXT_LENGTH ||
      typeof ticket !== 'string' ||
      !UUID_PATTERN.test(ticket.trim())
    ) {
      this.throwInvalidRequest();
    }

    return {
      model: model.trim(),
      // 탐지 위치의 인덱스가 달라지지 않도록 원문은 변형하지 않습니다.
      text,
      ticket: ticket.trim(),
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasOnlyExpectedFields(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);

    return (
      keys.length === PRE_PROMPT_FIELDS.length &&
      PRE_PROMPT_FIELDS.every((field) => Object.hasOwn(value, field))
    );
  }

  private throwInvalidRequest(): never {
    throw new PromptException(PromptErrorStatus.INVALID_ANALYZE_REQUEST);
  }
}
