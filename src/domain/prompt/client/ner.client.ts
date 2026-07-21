import { Injectable } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { NerConfig } from '../config/ner.config.js';
import type { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptException } from '../exception/prompt.exception.js';

const RESPONSE_FIELDS = ['fileObjectId', 'maskingCategory', 'detectCnt'] as const;

@Injectable()
export class NerClient {
  constructor(private readonly config: NerConfig) {}

  async analyzeFile(
    file: Express.Multer.File,
    ticket: string,
    idempotencyKey: string = ticket,
  ): Promise<PromptResDTO.MaskingFile> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.config.timeoutMs);

    try {
      const form = new FormData();
      const fileBytes = Uint8Array.from(file.buffer);
      form.append(
        'file',
        new Blob([fileBytes], { type: file.mimetype }),
        this.sanitizeFilename(file.originalname),
      );
      form.append('ticket', ticket);

      const headers: Record<string, string> = {
        'Idempotency-Key': idempotencyKey,
      };

      if (this.config.apiKey !== undefined) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.analyzeUrl, {
        method: 'POST',
        headers,
        body: form,
        signal: abortController.signal,
        redirect: 'error',
      });

      if (!response.ok) {
        this.throwNerServerError();
      }

      const payload: unknown = await response.json();
      return this.parseResponse(payload);
    } catch {
      this.throwNerServerError();
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(payload: unknown): PromptResDTO.MaskingFile {
    if (!this.isRecord(payload) || !this.hasOnlyExpectedFields(payload)) {
      this.throwNerServerError();
    }

    const { fileObjectId, maskingCategory, detectCnt } = payload;

    if (
      typeof fileObjectId !== 'number' ||
      !Number.isSafeInteger(fileObjectId) ||
      fileObjectId <= 0 ||
      typeof maskingCategory !== 'string' ||
      maskingCategory.trim().length === 0 ||
      maskingCategory.length > 100 ||
      typeof detectCnt !== 'number' ||
      !Number.isSafeInteger(detectCnt) ||
      detectCnt < 0
    ) {
      this.throwNerServerError();
    }

    return {
      fileObjectId,
      maskingCategory: maskingCategory.trim(),
      detectCnt,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasOnlyExpectedFields(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);

    return (
      keys.length === RESPONSE_FIELDS.length &&
      RESPONSE_FIELDS.every((field) => Object.hasOwn(value, field))
    );
  }

  private throwNerServerError(): never {
    throw new PromptException(PromptErrorStatus.NER_SERVER_ERROR);
  }

  private sanitizeFilename(originalName: string): string {
    const basename = originalName.split(/[\\/]/).pop() || 'upload';
    const sanitized = basename.replace(/[^0-9A-Za-z._-]/g, '_');
    return sanitized.length === 0 ? 'upload' : sanitized.slice(0, 255);
  }
}
