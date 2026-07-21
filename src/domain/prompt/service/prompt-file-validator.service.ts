import { Injectable } from '@nestjs/common';
import type {} from 'multer';
import { extname } from 'node:path';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptException } from '../exception/prompt.exception.js';

export const MAX_PROMPT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface AllowedFileType {
  readonly mimeType: string;
  readonly magicBytes: readonly number[];
}

const ALLOWED_FILE_TYPES: Readonly<Record<string, AllowedFileType>> = {
  '.pdf': {
    mimeType: 'application/pdf',
    magicBytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
  },
  '.jpeg': {
    mimeType: 'image/jpeg',
    magicBytes: [0xff, 0xd8, 0xff],
  },
  '.jpg': {
    mimeType: 'image/jpeg',
    magicBytes: [0xff, 0xd8, 0xff],
  },
  '.png': {
    mimeType: 'image/png',
    magicBytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
};

@Injectable()
export class PromptFileValidatorService {
  validate(file?: Express.Multer.File): Express.Multer.File | undefined {
    if (file === undefined) {
      return undefined;
    }

    if (
      typeof file.originalname !== 'string' ||
      typeof file.mimetype !== 'string' ||
      typeof file.size !== 'number' ||
      !Number.isSafeInteger(file.size) ||
      !Buffer.isBuffer(file.buffer)
    ) {
      this.throwInvalidFile();
    }

    const extension = extname(file.originalname).toLowerCase();
    const allowedType = ALLOWED_FILE_TYPES[extension];

    if (
      allowedType === undefined ||
      file.mimetype.toLowerCase() !== allowedType.mimeType ||
      file.size <= 0 ||
      file.size > MAX_PROMPT_FILE_SIZE_BYTES ||
      file.buffer.length <= 0 ||
      file.buffer.length > MAX_PROMPT_FILE_SIZE_BYTES ||
      file.size !== file.buffer.length ||
      !this.startsWith(file.buffer, allowedType.magicBytes)
    ) {
      this.throwInvalidFile();
    }

    return file;
  }

  private startsWith(buffer: Buffer, signature: readonly number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    return signature.every((byte, index) => buffer[index] === byte);
  }

  private throwInvalidFile(): never {
    throw new PromptException(PromptErrorStatus.INVALID_FILE_FORM);
  }
}
