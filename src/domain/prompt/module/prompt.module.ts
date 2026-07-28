import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveApiKeyDAO } from '../../admin/dao/active-api-key.dao.js';
import { ActiveLlmDAO } from '../../admin/dao/active-llm.dao.js';
import { PolicyDAO } from '../../admin/dao/policy.dao.js';
import { LlmDetailModelDAO } from '../../admin/dao/llm-detail-model.dao.js';
import { DepartmentPolicyDAO } from '../../admin/dao/department-policy.dao.js';
import { MemberDepartmentDAO } from '../../user/dao/member-department.dao.js';
import { ObjectStorageModule } from '../../../global/storage/module/object-storage.module.js';
import { MinioObjectStorageService } from '../../../global/storage/service/minio-object-storage.service.js';
import { NerModule } from '../../../global/ner/module/ner.module.js';
import { NerCallbackController } from '../controller/ner-callback.controller.js';
import { PromptController } from '../controller/prompt.controller.js';
import { MaskingDetailDAO } from '../dao/masking-detail.dao.js';
import { MaskingReportDAO } from '../dao/masking-report.dao.js';
import { PromptFileDAO } from '../dao/prompt-file.dao.js';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { PromptRoomDAO } from '../dao/prompt-room.dao.js';
import { NerCallbackGuard } from '../guard/ner-callback.guard.js';
import { PromptFileExceptionInterceptor } from '../interceptor/prompt-file-exception.interceptor.js';
import { PromptStagedFileCleanupInterceptor } from '../interceptor/prompt-staged-file-cleanup.interceptor.js';
import { PromptMapper } from '../mapper/prompt.mapper.js';
import { ParseNerCallbackPipe } from '../pipe/parse-ner-callback.pipe.js';
import { ParseAnalyzeQueryPipe } from '../pipe/parse-analyze-query.pipe.js';
import { ParseFileDownloadBodyPipe } from '../pipe/parse-file-download-body.pipe.js';
import { ParseOptionalPromptFileFieldPipe } from '../pipe/parse-optional-prompt-file-field.pipe.js';
import { ParsePrePromptJsonPipe } from '../pipe/parse-pre-prompt-json.pipe.js';
import { MaskingReportRepository } from '../repository/masking-report.repository.js';
import { PromptFileRepository } from '../repository/prompt-file.repository.js';
import { PromptLogRepository } from '../repository/prompt-log.repository.js';
import { PromptRoomRepository } from '../repository/prompt-room.repository.js';
import { MaskingPromptLogCleanupService } from '../service/masking-prompt-log-cleanup.service.js';
import { PromptService } from '../service/prompt.service.js';
import { PromptMinioStorage } from '../storage/prompt-minio.storage.js';
import { MAX_PROMPT_FILE_SIZE_BYTES } from '../type/stored-prompt-file.type.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActiveApiKeyDAO,
      ActiveLlmDAO,
      DepartmentPolicyDAO,
      LlmDetailModelDAO,
      MaskingDetailDAO,
      MaskingReportDAO,
      MemberDepartmentDAO,
      PolicyDAO,
      PromptFileDAO,
      PromptLogDAO,
      PromptRoomDAO,
    ]),
    NerModule,
    ObjectStorageModule,
    MulterModule.registerAsync({
      imports: [ObjectStorageModule],
      inject: [MinioObjectStorageService],
      useFactory: (objectStorage: MinioObjectStorageService) => ({
        storage: new PromptMinioStorage(objectStorage),
        limits: {
          fileSize: MAX_PROMPT_FILE_SIZE_BYTES,
          files: 1,
          // json과 `file=` 빈 일반 필드를 함께 허용합니다.
          fields: 2,
          // Busboy가 json+file의 마지막 경계를 처리할 여유를 둡니다.
          parts: 3,
        },
      }),
    }),
  ],
  controllers: [PromptController, NerCallbackController],
  providers: [
    MaskingReportRepository,
    NerCallbackGuard,
    ParseAnalyzeQueryPipe,
    ParseFileDownloadBodyPipe,
    ParseNerCallbackPipe,
    ParseOptionalPromptFileFieldPipe,
    ParsePrePromptJsonPipe,
    PromptFileExceptionInterceptor,
    PromptMapper,
    PromptFileRepository,
    PromptLogRepository,
    PromptRoomRepository,
    PromptService,
    MaskingPromptLogCleanupService,
    PromptStagedFileCleanupInterceptor,
  ],
})
export class PromptModule {}
