import type { Client } from 'minio';
import { Readable } from 'node:stream';
import { MinioConfig } from '../../src/global/storage/config/minio.config.js';
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

const ENVIRONMENT_KEYS = [
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_USE_SSL',
  'MINIO_PUBLIC_ENDPOINT',
  'MINIO_PUBLIC_PORT',
  'MINIO_PUBLIC_USE_SSL',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  'MINIO_REGION',
  'MINIO_PRESIGNED_GET_TTL_SECONDS',
] as const;

describe('MinioConfig', () => {
  const originalEnvironment = new Map(
    ENVIRONMENT_KEYS.map((key) => [key, process.env[key]] as const),
  );

  beforeEach(() => {
    process.env.MINIO_ENDPOINT = 'minio';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_USE_SSL = 'false';
    process.env.MINIO_ACCESS_KEY = 'gateway-local';
    process.env.MINIO_SECRET_KEY = 'local-minio-secret-password';
    process.env.MINIO_BUCKET = 'llm-gateway-private';
    process.env.MINIO_REGION = 'us-east-1';
    process.env.MINIO_PRESIGNED_GET_TTL_SECONDS = '600';
    delete process.env.MINIO_PUBLIC_ENDPOINT;
    delete process.env.MINIO_PUBLIC_PORT;
    delete process.env.MINIO_PUBLIC_USE_SSL;
  });

  afterEach(() => {
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('공개 주소가 없으면 내부 MinIO 주소를 서명 URL에도 사용한다', () => {
    const config = new MinioConfig();

    expect(config).toMatchObject({
      endPoint: 'minio',
      port: 9000,
      useSSL: false,
      publicEndPoint: 'minio',
      publicPort: 9000,
      publicUseSSL: false,
    });
  });

  it('Docker 내부 저장 주소와 외부 서명 URL 주소를 분리한다', () => {
    process.env.MINIO_PUBLIC_ENDPOINT = 'localhost';
    process.env.MINIO_PUBLIC_PORT = '19000';
    process.env.MINIO_PUBLIC_USE_SSL = 'true';

    const config = new MinioConfig();

    expect(config).toMatchObject({
      endPoint: 'minio',
      port: 9000,
      useSSL: false,
      publicEndPoint: 'localhost',
      publicPort: 19000,
      publicUseSSL: true,
    });
  });

  it('공개 주소에 프로토콜이나 경로가 포함되면 거부한다', () => {
    process.env.MINIO_PUBLIC_ENDPOINT = 'http://localhost/minio';

    expect(() => new MinioConfig()).toThrow(
      'MINIO_PUBLIC_ENDPOINT는 프로토콜, 포트, 경로를 제외한 호스트여야 합니다.',
    );
  });
});

describe('MinioObjectStorageService', () => {
  it('빈 stream은 크기 0의 객체로 저장한다', async () => {
    const putObject = jest.fn(async (..._args: unknown[]) => ({
      etag: 'empty-etag',
      versionId: null,
    }));
    const internalClient = { putObject } as unknown as Client;
    const config = {
      bucket: 'llm-gateway-private',
      presignedGetTtlSeconds: 600,
    } as MinioConfig;
    const service = new MinioObjectStorageService(
      internalClient,
      {} as Client,
      config,
    );

    await service.putObject({
      objectKey: 'incoming/empty.pdf',
      stream: Readable.from([]),
      contentType: 'application/pdf',
    });

    expect(putObject).toHaveBeenCalledWith(
      'llm-gateway-private',
      'incoming/empty.pdf',
      Buffer.alloc(0),
      0,
      { 'Content-Type': 'application/pdf' },
    );
  });

  it('내용이 있는 stream은 첫 chunk를 유실하지 않고 전달한다', async () => {
    let uploadedBody = Buffer.alloc(0);
    const putObject = jest.fn(async (...args: unknown[]) => {
      const body = args[2];
      const chunks: Buffer[] = [];

      if (!(body instanceof Readable)) {
        throw new Error('내용이 있는 객체는 stream이어야 합니다.');
      }

      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      uploadedBody = Buffer.concat(chunks);
      return { etag: 'stream-etag', versionId: null };
    });
    const internalClient = { putObject } as unknown as Client;
    const config = {
      bucket: 'llm-gateway-private',
      presignedGetTtlSeconds: 600,
    } as MinioConfig;
    const service = new MinioObjectStorageService(
      internalClient,
      {} as Client,
      config,
    );

    await service.putObject({
      objectKey: 'incoming/report.pdf',
      stream: Readable.from([Buffer.from('%PDF-'), Buffer.from('body')]),
      contentType: 'application/pdf',
    });

    expect(uploadedBody).toEqual(Buffer.from('%PDF-body'));
    expect(putObject.mock.calls[0]?.[3]).toBeUndefined();
  });

  it('presigned URL은 공개 주소용 MinIO Client에서 생성한다', async () => {
    const internalClient = {
      presignedGetObject: jest.fn(),
    } as unknown as Client;
    const presignClient = {
      presignedGetObject: jest.fn(async () =>
        'http://localhost:9000/llm-gateway-private/masking/ticket/source'),
    } as unknown as Client;
    const config = {
      bucket: 'llm-gateway-private',
      presignedGetTtlSeconds: 600,
    } as MinioConfig;
    const service = new MinioObjectStorageService(
      internalClient,
      presignClient,
      config,
    );

    await expect(
      service.presignedGetObject('masking/ticket/source'),
    ).resolves.toBe(
      'http://localhost:9000/llm-gateway-private/masking/ticket/source',
    );
    expect(presignClient.presignedGetObject).toHaveBeenCalledWith(
      'llm-gateway-private',
      'masking/ticket/source',
      600,
    );
    expect(internalClient.presignedGetObject).not.toHaveBeenCalled();
  });

  it('객체 키의 각 경로 구간을 인코딩한 만료 없는 S3 URL을 만든다', () => {
    const config = {
      bucket: 'gateway-test',
      presignedGetTtlSeconds: 600,
    } as MinioConfig;
    const service = new MinioObjectStorageService(
      {} as Client,
      {} as Client,
      config,
    );

    expect(service.getObjectUrl('masking/티켓 값/source file.pdf')).toBe(
      's3://gateway-test/masking/%ED%8B%B0%EC%BC%93%20%EA%B0%92/source%20file.pdf',
    );
  });

  it('생성한 canonical S3 URL을 원래 객체 키로 복원한다', () => {
    const config = {
      bucket: 'gateway-test',
      presignedGetTtlSeconds: 600,
    } as MinioConfig;
    const service = new MinioObjectStorageService(
      {} as Client,
      {} as Client,
      config,
    );
    const objectKey = 'masking/티켓 값/source file.pdf';
    const objectUrl = service.getObjectUrl(objectKey);

    expect(service.parseObjectUrl(objectUrl)).toBe(objectKey);
  });

  it.each([
    ['scheme', 'https://gateway-test/masking/ticket/source'],
    ['bucket', 's3://other-bucket/masking/ticket/source'],
    ['malformed percent', 's3://gateway-test/masking/%GG/source'],
    ['encoded slash', 's3://gateway-test/masking%2Fticket/source'],
    ['raw traversal', 's3://gateway-test/masking/../source'],
    ['encoded traversal', 's3://gateway-test/masking/%2E%2E/source'],
    ['query', 's3://gateway-test/masking/ticket/source?download=true'],
    ['fragment', 's3://gateway-test/masking/ticket/source#fragment'],
    ['non-canonical encoding', 's3://gateway-test/masking/ticket/%73ource'],
  ])('canonical 형식이 아닌 객체 URL을 거부한다: %s', (_case, objectUrl) => {
    const config = {
      bucket: 'gateway-test',
      presignedGetTtlSeconds: 600,
    } as MinioConfig;
    const service = new MinioObjectStorageService(
      {} as Client,
      {} as Client,
      config,
    );

    expect(() => service.parseObjectUrl(objectUrl)).toThrow(
      'MinIO 객체 URL이 올바르지 않습니다.',
    );
  });
});
