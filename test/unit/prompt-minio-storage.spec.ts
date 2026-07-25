import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { Request } from 'express';
import type {
  PutObjectRequest,
  StoredObjectInfo,
} from '../../src/global/storage/service/minio-object-storage.service.js';
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { PromptMinioStorage } from '../../src/domain/prompt/storage/prompt-minio.storage.js';
import type { StoredPromptFileInfo } from '../../src/domain/prompt/type/stored-prompt-file.type.js';

describe('PromptMinioStorage', () => {
  const fixedUuid = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const expectedObjectKey = `incoming/2026/07/21/${fixedUuid}.pdf`;

  it('Readable을 MinIO로 전달하고 buffer 없는 파일 정보만 반환한다', async () => {
    const uploadedChunks: Buffer[] = [];
    const putObject = jest.fn(async (
      request: Readonly<PutObjectRequest>,
    ): Promise<StoredObjectInfo> => {
      for await (const chunk of request.stream) {
        uploadedChunks.push(Buffer.from(chunk));
      }

      return {
        bucket: 'llm-gateway-private',
        objectKey: request.objectKey,
        etag: 'etag-value',
        versionId: null,
      };
    });
    const removeObject = jest.fn(async () => undefined);
    const removeIncompleteUpload = jest.fn(async () => undefined);
    const storage = createStorage({
      putObject,
      removeObject,
      removeIncompleteUpload,
    });
    const source = Buffer.from('%PDF-1.7\nstreamed document');
    const file = createFile([
      source.subarray(0, 2),
      source.subarray(2, 7),
      source.subarray(7),
    ]);

    const result = await handleFile(storage, file);

    expect(Buffer.concat(uploadedChunks)).toEqual(source);
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(putObject.mock.calls[0]?.[0]).toMatchObject({
      objectKey: expectedObjectKey,
      contentType: 'application/pdf',
    });
    expect(putObject.mock.calls[0]?.[0]?.stream).toBeInstanceOf(Readable);
    expect(result).toEqual({
      storage: 'minio',
      bucket: 'llm-gateway-private',
      objectKey: expectedObjectKey,
      etag: 'etag-value',
      versionId: null,
      sha256: createHash('sha256').update(source).digest('hex'),
      size: source.length,
      contentType: 'application/pdf',
      extension: '.pdf',
    });
    expect(result).not.toHaveProperty('buffer');
    expect(removeIncompleteUpload).not.toHaveBeenCalled();
    expect(removeObject).not.toHaveBeenCalled();
  });

  it('업로드가 실패하면 cleanup 실패와 관계없이 incomplete/object 삭제를 시도한다', async () => {
    const uploadError = new Error('minio unavailable');
    const putObject = jest.fn(async (
      request: Readonly<PutObjectRequest>,
    ): Promise<StoredObjectInfo> => {
      for await (const _chunk of request.stream) {
        // 실제 SDK처럼 stream을 끝까지 소비합니다.
      }

      throw uploadError;
    });
    const removeIncompleteUpload = jest.fn(async () => {
      throw new Error('incomplete cleanup failed');
    });
    const removeObject = jest.fn(async () => {
      throw new Error('object cleanup failed');
    });
    const storage = createStorage({
      putObject,
      removeObject,
      removeIncompleteUpload,
    });

    await expect(handleFile(
      storage,
      createFile([Buffer.from('%PDF-1.7\ncontent')]),
    )).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
    });

    expect(removeIncompleteUpload).toHaveBeenCalledTimes(1);
    expect(removeIncompleteUpload).toHaveBeenCalledWith(expectedObjectKey);
    expect(removeObject).toHaveBeenCalledTimes(1);
    expect(removeObject).toHaveBeenCalledWith(expectedObjectKey, undefined);
  });
});

interface ObjectStorageMocks {
  readonly putObject: jest.Mock;
  readonly removeObject: jest.Mock;
  readonly removeIncompleteUpload: jest.Mock;
}

function createStorage(mocks: ObjectStorageMocks): PromptMinioStorage {
  const objectStorage = {
    putObject: mocks.putObject,
    removeObject: mocks.removeObject,
    removeIncompleteUpload: mocks.removeIncompleteUpload,
  } as unknown as MinioObjectStorageService;

  return new PromptMinioStorage(objectStorage, {
    now: () => new Date('2026-07-21T12:34:56.000Z'),
    randomId: () => 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
  });
}

function createFile(chunks: readonly Buffer[]): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'report.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    stream: Readable.from(chunks),
  } as Express.Multer.File;
}

function handleFile(
  storage: PromptMinioStorage,
  file: Express.Multer.File,
): Promise<StoredPromptFileInfo> {
  const request = new EventEmitter() as unknown as Request;

  return new Promise((resolve, reject) => {
    storage._handleFile(request, file, (error, info) => {
      if (error !== undefined && error !== null) {
        reject(error);
        return;
      }

      resolve(info as unknown as StoredPromptFileInfo);
    });
  });
}
