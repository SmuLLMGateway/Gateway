import { Inject, Injectable } from '@nestjs/common';
import {
  Client,
  CopyDestinationOptions,
  CopySourceOptions,
} from 'minio';
import { Readable } from 'node:stream';
import { MinioConfig } from '../config/minio.config.js';
import {
  MINIO_CLIENT,
  MINIO_PRESIGN_CLIENT,
} from '../provider/minio-client.provider.js';

const MAX_OBJECT_KEY_BYTES = 1_024;
const MAX_PRESIGNED_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const USER_METADATA_KEY_PATTERN = /^x-amz-meta-[a-z0-9-]+$/;

export interface PutObjectRequest {
  readonly objectKey: string;
  readonly stream: Readable;
  readonly contentType: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface StoredObjectInfo {
  readonly bucket: string;
  readonly objectKey: string;
  readonly etag: string;
  readonly versionId: string | null;
}

export interface CopyObjectRequest {
  readonly sourceObjectKey: string;
  readonly destinationObjectKey: string;
  readonly sourceVersionId?: string;
}

export interface CopiedObjectInfo {
  readonly bucket: string;
  readonly objectKey: string;
  readonly etag: string | null;
  readonly versionId: string | null;
}

export interface PresignedGetResponseOptions {
  readonly contentType: string;
  readonly contentDisposition: string;
}

/**
 * 비공개 MinIO 버킷에 대한 저장소 I/O만 담당합니다.
 * 버킷 생성이나 public policy 설정 API는 의도적으로 제공하지 않습니다.
 */
@Injectable()
export class MinioObjectStorageService {
  constructor(
    @Inject(MINIO_CLIENT)
    private readonly client: Client,
    @Inject(MINIO_PRESIGN_CLIENT)
    private readonly presignClient: Client,
    private readonly config: MinioConfig,
  ) {}

  get bucket(): string {
    return this.config.bucket;
  }

  /** 설정된 버킷에 요청을 보내 MinIO 연결·인증 상태를 확인합니다. */
  async isHealthy(): Promise<boolean> {
    try {
      return await this.client.bucketExists(this.config.bucket);
    } catch {
      return false;
    }
  }

  /**
   * DB에 장기 보관할 MinIO 객체 위치를 반환합니다.
   * 만료되는 presigned URL은 전송 시점에만 별도로 발급합니다.
   */
  getObjectUrl(objectKey: string): string {
    this.assertObjectKey(objectKey);
    const encodedObjectKey = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `s3://${this.config.bucket}/${encodedObjectKey}`;
  }

  /**
   * getObjectUrl()로 생성해 DB에 저장한 canonical S3 URL을 object key로
   * 복원합니다. 다른 bucket이나 비정규 인코딩을 허용하지 않습니다.
   */
  parseObjectUrl(objectUrl: string): string {
    const prefix = `s3://${this.config.bucket}/`;

    if (
      typeof objectUrl !== 'string'
      || !objectUrl.startsWith(prefix)
      || objectUrl.includes('?')
      || objectUrl.includes('#')
    ) {
      throw new Error('MinIO 객체 URL이 올바르지 않습니다.');
    }

    const encodedObjectKey = objectUrl.slice(prefix.length);
    let objectKey: string;

    try {
      const segments = encodedObjectKey.split('/');

      if (segments.some((segment) => /%2f/i.test(segment))) {
        throw new Error('encoded slash는 허용되지 않습니다.');
      }

      objectKey = segments
        .map((segment) => decodeURIComponent(segment))
        .join('/');
    } catch {
      throw new Error('MinIO 객체 URL이 올바르지 않습니다.');
    }

    try {
      this.assertObjectKey(objectKey);
    } catch {
      throw new Error('MinIO 객체 URL이 올바르지 않습니다.');
    }

    if (this.getObjectUrl(objectKey) !== objectUrl) {
      throw new Error('MinIO 객체 URL이 올바르지 않습니다.');
    }

    return objectKey;
  }

  async putObject(request: Readonly<PutObjectRequest>): Promise<StoredObjectInfo> {
    this.assertObjectKey(request.objectKey);
    const metadata = this.createMetadata(request.contentType, request.metadata);
    const upload = await this.prepareUpload(request.stream);

    // 첫 chunk만 확인해 빈 stream은 size=0 단일 PUT으로 저장합니다.
    // 내용이 있으면 첫 chunk를 다시 붙여 기존 스트리밍 업로드를 유지합니다.
    const uploaded = await this.client.putObject(
      this.config.bucket,
      request.objectKey,
      upload.body,
      upload.size,
      metadata,
    );

    return {
      bucket: this.config.bucket,
      objectKey: request.objectKey,
      etag: uploaded.etag,
      versionId: uploaded.versionId,
    };
  }

