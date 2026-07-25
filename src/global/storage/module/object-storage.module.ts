import { Module } from '@nestjs/common';
import { MinioConfig } from '../config/minio.config.js';
import {
  MINIO_CLIENT,
  MINIO_CLIENT_PROVIDER,
  MINIO_PRESIGN_CLIENT,
  MINIO_PRESIGN_CLIENT_PROVIDER,
} from '../provider/minio-client.provider.js';
import { MinioObjectStorageService } from '../service/minio-object-storage.service.js';

@Module({
  providers: [
    MinioConfig,
    MINIO_CLIENT_PROVIDER,
    MINIO_PRESIGN_CLIENT_PROVIDER,
    MinioObjectStorageService,
  ],
  exports: [
    MinioConfig,
    MINIO_CLIENT,
    MINIO_PRESIGN_CLIENT,
    MinioObjectStorageService,
  ],
})
export class ObjectStorageModule {}
