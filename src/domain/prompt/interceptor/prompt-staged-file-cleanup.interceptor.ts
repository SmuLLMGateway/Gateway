import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { finalize, type Observable } from 'rxjs';
import { MinioObjectStorageService } from '../../../global/storage/service/minio-object-storage.service.js';
import type { StoredPromptFileInfo } from '../type/stored-prompt-file.type.js';

type RequestWithFile = Request & {
  file?: Express.Multer.File & Partial<StoredPromptFileInfo>;
};

/** 요청 종료 시 incoming 영역에 남은 임시 객체를 보상 삭제합니다. */
@Injectable()
export class PromptStagedFileCleanupInterceptor implements NestInterceptor {
  constructor(
    private readonly objectStorage: MinioObjectStorageService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithFile>();

    return next.handle().pipe(
      finalize(() => {
        void this.removeStagedObject(request.file);
      }),
    );
  }

  private async removeStagedObject(
    file: RequestWithFile['file'],
  ): Promise<void> {
    if (
      file?.storage !== 'minio'
      || typeof file.objectKey !== 'string'
      || !file.objectKey.startsWith('incoming/')
    ) {
      return;
    }

    try {
      await this.objectStorage.removeObject(
        file.objectKey,
        file.versionId ?? undefined,
      );
    } catch {
      // incoming prefix에는 lifecycle 만료 정책을 적용해 orphan을 최종 정리합니다.
    }
  }
}
