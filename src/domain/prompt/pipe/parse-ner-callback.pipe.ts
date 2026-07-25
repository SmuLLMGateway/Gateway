import { Injectable, type PipeTransform } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import {
  NerCallbackDetectionRequestDTO,
  NerCallbackRequestDTO,
} from '../dto/ner-callback.request.dto.js';
import { PromptException } from '../exception/prompt.exception.js';

const MAX_DETECTION_COUNT = 10_000;
const MAX_MASKING_CONTENT_LENGTH = 255;
const CALLBACK_FIELDS = ['ticket', 'status', 'detections'] as const;
const DETECTION_FIELDS = ['maskingContent'] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseNerCallbackPipe
  implements PipeTransform<unknown, NerCallbackRequestDTO>
{
  transform(value: unknown): NerCallbackRequestDTO {
    if (!this.isRecord(value) || !this.hasExactFields(value, CALLBACK_FIELDS)) {
      this.throwInvalidRequest();
    }

    const { ticket, status, detections } = value;

    if (
      typeof ticket !== 'string' ||
      !UUID_PATTERN.test(ticket.trim()) ||
      (status !== 'DONE' && status !== 'CANCEL') ||
      !Array.isArray(detections) ||
      detections.length > MAX_DETECTION_COUNT ||
      (status === 'CANCEL' && detections.length > 0)
    ) {
      this.throwInvalidRequest();
    }

    return {
      ticket: ticket.trim().toLowerCase(),
      status,
      detections: detections.map((detection) => this.parseDetection(detection)),
    };
  }

  private parseDetection(value: unknown): NerCallbackDetectionRequestDTO {
    if (!this.isRecord(value) || !this.hasExactFields(value, DETECTION_FIELDS)) {
      this.throwInvalidRequest();
    }

    const { maskingContent } = value;

    if (
      typeof maskingContent !== 'string' ||
      maskingContent.trim().length === 0 ||
      maskingContent.length > MAX_MASKING_CONTENT_LENGTH
    ) {
      this.throwInvalidRequest();
    }

    return { maskingContent: maskingContent.trim() };
  }

  private hasExactFields(
    value: Record<string, unknown>,
    fields: readonly string[],
  ): boolean {
    const keys = Object.keys(value);
    return (
      keys.length === fields.length &&
      fields.every((field) => Object.hasOwn(value, field))
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private throwInvalidRequest(): never {
    throw new PromptException(PromptErrorStatus.INVALID_NER_CALLBACK);
  }
}
