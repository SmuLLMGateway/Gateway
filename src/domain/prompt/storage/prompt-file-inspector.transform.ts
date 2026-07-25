import { createHash, type Hash } from 'node:crypto';
import { extname } from 'node:path';
import {
  Transform,
  type TransformCallback,
  type TransformOptions,
} from 'node:stream';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptException } from '../exception/prompt.exception.js';
import {
  MAX_PROMPT_FILE_SIZE_BYTES,
  type StoredPromptFileExtension,
} from '../type/stored-prompt-file.type.js';

interface AllowedPromptFileType {
  readonly contentType: string;
  readonly magicBytes: Buffer;
  readonly canonicalExtension: StoredPromptFileExtension;
}

const ALLOWED_PROMPT_FILE_TYPES: Readonly<Record<string, AllowedPromptFileType>> = {
  '.pdf': {
    contentType: 'application/pdf',
    magicBytes: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    canonicalExtension: '.pdf',
  },
  '.jpeg': {
    contentType: 'image/jpeg',
    magicBytes: Buffer.from([0xff, 0xd8, 0xff]),
    canonicalExtension: '.jpg',
  },
  '.jpg': {
    contentType: 'image/jpeg',
    magicBytes: Buffer.from([0xff, 0xd8, 0xff]),
    canonicalExtension: '.jpg',
  },
  '.png': {
    contentType: 'image/png',
    magicBytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    canonicalExtension: '.png',
  },
};

/**
 * 파일 전체를 보관하지 않고 signature 길이만큼만 보류한 뒤 검증하며,
 * 통과한 byte를 그대로 다음 stream으로 전달합니다.
 */
export class PromptFileInspectorTransform extends Transform {
  readonly contentType: string;
  readonly extension: StoredPromptFileExtension;

  private readonly allowedType: AllowedPromptFileType;
  private readonly mimeTypeMatches: boolean;
  private readonly hash: Hash = createHash('sha256');
  private header = Buffer.alloc(0);
  private inspectedSize = 0;
  private digest: string | undefined;
  private signatureValidated = false;

  constructor(
    originalName: string,
    mimeType: string,
    options?: TransformOptions,
  ) {
    super(options);

    if (typeof originalName !== 'string' || typeof mimeType !== 'string') {
      throw this.invalidFile();
    }

    const extension = extname(originalName).toLowerCase();
    const allowedType = ALLOWED_PROMPT_FILE_TYPES[extension];

    if (allowedType === undefined) {
      throw this.invalidFile();
    }

    this.allowedType = allowedType;
    this.mimeTypeMatches = mimeType.toLowerCase() === allowedType.contentType;
    this.contentType = allowedType.contentType;
    this.extension = allowedType.canonicalExtension;
  }

  get size(): number {
    return this.inspectedSize;
  }

  get sha256(): string {
    if (this.digest === undefined) {
      throw new Error('파일 stream 검증이 아직 완료되지 않았습니다.');
    }

    return this.digest;
  }

  override _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);

    if (buffer.length === 0) {
      callback();
      return;
    }

    if (!this.mimeTypeMatches) {
      callback(this.invalidFile());
      return;
    }

    const nextSize = this.inspectedSize + buffer.length;

    if (
      !Number.isSafeInteger(nextSize)
      || nextSize > MAX_PROMPT_FILE_SIZE_BYTES
    ) {
      callback(this.invalidFile());
      return;
    }

    this.inspectedSize = nextSize;
    this.hash.update(buffer);

    if (this.signatureValidated) {
      this.push(buffer);
      callback();
      return;
    }

    const required = this.allowedType.magicBytes.length - this.header.length;
    const headerEnd = Math.min(required, buffer.length);
    this.header = Buffer.concat(
      [this.header, buffer.subarray(0, headerEnd)],
      this.header.length + headerEnd,
    );

    if (this.header.length < this.allowedType.magicBytes.length) {
      callback();
      return;
    }

    if (!this.header.equals(this.allowedType.magicBytes)) {
      callback(this.invalidFile());
      return;
    }

    this.signatureValidated = true;
    this.push(this.header);
    this.header = Buffer.alloc(0);

    if (headerEnd < buffer.length) {
      this.push(buffer.subarray(headerEnd));
    }

    callback();
  }

  override _flush(callback: TransformCallback): void {
    if (this.inspectedSize === 0) {
      this.digest = this.hash.digest('hex');
      callback();
      return;
    }

    if (
      !this.signatureValidated
      || this.digest !== undefined
    ) {
      callback(this.invalidFile());
      return;
    }

    this.digest = this.hash.digest('hex');
    callback();
  }

  private invalidFile(): PromptException {
    return new PromptException(PromptErrorStatus.INVALID_FILE_FORM);
  }
}