  private async prepareUpload(stream: Readable): Promise<{
    readonly body: Readable | Buffer;
    readonly size: number | undefined;
  }> {
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();

    if (first.done === true) {
      return {
        body: Buffer.alloc(0),
        size: 0,
      };
    }

    const body = Readable.from((async function* () {
      yield first.value;

      for await (const chunk of iterator) {
        yield chunk;
      }
    })());

    return {
      body,
      size: undefined,
    };
  }

  async copyObject(request: Readonly<CopyObjectRequest>): Promise<CopiedObjectInfo> {
    this.assertObjectKey(request.sourceObjectKey);
    this.assertObjectKey(request.destinationObjectKey);

    const source = new CopySourceOptions({
      Bucket: this.config.bucket,
      Object: request.sourceObjectKey,
      VersionID: request.sourceVersionId,
    });
    const destination = new CopyDestinationOptions({
      Bucket: this.config.bucket,
      Object: request.destinationObjectKey,
      MetadataDirective: 'COPY',
    });
    const copied = await this.client.copyObject(source, destination);

    return {
      bucket: this.config.bucket,
      objectKey: request.destinationObjectKey,
      etag: 'etag' in copied
        ? copied.etag
        : copied.Etag ?? null,
      versionId: 'VersionId' in copied
        ? copied.VersionId ?? null
        : null,
    };
  }

  async removeObject(objectKey: string, versionId?: string): Promise<void> {
    this.assertObjectKey(objectKey);
    await this.client.removeObject(
      this.config.bucket,
      objectKey,
      versionId === undefined ? undefined : { versionId },
    );
  }

  async getObject(objectKey: string): Promise<Readable> {
    this.assertObjectKey(objectKey);
    return this.client.getObject(this.config.bucket, objectKey);
  }

  async removeIncompleteUpload(objectKey: string): Promise<void> {
    this.assertObjectKey(objectKey);
    await this.client.removeIncompleteUpload(this.config.bucket, objectKey);
  }

  async presignedGetObject(
    objectKey: string,
    expiresSeconds: number = this.config.presignedGetTtlSeconds,
    responseOptions?: Readonly<PresignedGetResponseOptions>,
  ): Promise<string> {
    this.assertObjectKey(objectKey);

    if (
      !Number.isInteger(expiresSeconds)
      || expiresSeconds <= 0
      || expiresSeconds > MAX_PRESIGNED_EXPIRY_SECONDS
    ) {
      throw new Error(
        `presigned GET 만료 시간은 1부터 ${MAX_PRESIGNED_EXPIRY_SECONDS}초 사이여야 합니다.`,
      );
    }

    if (responseOptions === undefined) {
      return this.presignClient.presignedGetObject(
        this.config.bucket,
        objectKey,
        expiresSeconds,
      );
    }

    this.assertHeaderValue('contentType', responseOptions.contentType);
    this.assertHeaderValue(
      'contentDisposition',
      responseOptions.contentDisposition,
    );
    return this.presignClient.presignedGetObject(
      this.config.bucket,
      objectKey,
      expiresSeconds,
      {
        'response-content-type': responseOptions.contentType,
        'response-content-disposition': responseOptions.contentDisposition,
      },
    );
  }

  private createMetadata(
    contentType: string,
    metadata?: Readonly<Record<string, string>>,
  ): Record<string, string> {
    this.assertHeaderValue('contentType', contentType);
    const result: Record<string, string> = {
      'Content-Type': contentType,
    };

    for (const [rawKey, value] of Object.entries(metadata ?? {})) {
      const key = rawKey.toLowerCase();

      // ACL 헤더 주입을 차단하고 사용자 정의 metadata만 허용합니다.
      if (!USER_METADATA_KEY_PATTERN.test(key)) {
        throw new Error(`허용되지 않는 MinIO metadata 키입니다: ${rawKey}`);
      }

      this.assertHeaderValue(rawKey, value);
      result[key] = value;
    }

    return result;
  }

  private assertHeaderValue(name: string, value: string): void {
    if (
      typeof value !== 'string'
      || value.length === 0
      || value.length > 1_024
      || /[\r\n]/.test(value)
    ) {
      throw new Error(`${name} 값이 올바르지 않습니다.`);
    }
  }

  private assertObjectKey(objectKey: string): void {
    if (
      typeof objectKey !== 'string'
      || objectKey.length === 0
      || Buffer.byteLength(objectKey, 'utf8') > MAX_OBJECT_KEY_BYTES
      || objectKey.startsWith('/')
      || objectKey.includes('\\')
      || /[\u0000-\u001f\u007f]/.test(objectKey)
      || objectKey.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new Error('MinIO object key가 올바르지 않습니다.');
    }
  }
}
