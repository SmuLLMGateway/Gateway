import { Injectable, type PipeTransform } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import type { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptException } from '../exception/prompt.exception.js';

const MAX_JSON_LENGTH = 110_000;
const MAX_MODEL_LENGTH = 100;
const MAX_NER_DEPLOYMENT_ID_LENGTH = 255;
const MAX_TEXT_LENGTH = 65_535;
const MAX_TEXT_BYTES = 65_535;
const PRE_PROMPT_FIELDS = [
  'llmModel',
  'ner',
  'text',
  'ticket',
  'recentTicket',
  'chatRoomId',
] as const;
const REQUIRED_PRE_PROMPT_FIELDS = ['llmModel', 'text', 'ticket'] as const;
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

    const { llmModel, ner, text, ticket, recentTicket, chatRoomId } = parsed;

    if (
      typeof llmModel !== 'string' ||
      llmModel.trim().length === 0 ||
      llmModel.length > MAX_MODEL_LENGTH ||
      (ner !== undefined && ner !== null && (
        typeof ner !== 'string'
        || ner.trim().length === 0
        || ner.length > MAX_NER_DEPLOYMENT_ID_LENGTH
        || /[\r\n]/.test(ner)
      )) ||
      typeof text !== 'string' ||
      text.trim().length === 0 ||
      text.length > MAX_TEXT_LENGTH ||
      Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES ||
      typeof ticket !== 'string' ||
      !UUID_PATTERN.test(ticket.trim()) ||
      (recentTicket !== undefined && recentTicket !== null && (
        typeof recentTicket !== 'string'
        || !UUID_PATTERN.test(recentTicket.trim())
      )) ||
      (chatRoomId !== undefined && chatRoomId !== null && (
        typeof chatRoomId !== 'string'
        || !UUID_PATTERN.test(chatRoomId.trim())
      ))
    ) {
      this.throwInvalidRequest();
    }

    return {
      llmModel: llmModel.trim(),
      ner: ner === undefined || ner === null ? null : ner.trim(),
      // 탐지 위치의 인덱스가 달라지지 않도록 원문은 변형하지 않습니다.
      text,
      ticket: ticket.trim().toLowerCase(),
      recentTicket: recentTicket === undefined || recentTicket === null
        ? null
        : recentTicket.trim().toLowerCase(),
      chatRoomId: chatRoomId === undefined || chatRoomId === null
        ? null
        : chatRoomId.trim().toLowerCase(),
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasOnlyExpectedFields(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);

    return (
      keys.every((field) => PRE_PROMPT_FIELDS.includes(
        field as (typeof PRE_PROMPT_FIELDS)[number],
      ))
      && REQUIRED_PRE_PROMPT_FIELDS.every((field) => Object.hasOwn(value, field))
    );
  }

  private throwInvalidRequest(): never {
    throw new PromptException(PromptErrorStatus.INVALID_ANALYZE_REQUEST);
  }
}
