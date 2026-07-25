import type { Provider } from '@nestjs/common';
import { Client } from 'minio';
import { MinioConfig } from '../config/minio.config.js';

export const MINIO_CLIENT = Symbol('MINIO_CLIENT');
export const MINIO_PRESIGN_CLIENT = Symbol('MINIO_PRESIGN_CLIENT');
export const MINIO_PART_SIZE_BYTES = 5 * 1024 * 1024;

export const MINIO_CLIENT_PROVIDER: Provider<Client> = {
  provide: MINIO_CLIENT,
  inject: [MinioConfig],
  useFactory: (config: MinioConfig): Client => createClient({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    config,
  }),
};

export const MINIO_PRESIGN_CLIENT_PROVIDER: Provider<Client> = {
  provide: MINIO_PRESIGN_CLIENT,
  inject: [MinioConfig],
  useFactory: (config: MinioConfig): Client => createClient({
    endPoint: config.publicEndPoint,
    port: config.publicPort,
    useSSL: config.publicUseSSL,
    config,
  }),
};

interface CreateClientOptions {
  readonly endPoint: string;
  readonly port: number;
  readonly useSSL: boolean;
  readonly config: MinioConfig;
}

function createClient(options: Readonly<CreateClientOptions>): Client {
  return new Client({
    endPoint: options.endPoint,
    port: options.port,
    useSSL: options.useSSL,
    accessKey: options.config.accessKey,
    secretKey: options.config.secretKey,
    region: options.config.region,
    partSize: MINIO_PART_SIZE_BYTES,
    pathStyle: true,
  });
}
