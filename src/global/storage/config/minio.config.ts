import { Injectable } from '@nestjs/common';

const DEFAULT_MINIO_PORT = 9000;
const DEFAULT_MINIO_REGION = 'us-east-1';
const DEFAULT_PRESIGNED_GET_TTL_SECONDS = 600;
const MAX_PRESIGNED_GET_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class MinioConfig {
  readonly endPoint = this.readEndpoint('MINIO_ENDPOINT');
  readonly port = this.readPort('MINIO_PORT', DEFAULT_MINIO_PORT);
  readonly useSSL = this.readBoolean('MINIO_USE_SSL', false);
  readonly publicEndPoint = this.readEndpoint(
    'MINIO_PUBLIC_ENDPOINT',
    this.endPoint,
  );
  readonly publicPort = this.readPort('MINIO_PUBLIC_PORT', this.port);
  readonly publicUseSSL = this.readBoolean(
    'MINIO_PUBLIC_USE_SSL',
    this.useSSL,
  );
  readonly accessKey = this.requireEnvironment('MINIO_ACCESS_KEY');
  readonly secretKey = this.requireEnvironment('MINIO_SECRET_KEY', false);
  readonly bucket = this.readBucket();
  readonly region = this.readOptionalEnvironment('MINIO_REGION')
    ?? DEFAULT_MINIO_REGION;
  readonly presignedGetTtlSeconds = this.readPresignedGetTtlSeconds();

  private readEndpoint(key: string, defaultValue?: string): string {
    const endPoint = this.readOptionalEnvironment(key) ?? defaultValue;

    if (endPoint === undefined) {
      throw new Error(`${key} 환경 변수가 필요합니다.`);
    }

    if (
      endPoint.length > 253
      || endPoint.includes('://')
      || /[\s:/@\\?#]/.test(endPoint)
    ) {
      throw new Error(
        `${key}는 프로토콜, 포트, 경로를 제외한 호스트여야 합니다.`,
      );
    }

    return endPoint;
  }

  private readPort(key: string, defaultValue: number): number {
    const value = process.env[key];
    const port = value === undefined || value.trim().length === 0
      ? defaultValue
      : Number(value);

    if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
      throw new Error(`${key}는 1부터 65535 사이의 정수여야 합니다.`);
    }

    return port;
  }

  private readBucket(): string {
    const bucket = this.requireEnvironment('MINIO_BUCKET');

    if (
      bucket.length < 3
      || bucket.length > 63
      || !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucket)
      || bucket.includes('..')
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(bucket)
    ) {
      throw new Error('MINIO_BUCKET은 유효한 비공개 S3 버킷 이름이어야 합니다.');
    }

    return bucket;
  }

  private readPresignedGetTtlSeconds(): number {
    const value = process.env.MINIO_PRESIGNED_GET_TTL_SECONDS;
    const ttlSeconds = value === undefined || value.trim().length === 0
      ? DEFAULT_PRESIGNED_GET_TTL_SECONDS
      : Number(value);

    if (
      !Number.isInteger(ttlSeconds)
      || ttlSeconds <= 0
      || ttlSeconds > MAX_PRESIGNED_GET_TTL_SECONDS
    ) {
      throw new Error(
        `MINIO_PRESIGNED_GET_TTL_SECONDS는 1부터 ${MAX_PRESIGNED_GET_TTL_SECONDS} 사이의 정수여야 합니다.`,
      );
    }

    return ttlSeconds;
  }

  private readBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key]?.trim().toLowerCase();

    if (value === undefined || value.length === 0) {
      return defaultValue;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    throw new Error(`${key}는 true 또는 false여야 합니다.`);
  }

  private requireEnvironment(key: string, trim = true): string {
    const rawValue = process.env[key];

    if (rawValue === undefined || rawValue.length === 0) {
      throw new Error(`${key} 환경 변수가 필요합니다.`);
    }

    const value = trim ? rawValue.trim() : rawValue;

    if (value.length === 0) {
      throw new Error(`${key} 환경 변수가 필요합니다.`);
    }

    return value;
  }

  private readOptionalEnvironment(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value === undefined || value.length === 0 ? undefined : value;
  }
}
