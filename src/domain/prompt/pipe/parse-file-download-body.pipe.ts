import { Injectable, type PipeTransform } from '@nestjs/common';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptException } from '../exception/prompt.exception.js';

const FILE_DOWNLOAD_BODY_FIELDS = ['fileUrl'] as const;
const MAX_FILE_URL_LENGTH = 1_024;

@Injectable()
export class ParseFileDownloadBodyPipe
  implements PipeTransform<unknown, PromptReqDTO.FileDownload>
{
  transform(value: unknown): PromptReqDTO.FileDownload {
    if (!this.isRecord(value) || !this.hasExactFields(value)) {
      this.throwInvalidRequest();
    }

    const fileUrl = value.fileUrl;
    if (typeof fileUrl !== 'string') {
      this.throwInvalidRequest();
    }

    const normalizedFileUrl = fileUrl.trim();
    if (
      normalizedFileUrl.length === 0
      || normalizedFileUrl.length > MAX_FILE_URL_LENGTH
    ) {
      this.throwInvalidRequest();
    }

    return { fileUrl: normalizedFileUrl };
  }

  private hasExactFields(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);
    return keys.length === FILE_DOWNLOAD_BODY_FIELDS.length
      && FILE_DOWNLOAD_BODY_FIELDS.every((field) =>
        Object.hasOwn(value, field),
      );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private throwInvalidRequest(): never {
    throw new PromptException(
      PromptErrorStatus.INVALID_FILE_DOWNLOAD_REQUEST,
    );
  }
}
