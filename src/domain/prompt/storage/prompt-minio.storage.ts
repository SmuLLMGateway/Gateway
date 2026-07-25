import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request } from 'express';
import type multer from 'multer';
import { MinioObjectStorageService } from '../../../global/storage/service/minio-object-storage.service.js';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptException } from '../exception/prompt.exception.js';
import type { StoredPromptFileInfo } from '../type/stored-prompt-file.type.js';
import { PromptFileInspectorTransform } from './prompt-file-inspector.transform.js';

const INCOMING_PREFIX = 'incoming';

export interface PromptMinioStorageOptions {
  readonly now?: () => Date;
  readonly randomId?: () => string;
}

/** Multer file stream을 메모리에 모으지 않고 MinIO로 전달합니다. */
export class PromptMinioStorage implements multer.StorageEngine {
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(
    private readonly objectStorage: MinioObjectStorageService,
    options: PromptMinioStorageOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? randomUUID;
  }

  _handleFile(
    request: Request,
    file: Express.Multer.File,
    callback: (
      error?: unknown,
      info?: Partial<Express.Multer.File>,
    ) => void,
  ): void {
    void this.storeFile(request, file)
      .then((info) => {
        callback(
          undefined,
          info as unknown as Partial<Express.Multer.File>,
        );
      })
      .catch((error: unknown) => callback(error));
  }

  _removeFile(
    _request: Request,
    file: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    const stored = file as Express.Multer.File & Partial<StoredPromptFileInfo>;

    if (typeof stored.objectKey !== 'string' || stored.objectKey.length === 0) {
      callback(null);
      return;
    }

    void this.cleanup(stored.objectKey, stored.versionId ?? undefined)
      .finally(() => callback(null));
  }

  private async storeFile(
    request: Request,
    file: Express.Multer.File,
  ): Promise<StoredPromptFileInfo> {
    const inspector = new PromptFileInspectorTransform(
      file.originalname,
      file.mimetype,
    );
    const objectKey = this.createObjectKey(inspector.extension);
    const uploadStream = new PassThrough();
    const requestAborted = new PromptException(
      PromptErrorStatus.INVALID_FILE_FORM,
    );
    const onRequestAborted = () => file.stream.destroy(requestAborted);
    const onFileLimit = () => file.stream.destroy(
      new PromptException(PromptErrorStatus.INVALID_FILE_FORM),
    );

    request.once('aborted', onRequestAborted);
    file.stream.once('limit', onFileLimit);

    const transferPromise = pipeline(file.stream, inspector, uploadStream);
    const uploadPromise = this.objectStorage.putObject({
      objectKey,
      stream: uploadStream,
      contentType: inspector.contentType,
    });

    try {
      const [stored] = await Promise.all([uploadPromise, transferPromise]);

      return {
        storage: 'minio',
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        etag: stored.etag,
        versionId: stored.versionId,
        sha256: inspector.sha256,
        size: inspector.size,
        contentType: inspector.contentType,
        extension: inspector.extension,
      };
    } catch (error: unknown) {
      file.stream.destroy();
      inspector.destroy();
      uploadStream.destroy();
      await Promise.allSettled([transferPromise, uploadPromise]);
      await this.cleanup(objectKey);
      throw error instanceof PromptException
        ? error
        : new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
    } finally {
      request.off('aborted', onRequestAborted);
      file.stream.off('limit', onFileLimit);
    }
  }

  private createObjectKey(extension: StoredPromptFileInfo['extension']): string {
    const now = this.now();

    if (Number.isNaN(now.getTime())) {
      throw new Error('MinIO object key 생성 시각이 올바르지 않습니다.');
    }

    const year = String(now.getUTCFullYear()).padStart(4, '0');
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const id = this.randomId();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('MinIO object key UUID가 올바르지 않습니다.');
    }

    return `${INCOMING_PREFIX}/${year}/${month}/${day}/${id.toLowerCase()}${extension}`;
  }

  private async cleanup(objectKey: string, versionId?: string): Promise<void> {
    await Promise.allSettled([
      this.objectStorage.removeIncompleteUpload(objectKey),
      this.objectStorage.removeObject(objectKey, versionId),
    ]);
  }
}
