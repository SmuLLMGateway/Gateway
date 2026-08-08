import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, Repository } from 'typeorm';
import { MaskingClass } from '../../admin/dao/policy.dao.js';
import { ActiveLlmDAO } from '../../admin/dao/active-llm.dao.js';
import { DepartmentPolicyDAO } from '../../admin/dao/department-policy.dao.js';
import { DepartmentDAO } from '../../admin/dao/department.dao.js';
import { AdminResDTO } from '../../admin/dto/admin.response.dto.js';
import { MemberDepartmentDAO } from '../../user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../user/dao/member-limit.dao.js';
import { GatewayException } from '../../../global/apiPayload/exception/gateway.exception.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { UserRole } from '../../../global/security/type/user-role.enum.js';
import { MinioObjectStorageService } from '../../../global/storage/service/minio-object-storage.service.js';
import { PromptErrorStatus } from '../code/prompt.status.js';
import type { PromptData } from '../data/prompt.data.js';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptException } from '../exception/prompt.exception.js';
import { PromptMapper } from '../mapper/prompt.mapper.js';
import { MaskingReportRepository } from '../repository/masking-report.repository.js';
import { PromptFileRepository } from '../repository/prompt-file.repository.js';
import { PromptLogRepository } from '../repository/prompt-log.repository.js';
import { PromptRoomRepository } from '../repository/prompt-room.repository.js';
import { PromptFileOcrService } from './prompt-file-ocr.service.js';
import {
  MASKING_CONTENT,
  normalizeMaskingContent,
  type DepartmentMaskingPolicy,
  type MaskingContent,
} from '../type/masking-content.type.js';
import { MaskingReportStatus } from '../type/masking-report-status.enum.js';
import type {
  StoredPromptFile,
  StoredPromptFileExtension,
} from '../type/stored-prompt-file.type.js';
import { LlmProvider } from '../../../global/llm/enum/llm-provider.enum.js';
import { ProviderClient } from '../../../global/llm/client/provider.client.js';
import { ApiKeyEncryptionService } from '../../../global/llm/service/api-key-encryption.service.js';
import { NerClient } from '../../../global/ner/client/ner.client.js';
import { NerRequestException } from '../../../global/ner/exception/ner-request.exception.js';
import type {
  NerAnalyzeRequest,
  NerDetection,
  NerExistingDetection,
} from '../../../global/ner/type/ner-analyze-request.type.js';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { MaskingDetailDAO } from '../dao/masking-detail.dao.js';
import { MaskingReportDAO } from '../dao/masking-report.dao.js';
import { PromptLogStatus } from '../type/prompt-log-status.enum.js';
import {
  getSecurityPolicyClassDisplayName,
  getSecurityPolicyDisplayName,
} from '../../admin/policy/security-policy.catalog.js';
import {
  getLlmServiceDescriptor,
  isLocalLlmModelName,
  LOCAL_LLM_MODEL,
  resolveLlmServiceFromModelName,
} from '../../../global/llm/llm-service.mapping.js';
import { toKoreaStandardTimeISOString } from '../../../global/time/korea-standard-time.js';

const MASKING_OBJECT_PREFIX = 'masking';
const MAX_STORED_DETECTION_LENGTH = 255;
const MAX_PROMPT_ROOM_TITLE_LENGTH = 255;
/**
 * LPL NER `/detect` 계약과 서버 구현이 완료될 때까지 마스킹 분석의 NER 분기를
 * 일시 중지합니다. 로컬 NER/LLM 관리·목록·상태 변경 API에는 적용하지 않습니다.
 */
const NER_ANALYSIS_ENABLED = false;
/**
 * NER 연동 재개 전 OCR 동작과 완료 로그를 검증하기 위해 파일 OCR만 일시적으로 실행합니다.
 * NER 요청·NER 상태 전이·NER 결과 저장에는 영향을 주지 않습니다.
 */
const OCR_ANALYSIS_ENABLED = true;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PHONE_PATTERNS = [
  /(?<!\d)01[016789][ .-]?\d{3,4}[ .-]?\d{4}(?!\d)/g,
  /(?<!\d)(?:02[ .-]?\d{3,4}[ .-]?\d{4}|0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4]|70|80)[ .-]?\d{3,4}[ .-]?\d{4})(?!\d)/g,
] as const;

const RESIDENT_REGISTRATION_NUMBER_PATTERN =
  /(?<!\d)\d{6}[ -]?[1-4]\d{6}(?!\d)/g;
const CARD_NUMBER_PATTERNS = [
  /(?<!\d)\d{13,19}(?!\d)/g,
  /(?<!\d)\d{4}([ -])\d{4}\1\d{4}(?:\1\d{1,4})?(?:\1\d{1,3})?(?!\d)/g,
  /(?<!\d)\d{4}([ -])\d{6}\1\d{4,5}(?!\d)/g,
] as const;
const ACCOUNT_NUMBER_PATTERN =
  /(?<!\d)\d{2,6}(?:[ -]\d{2,7}){1,3}(?!\d)/g;
const CONTEXTUAL_ACCOUNT_NUMBER_PATTERN =
  /(?:account(?:\s*number)?|(?:입금|출금)?\s*계좌(?:번호)?|은행\s*계좌)\s*(?:는|은)?\s*(?::|=)?\s*([0-9][0-9 -]{8,20}[0-9])/gi;
const KOREAN_ADDRESS_AREA_SOURCE = String.raw`(?:(?:[가-힣]+(?:특별시|광역시|특별자치시|도)\s+(?:[가-힣]+(?:시|군|구)\s+){0,2})|(?:[가-힣]+(?:시|군|구)\s+){1,2})`;
const KOREAN_ADDRESS_BUILDING_SOURCE =
  String.raw`(?:\s+(?:\d+동|\d+층|\d+호|[가-힣0-9]+(?:아파트|빌딩|타워))){0,3}`;
const KOREAN_ROAD_ADDRESS_PATTERN = new RegExp(
  String.raw`(?<![가-힣0-9])${KOREAN_ADDRESS_AREA_SOURCE}[가-힣0-9]+(?:대로|로|길)(?:\s*\d+번길)?\s+\d+(?:-\d+)?${KOREAN_ADDRESS_BUILDING_SOURCE}(?![0-9-])`,
  'g',
);
const KOREAN_JIBUN_ADDRESS_PATTERN = new RegExp(
  String.raw`(?<![가-힣0-9])${KOREAN_ADDRESS_AREA_SOURCE}[가-힣0-9]+(?:읍|면|동|리|가)\s+\d+(?:-\d+)?${KOREAN_ADDRESS_BUILDING_SOURCE}(?![0-9-])`,
  'g',
);
const EMAIL_PATTERN =
  /(?<![A-Z0-9.!#$%&'*+/=?^_`{|}~-])[A-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?){1,10}(?![A-Z0-9.-])/gi;

const KNOWN_API_KEY_PATTERNS = [
  /(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-|ant-(?:api\d{2}-)?)?[A-Za-z0-9_-]{16,256}(?![A-Za-z0-9_-])/g,
  /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_-])/g,
  /(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/g,
  /(?<![A-Za-z0-9_])(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,128}(?![A-Za-z0-9_])/g,
  /(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{20,255}(?![A-Za-z0-9_])/g,
] as const;

const CONTEXTUAL_API_KEY_PATTERN =
  /\b(?:api[_ -]?key|apikey|client[_ -]?secret|secret[_ -]?key|access[_ -]?token)\b\s{0,8}(?::|=)\s{0,8}["']?([A-Za-z0-9][A-Za-z0-9_./+=-]{14,253}[A-Za-z0-9_=+-])["']?/gi;

interface MaskingDetection {
  readonly maskingContent: MaskingContent;
  readonly targetText: string;
  readonly startIdx: number;
  readonly endIdx: number;
}

interface DetectionCandidate extends MaskingDetection {
  readonly priority: number;
}

interface CandidateOptions {
  readonly maskingContent: MaskingContent;
  readonly priority: number;
  readonly validate?: (value: string) => boolean;
  readonly captureGroup?: number;
}

interface AccessiblePromptModel {
  /** 이력 조회용 분류. 외부 LLM은 active_api_key.service_type입니다. */
  readonly modelType: string;
  /** 실제 Provider 요청에 전달할 세부 모델명입니다. */
  readonly modelName: string;
}

interface PersistedPromptFileForNer {
  readonly objectKey: string;
  readonly fileUrl: string;
  readonly extension: StoredPromptFileExtension;
}

@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MemberDepartmentDAO)
    private readonly memberDepartmentRepository: Repository<MemberDepartmentDAO>,
    @InjectRepository(DepartmentPolicyDAO)
    private readonly departmentPolicyRepository: Repository<DepartmentPolicyDAO>,
    @InjectRepository(ActiveLlmDAO)
    private readonly activeLlmRepository: Repository<ActiveLlmDAO>,
    private readonly maskingReportRepository: MaskingReportRepository,
    private readonly promptFileRepository: PromptFileRepository,
    private readonly promptLogRepository: PromptLogRepository,
    private readonly promptRoomRepository: PromptRoomRepository,
    private readonly objectStorage: MinioObjectStorageService,
    private readonly promptFileOcrService: PromptFileOcrService,
    private readonly providerClient: ProviderClient,
    private readonly apiKeyEncryption: ApiKeyEncryptionService,
    private readonly nerClient: NerClient,
  ) {}

  /** 마스킹 요소 탐지 요청의 전체 비즈니스 흐름을 수행합니다. */
  async requestAnalyze(
    dto: Readonly<PromptReqDTO.PrePrompt>,
    file: StoredPromptFile | undefined,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.AnalyzeRequest> {
    let reportCreated = false;
    let regexCompleted = false;
    let finalObjectKey: string | undefined;
    let finalObjectVersionId: string | undefined;
    let promptFileId: string | undefined;
    let persistedFileForNer: PersistedPromptFileForNer | undefined;
    let promptLogCreated = false;
    let createdChatRoomId: string | undefined;
    let localLplAllowed = false;
    const recentTicket = dto.recentTicket ?? null;
    const requestedChatRoomId = dto.chatRoomId ?? null;

    try {
      const departmentId = await this.resolveDepartmentId(authentication.userId);
      localLplAllowed = await this.isDepartmentLocalLlmEnabled(
        departmentId,
      );
      const accessibleModel = await this.resolveAccessiblePromptModel(
        departmentId,
        dto.llmModel,
      );
      await this.maskingReportRepository.validateRequestTickets(
        dto.ticket,
        recentTicket,
        authentication.userId,
      );
      if (requestedChatRoomId !== null) {
        await this.assertChatRoomAccessible(
          requestedChatRoomId,
          authentication.userId,
        );
      }
      const policies = await this.findSupportedPolicies(departmentId);
      // Gateway는 PRIVATE 정책 중 정규식으로 확정 가능한 항목만 직접 탐지합니다.
      // 그 외 활성 정책은 NER/LLM 분석 재개 시 원문과 함께 전달할 정책 목록에는
      // 남기되, 정규식 후보로는 사용하지 않습니다.
      const regexPolicies = policies.filter(
        (policy) => policy.maskingClass === MaskingClass.PRIVATE,
      );

      const chatRoomId = requestedChatRoomId ?? await this.createInitialChatRoom(
        authentication.userId,
        dto.text,
      );
      if (requestedChatRoomId === null) {
        createdChatRoomId = chatRoomId;
      }
      // NER 탐지가 중지된 동안에는 정규식 탐지 완료만으로 분석을 완료합니다.
      await this.maskingReportRepository.create(
        dto.ticket,
        authentication.userId,
        dto.text,
        recentTicket,
        NER_ANALYSIS_ENABLED && localLplAllowed,
      );
      reportCreated = true;
      await this.promptLogRepository.replaceMasking(
        chatRoomId,
        dto.ticket,
        this.toPromptSummary(dto.text),
        // MASKING 로그의 model_type도 실제 선택한 세부 모델명으로 보존합니다.
        accessibleModel.modelName,
        accessibleModel.modelName,
      );
      promptLogCreated = true;

      if (file !== undefined) {
        finalObjectKey = this.createFinalObjectKey(file);
        const copiedObject = await this.objectStorage.copyObject({
          sourceObjectKey: file.objectKey,
          destinationObjectKey: finalObjectKey,
          sourceVersionId: file.versionId ?? undefined,
        });
        finalObjectVersionId = copiedObject.versionId ?? undefined;
        const fileUrl = this.objectStorage.getObjectUrl(copiedObject.objectKey);
        const promptFile = await this.promptFileRepository.create(
          dto.ticket,
          fileUrl,
          file.originalname,
        );
        promptFileId = promptFile.promptFileId;
        persistedFileForNer = {
          objectKey: copiedObject.objectKey,
          // masking_detail은 prompt_file과 완전히 같은 영구 S3 URL을 참조합니다.
          fileUrl: promptFile.fileUrl,
          extension: file.extension,
        };
      }

      const policyByContent = new Map(
        regexPolicies.map((policy) => [policy.maskingContent, policy] as const),
      );
      const detections = this.detectMaskingElements(
        dto.text,
        new Set(policyByContent.keys()),
      );
      const regexSaved = await this.maskingReportRepository.saveRegexDetections(
        dto.ticket,
        detections.map((detection) => ({
          originalText: detection.targetText,
          startIdx: detection.startIdx,
          endIdx: detection.endIdx,
          maskingText: this.maskDetectedText(detection.maskingContent),
          departmentPolicyId:
            policyByContent.get(detection.maskingContent)!.departmentPolicyId,
        })),
      );

      if (!regexSaved) {
        throw new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
      }
      regexCompleted = true;
      await this.persistMaskedPromptText(dto.ticket, dto.text);

      // NER 서버 개발이 완료되면 NER_ANALYSIS_ENABLED만 true로 전환해
      // 기존 텍스트·OCR 파일 탐지 흐름을 다시 사용합니다.
      if (NER_ANALYSIS_ENABLED && localLplAllowed) {
        const existingDetections = this.toNerExistingDetections(detections);
        void this.requestNerAnalysis({
          ticket: dto.ticket,
          text: dto.text,
          llmModel: accessibleModel.modelName,
          nerDeploymentId: dto.ner ?? null,
          existingDetections,
          policies,
          file: persistedFileForNer,
        }).catch(async (error: unknown) => {
          await this.safeCancelNer(dto.ticket);
          this.logger.error(
            `NER 탐지 요청 실패: ticket=${dto.ticket}`,
            error instanceof Error ? error.stack : undefined,
          );
        });
      } else if (OCR_ANALYSIS_ENABLED && persistedFileForNer !== undefined) {
        // NER 호출 없이 OCR 추출과 prompt_file_ocr_completed 로그만 검증합니다.
        const fileForOcr = persistedFileForNer;
        void this.promptFileOcrService.extractText({
          objectKey: fileForOcr.objectKey,
          extension: fileForOcr.extension,
        }).catch((error: unknown) => {
          this.logger.error(
            `OCR 추출 요청 실패: object_key=${fileForOcr.objectKey} extension=${fileForOcr.extension}`,
            error instanceof Error ? error.stack : undefined,
          );
        });
      }

      return { chatRoomId };
    } catch (error: unknown) {
      if (promptLogCreated) {
        await this.safeDeleteMaskingPromptLog(dto.ticket);
      }
      if (reportCreated) {
        if (!regexCompleted) {
          await this.safeCancelRegex(dto.ticket);
        }
        if (NER_ANALYSIS_ENABLED && localLplAllowed) {
          await this.safeCancelNer(dto.ticket);
        }
      }

      if (finalObjectKey !== undefined) {
        if (promptFileId !== undefined) {
          await this.safeDeletePromptFile(promptFileId);
        }
        await this.safeRemoveObject(finalObjectKey, finalObjectVersionId);
      }

      if (createdChatRoomId !== undefined) {
        await this.safeDeletePromptRoom(
          createdChatRoomId,
          authentication.userId,
        );
      }

      throw this.normalizeRequestError(error);
    }
  }

  async getAnalyze(
    dto: Readonly<PromptReqDTO.Analyze>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<{
    pending: boolean;
    result: PromptResDTO.AnalyzeResult | null;
  }> {
    const report = await this.maskingReportRepository.findAnalyzeResult(
      dto.ticket,
      authentication.userId,
    );
    if (report === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_ANAL_REQ);
    }

    switch (report.status) {
      case MaskingReportStatus.PENDING:
        return { pending: true, result: null };
      case MaskingReportStatus.CANCEL:
        throw new PromptException(
          PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
        );
      case MaskingReportStatus.DONE: {
        const promptFiles = await this.promptFileRepository.findByReportId(
          dto.ticket,
        );
        return {
          pending: false,
          result: PromptMapper.toAnalyzeResult(
            report,
            promptFiles,
          ),
        };
      }
    }
  }

  async cancelAnalyze(
    dto: Readonly<PromptReqDTO.CancelAnalyze>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.Empty> {
    const canceled = await this.maskingReportRepository.cancelForMember(
      dto.ticket,
      authentication.userId,
    );
    if (!canceled) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_ANAL_REQ);
    }

    return null;
  }

  async requestLlm(
    dto: PromptReqDTO.LlmRequest,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.Empty> {
    if (typeof dto.ticket !== 'string' || !UUID_PATTERN.test(dto.ticket.trim())) {
      throw new PromptException(PromptErrorStatus.INVALID_ANALYZE_REQUEST);
    }
    const ticket = dto.ticket.trim().toLowerCase();
    const promptLogRepository = this.dataSource.getRepository(PromptLogDAO);
    const promptLog = await promptLogRepository.findOne({
      relations: { maskingReport: true, promptRoom: true },
      where: { maskingReportId: ticket, promptRoom: { memberId: String(authentication.userId) } },
    });
    if (promptLog === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_ANAL_REQ);
    }
    if (promptLog.maskingReport.status !== MaskingReportStatus.DONE) {
      throw new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
    }
    // 이미 전송을 시작했거나 완료한 ticket은 재전송하지 않습니다.
    if (
      promptLog.status !== PromptLogStatus.MASKING
      && promptLog.status !== PromptLogStatus.ERROR
    ) {
      return null;
    }

    const model = promptLog.modelName ?? promptLog.modelType;
    if (model === null) {
      throw new PromptException(PromptErrorStatus.FORBIDDEN_LLM_MODEL);
    }
    const departmentId = await this.resolveDepartmentId(authentication.userId);

    const localModelName = this.resolveLocalPromptModelName(promptLog);
    if (localModelName !== null) {
      await this.assertDepartmentLocalLlmOutboundAllowed(departmentId);
      const localLlm = await this.activeLlmRepository.findOne({
        select: { activeLlmId: true },
        where: {
          activeApiKey: {
            departmentId,
            serviceType: LOCAL_LLM_MODEL,
          },
          llmDetailModel: { llmName: localModelName },
        },
      });
      if (localLlm === null) {
        this.throwForbiddenModel();
      }
      await this.assertEnabledLocalLlmDeployment(localModelName);

      const maskedText = await this.persistMaskedPromptText(
        ticket,
        promptLog.maskingReport.originalText,
      );
      const reserved = await promptLogRepository.update(
        {
          promptLogId: promptLog.promptLogId,
          status: In([PromptLogStatus.MASKING, PromptLogStatus.ERROR]),
        },
        {
          status: PromptLogStatus.PENDING,
          communicatedAt: new Date(),
          // 로컬 LLM은 LPL에 API 키를 전달하지 않으며 연결 이력에도 남기지 않습니다.
          activeApiKeyId: null,
        },
      );
      if (reserved.affected !== 1) {
        return null;
      }

      // local-* 모델명은 LPL 등록 시 llmDeploymentId와 같은 값으로 저장됩니다.
      void this.sendLocalLlmRequest({
        ticket,
        text: maskedText,
        llmDeploymentId: localModelName,
      }).catch(async (error: unknown) => {
        await this.markLlmRequestFailed(ticket, 'Local');
        this.logger.error(
          `Local LLM 전송 실패: ticket=${ticket}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
      this.schedulePromptSummaryGeneration({
        ticket,
        promptLogId: promptLog.promptLogId,
        departmentId,
        text: maskedText,
        llmDeploymentId: localModelName,
      });
      return null;
    }

    if (
      promptLog.modelType?.trim().toLowerCase() === LOCAL_LLM_MODEL.toLowerCase()
      || isLocalLlmModelName(model)
    ) {
      this.throwForbiddenModel();
    }
    const provider = this.resolveModelProvider(model);
    const activeLlm = await this.activeLlmRepository.findOne({
      relations: { activeApiKey: true, llmDetailModel: true },
      where: {
        activeApiKey: { departmentId, serviceType: provider },
        llmDetailModel: { llmName: model },
      },
    });
    if (activeLlm === null) {
      this.throwForbiddenModel();
    }
    if (activeLlm.activeApiKey.apiKey === null) {
      this.throwForbiddenModel();
    }
    await this.assertExternalLlmOutboundAllowed(departmentId, ticket);
    const maskedText = await this.persistMaskedPromptText(
      ticket,
      promptLog.maskingReport.originalText,
    );
    const reserved = await promptLogRepository.update(
      {
        promptLogId: promptLog.promptLogId,
        status: In([PromptLogStatus.MASKING, PromptLogStatus.ERROR]),
      },
      {
        status: PromptLogStatus.PENDING,
        communicatedAt: new Date(),
        activeApiKeyId: activeLlm.activeApiKeyId,
      },
    );
    if (reserved.affected !== 1) {
      return null;
    }
    const apiKey = this.apiKeyEncryption.decrypt(
      activeLlm.activeApiKey.apiKey,
      departmentId,
      provider,
    );
    void this.sendProviderRequest({
      ticket,
      memberId: String(authentication.userId),
      departmentId,
      activeApiKeyId: activeLlm.activeApiKeyId,
      model,
      text: maskedText,
      apiKey,
    }).catch(async (error: unknown) => {
      await this.markLlmRequestFailed(ticket, 'Provider');
      this.logger.error(`Provider LLM 전송 실패: ticket=${ticket}`, error instanceof Error ? error.stack : undefined);
    });
    this.schedulePromptSummaryGeneration({
      ticket,
      promptLogId: promptLog.promptLogId,
      departmentId,
      text: maskedText,
    });
    return null;
  }

  async getLlmResponse(
    dto: PromptReqDTO.LlmResponse,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<{
    pending: boolean;
    result: PromptResDTO.LlmResponse;
  }> {
    const promptLog = await this.dataSource
      .getRepository(PromptLogDAO)
      .createQueryBuilder('promptLog')
      .innerJoin('promptLog.promptRoom', 'promptRoom')
      .select(['promptLog.promptLogId', 'promptLog.responseText', 'promptLog.status'])
      .where('promptLog.maskingReportId = :ticket', { ticket: dto.ticket })
      .andWhere('promptRoom.memberId = :memberId', {
        memberId: String(authentication.userId),
      })
      .getOne();
    if (promptLog === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_ANAL_REQ);
    }
    if (promptLog.status === PromptLogStatus.ERROR) {
      throw new PromptException(PromptErrorStatus.LLM_REQUEST_FAILED);
    }
    return {
      pending: promptLog.responseText === null,
      result: promptLog.responseText,
    };
  }

  private async sendProviderRequest(data: Readonly<{
    ticket: string; memberId: string; departmentId: string; activeApiKeyId: string;
    model: string; text: string; apiKey: string;
  }>): Promise<void> {
    const fileReferences = await this.promptFileRepository.findByReportId(data.ticket);
    const files = await Promise.all(fileReferences.map(async (file) => ({
      stream: await this.objectStorage.getObject(this.objectStorage.parseObjectUrl(file.fileUrl)),
      fileName: file.fileOriginalName,
    })));
    const response = await this.providerClient.request({
      ticket: data.ticket,
      model: data.model,
      apiKey: data.apiKey,
      text: data.text,
      files,
    });
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(PromptLogDAO).update(
        { maskingReportId: data.ticket, status: PromptLogStatus.PENDING },
        {
          status: PromptLogStatus.DONE,
          responseText: response.outputText,
          usage: String(response.totalUsd),
        },
      );
      await manager.getRepository(MemberLimitDAO).increment(
        { memberId: data.memberId, activeApiKeyId: data.activeApiKeyId },
        'usage',
        response.totalUsd,
      );
      await manager.getRepository(DepartmentDAO).increment(
        { departmentId: data.departmentId }, 'usage', response.totalUsd,
      );
    });
  }

  /** API 키 없이 LPL Provider의 `/generate`로 로컬 LLM 응답을 생성합니다. */
  private async sendLocalLlmRequest(data: Readonly<{
    ticket: string;
    text: string;
    llmDeploymentId: string;
  }>): Promise<void> {
    const response = await this.nerClient.requestLlmGenerate({
      text: data.text,
      llmDeploymentId: data.llmDeploymentId,
    });
    await this.dataSource.getRepository(PromptLogDAO).update(
      { maskingReportId: data.ticket, status: PromptLogStatus.PENDING },
      {
        status: PromptLogStatus.DONE,
        responseText: response.text,
        // usage는 금액 컬럼이므로 API 키가 없는 로컬 LLM에는 저장하지 않습니다.
        usage: null,
        activeApiKeyId: null,
      },
    );
  }

  /**
   * 제목 생성은 본 LLM 응답 전송과 분리합니다. LPL 제목 생성 실패가 LLM 요청
   * 상태를 ERROR로 바꾸지 않도록 하고, 기존 50자 요약값은 그대로 남깁니다.
   */
  private schedulePromptSummaryGeneration(data: Readonly<{
    ticket: string;
    promptLogId: string;
    departmentId: string;
    text: string;
    llmDeploymentId?: string;
  }>): void {
    void this.generatePromptSummary(data).catch((error: unknown) => {
      this.logger.error(
        `LPL 프롬프트 요약 생성 실패: ticket=${data.ticket}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  private async generatePromptSummary(data: Readonly<{
    ticket: string;
    promptLogId: string;
    departmentId: string;
    text: string;
    llmDeploymentId?: string;
  }>): Promise<void> {
    // 부서가 Local LLM 사용을 꺼둔 경우에는 LPL 호출 없이 기존 요약을 보존합니다.
    if (!await this.isDepartmentLocalLlmEnabled(data.departmentId)) {
      return;
    }

    const llmDeploymentId = data.llmDeploymentId
      ?? await this.nerClient.getFirstLlmDeploymentId();
    const { title } = await this.nerClient.requestChatTitle({
      text: data.text,
      llmDeploymentId,
    });
    const updated = await this.promptLogRepository.updatePromptSummary(
      data.promptLogId,
      title,
    );
    if (!updated) {
      this.logger.warn(
        `LPL 프롬프트 요약 저장 대상이 없습니다: ticket=${data.ticket}`,
      );
    }
  }

  private async markLlmRequestFailed(
    ticket: string,
    source: 'Local' | 'Provider',
  ): Promise<void> {
    try {
      await this.dataSource.getRepository(PromptLogDAO).update(
        { maskingReportId: ticket, status: PromptLogStatus.PENDING },
        { status: PromptLogStatus.ERROR },
      );
    } catch (statusUpdateError: unknown) {
      this.logger.error(
        `${source} LLM 실패 상태 기록 실패: ticket=${ticket}`,
        statusUpdateError instanceof Error ? statusUpdateError.stack : undefined,
      );
    }
  }

  /**
   * 저장된 텍스트 탐지 결과를 뒤에서부터 적용해 원문의 인덱스를 보존합니다.
   * 파일 탐지처럼 텍스트 위치나 치환 문자열이 없는 상세 항목은 LLM 본문에 적용하지 않습니다.
   */
  private async toMaskedPromptText(
    ticket: string,
    originalText: string,
  ): Promise<string> {
    const details = await this.dataSource.getRepository(MaskingDetailDAO).find({
      select: {
        originalText: true,
        startIdx: true,
        maskingText: true,
      },
      where: { maskingReportId: ticket },
    });
    const textDetails = details.flatMap((detail) => {
      if (
        detail.originalText === null
        && detail.startIdx === null
        && detail.maskingText === null
      ) {
        return [];
      }
      if (
        typeof detail.originalText !== 'string'
        || typeof detail.startIdx !== 'number'
        || typeof detail.maskingText !== 'string'
      ) {
        throw new PromptException(
          PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
        );
      }
      return [detail];
    }).sort((left, right) => right.startIdx! - left.startIdx!);

    let maskedText = originalText;
    let nextStartIdx = originalText.length;
    for (const detail of textDetails) {
      const targetText = detail.originalText!;
      const maskingText = detail.maskingText!;
      const startIdx = detail.startIdx!;
      const endIdx = startIdx + targetText.length;

      if (
        !Number.isSafeInteger(startIdx)
        || startIdx < 0
        || targetText.length === 0
        || maskingText.length === 0
        || endIdx > originalText.length
        || endIdx > nextStartIdx
        || originalText.slice(startIdx, endIdx) !== targetText
      ) {
        throw new PromptException(
          PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
        );
      }

      maskedText = `${maskedText.slice(0, startIdx)}${maskingText}${maskedText.slice(endIdx)}`;
      nextStartIdx = startIdx;
    }

    return maskedText;
  }

  /** 계산한 본문과 DB 이력을 같은 값으로 맞춰, 이후 상세/이력 조회에서 정확히 복원합니다. */
  private async persistMaskedPromptText(
    ticket: string,
    originalText: string,
  ): Promise<string> {
    const maskingText = await this.toMaskedPromptText(ticket, originalText);
    const updated = await this.maskingReportRepository.updateMaskingText(
      ticket,
      maskingText,
    );
    if (!updated) {
      throw new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
    }

    return maskingText;
  }

  async getRecentPrompts(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.RecentPromptList> {
    const promptRooms = await this.promptRoomRepository.findRecentByMemberId(
      String(authentication.userId),
    );
    return PromptMapper.toRecentPromptList(promptRooms);
  }

  async getModels(
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.ModelList> {
    const departmentId = await this.resolveDepartmentId(authentication.userId);
    const activeLocalLLM = await this.isDepartmentLocalLlmEnabled(
      departmentId,
    );
    const activeLlms = await this.activeLlmRepository.find({
      select: {
        activeApiKey: { serviceType: true },
        llmDetailModel: { llmName: true },
      },
      relations: { activeApiKey: true, llmDetailModel: true },
      where: { activeApiKey: { departmentId } },
      order: { llmDetailModel: { llmName: 'ASC' } },
    });

    const enabledLocalDeploymentIds = activeLocalLLM
      ? await this.getEnabledLocalLlmDeploymentIds()
      : new Set<string>();

    const localModels = activeLlms.flatMap((activeLlm) => {
      const llmName = activeLlm.llmDetailModel.llmName;
      return activeLlm.activeApiKey.serviceType !== LOCAL_LLM_MODEL
        || llmName === null
        || !isLocalLlmModelName(llmName)
        || !enabledLocalDeploymentIds.has(llmName.toLowerCase())
        ? []
        : [llmName];
    });

    const externalModels = activeLlms.flatMap((activeLlm) => {
      const llmName = activeLlm.llmDetailModel.llmName;
      return activeLlm.activeApiKey.serviceType === LOCAL_LLM_MODEL
        || llmName === null
        ? []
        : [llmName];
    });

    return [
      ...[...new Set(localModels)].sort((left, right) => left.localeCompare(right)),
      ...[...new Set(externalModels)]
        .filter((model) => model !== LOCAL_LLM_MODEL && !isLocalLlmModelName(model))
        .sort((left, right) => left.localeCompare(right)),
    ];
  }

  async getNerList(): Promise<PromptResDTO.NerList> {
    try {
      const deployments = await this.nerClient.getNerDeployments();
      return {
        deployments: deployments.map(({ deploymentId, enabled }) => ({
          deploymentId,
          enabled,
        })),
      };
    } catch (error: unknown) {
      if (error instanceof NerRequestException) {
        throw new PromptException(
          PromptErrorStatus.NER_DEPLOYMENT_LIST_UNAVAILABLE,
        );
      }
      throw error;
    }
  }

  async getRecentAnalyze(
    chatRoomId: string,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.RecentAnalyze> {
    const report = await this.maskingReportRepository.findRecentAnalyzeResult(
      chatRoomId,
      authentication.userId,
    );
    if (report === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_RECENT_ANALYZE);
    }

    const promptFiles = await this.promptFileRepository.findByReportId(
      report.ticket,
    );
    return PromptMapper.toRecentAnalyze(report, promptFiles);
  }

  async getPromptList(
    chatRoomId: string,
    dto: Readonly<PromptReqDTO.PromptList>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.PromptList> {
    await this.assertChatRoomAccessible(chatRoomId, authentication.userId);
    const promptLogPage = await this.promptLogRepository.findHistoryPageByPromptRoomId(
      chatRoomId,
      dto.cursor === undefined ? undefined : new Date(Number(dto.cursor)),
      dto.pageSize,
    );
    if (promptLogPage.items.length === 0) {
      return null;
    }

    const data = await Promise.all(promptLogPage.items.map(async (promptLog) => {
      const files = await this.promptFileRepository.findByReportId(
        promptLog.maskingReportId,
      );
      return {
        promptId: promptLog.promptId,
        ticket: promptLog.maskingReportId,
        request: promptLog.request,
        sendText: promptLog.sendText,
        response: promptLog.response,
        file: files.length === 0
          ? null
          : files.map(({ fileUrl, fileOriginalName }) => ({
            fileUrl,
            fileOriginalName,
          })),
      };
    }));

    const lastPromptLog = promptLogPage.items[promptLogPage.items.length - 1]!;
    return {
      data,
      hasNext: promptLogPage.hasNext,
      nextCursor: String(lastPromptLog.communicatedAt.getTime()),
    };
  }

  async getPromptDetail(
    promptId: number,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<AdminResDTO.PromptDetail> {
    const promptLog = await this.dataSource.getRepository(PromptLogDAO).findOne({
      select: {
        promptLogId: true,
        communicatedAt: true,
        usage: true,
        maskingReportId: true,
        promptRoom: {
          memberId: true,
          member: { memberId: true, memberName: true, email: true },
        },
        maskingReport: { originalText: true, maskingText: true, createdAt: true },
      },
      relations: {
        promptRoom: { member: true },
        maskingReport: true,
      },
      where: { promptLogId: String(promptId) },
    });
    if (promptLog === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_PROMPT);
    }

    if (promptLog.promptRoom.memberId !== String(authentication.userId)) {
      throw new PromptException(PromptErrorStatus.FORBIDDEN_PROMPT_DETAIL);
    }

    const [membership, memberLimits, maskingDetails] = await Promise.all([
      this.memberDepartmentRepository.findOne({
        select: {
          departmentId: true,
          department: { departmentName: true },
        },
        relations: { department: true },
        where: { memberId: promptLog.promptRoom.memberId },
        order: { memberDepartmentId: 'ASC' },
      }),
      this.dataSource.getRepository(MemberLimitDAO).find({
        select: { limit: true, usage: true },
        where: { memberId: promptLog.promptRoom.memberId },
      }),
      this.dataSource.getRepository(MaskingDetailDAO).find({
        select: {
          maskingDetailId: true,
          originalText: true,
          startIdx: true,
          maskingText: true,
          departmentPolicy: {
            policy: { maskingContent: true, maskingClass: true },
          },
        },
        relations: { departmentPolicy: { policy: true } },
        where: { maskingReportId: promptLog.maskingReportId },
        order: { maskingDetailId: 'ASC' },
      }),
    ]);
    if (membership === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_PROMPT);
    }

    const detect: AdminResDTO.PromptDetection[] = [];
    for (const detail of maskingDetails) {
      if (
        detail.originalText === null
        || detail.startIdx === null
        || detail.maskingText === null
      ) {
        continue;
      }

      detect.push({
        targetText: detail.originalText,
        startIdx: detail.startIdx,
        endIdx: detail.startIdx + detail.originalText.length - 1,
        maskingCategory: getSecurityPolicyClassDisplayName(
          detail.departmentPolicy.policy.maskingClass,
        ),
        detailCategory: getSecurityPolicyDisplayName(
          detail.departmentPolicy.policy.maskingContent,
        ),
        maskingText: detail.maskingText,
        maskingStartIdx: detail.startIdx,
        maskingEndIdx: detail.startIdx + detail.maskingText.length - 1,
      });
    }

    const { limit } = this.toMemberLimitTotals(memberLimits);
    const usage = Number(promptLog.usage ?? 0);
    return {
      promptId: Number(promptLog.promptLogId),
      ticket: promptLog.maskingReportId,
      name: promptLog.promptRoom.member.memberName,
      department: membership.department.departmentName,
      email: promptLog.promptRoom.member.email,
      limit,
      usage,
      usagePercent: this.toRatioPercent(usage, limit),
      promptedAt: toKoreaStandardTimeISOString(
        promptLog.communicatedAt ?? promptLog.maskingReport.createdAt,
      ),
      detectCnt: maskingDetails.length,
      maskingCnt: detect.length,
      originalText: promptLog.maskingReport.originalText,
      sendText: promptLog.maskingReport.maskingText,
      detect,
    };
  }

  async downloadFile(
    dto: Readonly<PromptReqDTO.FileDownload>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.FileDownload> {
    let requestedObjectKey: string;
    try {
      requestedObjectKey = this.objectStorage.parseObjectUrl(dto.fileUrl);
    } catch {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_FILE);
    }

    const promptFile =
      await this.promptFileRepository.findDownloadReferenceByFileUrl(
        dto.fileUrl,
      );
    if (promptFile === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_FILE);
    }

    if (authentication.role === UserRole.DEPART_ADMIN) {
      const canDownload = await this.canDepartmentAdminDownloadMemberFile(
        authentication.userId,
        promptFile.memberId,
      );
      if (!canDownload) {
        throw new PromptException(PromptErrorStatus.FORBIDDEN_FILE_DOWNLOAD);
      }
    } else if (
      authentication.role !== UserRole.TOTAL_ADMIN
      && promptFile.memberId !== String(authentication.userId)
    ) {
      throw new PromptException(PromptErrorStatus.FORBIDDEN_FILE_DOWNLOAD);
    }

    let storedObjectKey: string;
    try {
      storedObjectKey = this.objectStorage.parseObjectUrl(promptFile.fileUrl);
    } catch {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_FILE);
    }

    if (
      requestedObjectKey !== storedObjectKey
      || !this.isFinalMaskingObjectKey(storedObjectKey)
    ) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_FILE);
    }

    try {
      const url = await this.objectStorage.presignedGetObject(
        storedObjectKey,
        undefined,
        this.toDownloadResponseOptions(
          promptFile.fileOriginalName,
          storedObjectKey,
        ),
      );
      return PromptMapper.toFileDownload(url);
    } catch {
      throw new PromptException(
        PromptErrorStatus.FILE_DOWNLOAD_SERVICE_UNAVAILABLE,
      );
    }
  }

  private toRatioPercent(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }
    return Math.round(((numerator / denominator) * 100) * 10) / 10;
  }

  private toMemberLimitTotals(
    memberLimits: readonly Readonly<Pick<MemberLimitDAO, 'limit' | 'usage'>>[],
  ): { limit: number; usage: number } {
    let totalLimit = 0n;
    let totalUsage = 0n;
    let hasUnlimitedLimit = false;

    for (const memberLimit of memberLimits) {
      const limit = BigInt(memberLimit.limit);
      totalUsage += BigInt(Math.round(Number(memberLimit.usage) * 1_000_000));
      if (limit === 0n) {
        hasUnlimitedLimit = true;
      } else {
        totalLimit += limit;
      }
    }

    return {
      limit: hasUnlimitedLimit ? 0 : Number(totalLimit),
      usage: Number(totalUsage) / 1_000_000,
    };
  }

  private async resolveDepartmentId(memberId: number): Promise<string> {
    if (!Number.isSafeInteger(memberId) || memberId <= 0) {
      this.throwForbiddenModel();
    }

    const membership = await this.memberDepartmentRepository.findOne({
      select: { departmentId: true },
      where: { memberId: String(memberId) },
    });

    if (membership === null) {
      this.throwForbiddenModel();
    }

    return membership.departmentId;
  }

  /** 부서의 Local LLM 사용 허용값은 LPL로 나가는 모든 실행 경로의 전제 조건입니다. */
  private async isDepartmentLocalLlmEnabled(
    departmentId: string,
  ): Promise<boolean> {
    const department = await this.dataSource.getRepository(DepartmentDAO).findOne({
      select: { departmentId: true, activeLocalLLM: true },
      where: { departmentId },
    });
    if (department === null) {
      this.throwForbiddenModel();
    }

    // 마이그레이션 전 단위 테스트/레거시 행은 undefined일 수 있으나 실제 DB의
    // 기본값은 true입니다. 명시적으로 false인 경우에만 LPL 실행을 차단합니다.
    return department.activeLocalLLM !== false;
  }

  private async assertDepartmentLocalLlmOutboundAllowed(
    departmentId: string,
  ): Promise<void> {
    if (!await this.isDepartmentLocalLlmEnabled(departmentId)) {
      this.throwForbiddenModel();
    }
  }

  /**
   * LPL의 enabled 상태를 모델 선택 시점에도 확인합니다. DB active_llm만 남아
   * 있고 LPL 배포가 꺼진 상태라면 클라이언트가 수동으로 local-* 값을 보내도
   * 사용할 수 없습니다.
   */
  private async assertEnabledLocalLlmDeployment(modelName: string): Promise<void> {
    const enabledDeploymentIds = await this.getEnabledLocalLlmDeploymentIds();
    if (!enabledDeploymentIds.has(modelName.trim().toLowerCase())) {
      this.throwForbiddenModel();
    }
  }

  /** 사용자 모델 목록과 local-* 접근 검증 모두 LPL Registry 상태를 기준으로 합니다. */
  private async getEnabledLocalLlmDeploymentIds(): Promise<ReadonlySet<string>> {
    try {
      const deployments = await this.nerClient.getLlmDeployments();
      return new Set(
        deployments
          .filter(({ enabled, deploymentId }) => (
            enabled && isLocalLlmModelName(deploymentId)
          ))
          .map(({ deploymentId }) => deploymentId.trim().toLowerCase()),
      );
    } catch (error: unknown) {
      if (error instanceof NerRequestException) {
        throw new PromptException(
          PromptErrorStatus.LLM_DEPLOYMENT_LIST_UNAVAILABLE,
        );
      }
      throw error;
    }
  }

  /**
   * mustFiltering=true인 부서는 탐지 상세가 하나라도 남아 있으면 외부 Provider로
   * 전송할 수 없습니다. false이면 탐지 여부와 무관하게 외부 전송을 허용합니다.
   */
  private async assertExternalLlmOutboundAllowed(
    departmentId: string,
    ticket: string,
  ): Promise<void> {
    const department = await this.dataSource.getRepository(DepartmentDAO).findOne({
      select: { departmentId: true, mustFiltering: true },
      where: { departmentId },
    });
    // 소속은 확인됐지만 부서가 삭제·변경된 경합 상태라면 외부 전송을 허용하지
    // 않습니다. 보안 설정을 읽지 못한 경우의 기본값은 차단입니다.
    if (department === null) {
      this.throwForbiddenModel();
    }
    if (!department.mustFiltering) {
      return;
    }

    const detection = await this.dataSource.getRepository(MaskingDetailDAO).findOne({
      select: { maskingDetailId: true },
      where: { maskingReportId: ticket },
    });
    if (detection !== null) {
      throw new PromptException(
        PromptErrorStatus.FORBIDDEN_EXTERNAL_LLM_WITH_DETECTIONS,
      );
    }
  }

  /**
   * 부서 관리자는 자기 부서의 일반 사용자(USER) 파일만 받을 수 있습니다.
   * 부서 관리자 본인·다른 부서 사용자·다른 부서 관리자의 파일은 모두 제외합니다.
   */
  private async canDepartmentAdminDownloadMemberFile(
    departmentAdminId: number,
    targetMemberId: string,
  ): Promise<boolean> {
    const [administratorMembership, targetMembership] = await Promise.all([
      this.memberDepartmentRepository.findOne({
        select: { departmentId: true },
        where: { memberId: String(departmentAdminId) },
      }),
      this.memberDepartmentRepository.findOne({
        select: {
          departmentId: true,
          member: { authorize: true },
        },
        relations: { member: true },
        where: { memberId: targetMemberId },
      }),
    ]);

    return administratorMembership !== null
      && targetMembership !== null
      && targetMembership.member.authorize === UserRole.USER
      && administratorMembership.departmentId === targetMembership.departmentId;
  }

  /**
   * 현재 로그는 model_name에 local-* 값을 저장하고, 이전 로그는 model_type에만
   * 저장했을 수 있으므로 두 컬럼을 읽어 호환합니다.
   */
  private resolveLocalPromptModelName(
    promptLog: Pick<PromptLogDAO, 'modelName' | 'modelType'>,
  ): string | null {
    const modelName = promptLog.modelName?.trim();
    if (typeof modelName === 'string' && isLocalLlmModelName(modelName)) {
      return modelName;
    }

    const modelType = promptLog.modelType?.trim();
    return typeof modelType === 'string' && isLocalLlmModelName(modelType)
      ? modelType
      : null;
  }

  private async resolveAccessiblePromptModel(
    departmentId: string,
    model: string,
  ): Promise<AccessiblePromptModel> {
    if (isLocalLlmModelName(model)) {
      const localLlm = await this.activeLlmRepository.findOne({
        select: { activeLlmId: true },
        where: {
          activeApiKey: { departmentId, serviceType: LOCAL_LLM_MODEL },
          llmDetailModel: { llmName: model },
        },
      });
      if (localLlm === null) {
        this.throwForbiddenModel();
      }
      // 부서에서 Local LLM 사용을 꺼도 정규식·파일 보관 분석 자체는 완료할 수
      // 있습니다. 이 경우에는 LPL 상태를 조회하거나 호출하지 않고, 실제 LLM
      // 전송 시점에만 아래의 사용 허용 검증으로 차단합니다.
      if (await this.isDepartmentLocalLlmEnabled(departmentId)) {
        await this.assertEnabledLocalLlmDeployment(model);
      }
      return { modelType: LOCAL_LLM_MODEL, modelName: model };
    }

    const provider = this.resolveModelProvider(model);
    const activeLlm = await this.activeLlmRepository.findOne({
      select: { activeLlmId: true },
      where: {
        activeApiKey: { departmentId, serviceType: provider },
        llmDetailModel: { llmName: model },
      },
    });

    if (activeLlm === null) {
      this.throwForbiddenModel();
    }

    return { modelType: provider, modelName: model };
  }

  private resolveModelProvider(model: string): LlmProvider {
    const service = resolveLlmServiceFromModelName(model);

    if (service === null) {
      this.throwForbiddenModel();
    }

    return getLlmServiceDescriptor(service).provider;
  }

  private async assertChatRoomAccessible(
    chatRoomId: string,
    memberId: number,
  ): Promise<void> {
    const exists = await this.promptRoomRepository.existsByIdAndMemberId(
      chatRoomId,
      String(memberId),
    );
    if (!exists) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_CHAT_ROOM);
    }
  }

  private async createInitialChatRoom(
    memberId: number,
    text: string,
  ): Promise<string> {
    const promptRoomId = randomUUID();
    const now = new Date();
    await this.promptRoomRepository.create({
      promptRoomId,
      startedAt: now,
      lastCommunicatedAt: now,
      promptRoomTitle: this.createPromptRoomTitle(text),
      memberId: String(memberId),
    });

    return promptRoomId;
  }

  private createPromptRoomTitle(text: string): string {
    const normalizedText = text.trim().replace(/\s+/gu, ' ');
    return Array.from(normalizedText)
      .slice(0, MAX_PROMPT_ROOM_TITLE_LENGTH)
      .join('');
  }

  private async findSupportedPolicies(
    departmentId: string,
    maskingClass?: MaskingClass,
    includeInactive = false,
  ): Promise<DepartmentMaskingPolicy[]> {
    const activeCondition = includeInactive ? {} : { isActive: true };
    const where = maskingClass === undefined
      ? { departmentId, ...activeCondition }
      : {
        departmentId,
        ...activeCondition,
        policy: { maskingClass },
      };
    const policies = await this.departmentPolicyRepository.find({
      select: {
        departmentPolicyId: true,
        policy: {
          maskingContent: true,
          maskingClass: true,
        },
      },
      relations: { policy: true },
      where,
      order: { departmentPolicyId: 'ASC' },
    });
    const selectedContents = new Set<MaskingContent>();

    return policies.flatMap((departmentPolicy) => {
      const maskingContent = normalizeMaskingContent(
        departmentPolicy.policy.maskingContent,
      );

      if (maskingContent === null || selectedContents.has(maskingContent)) {
        return [];
      }

      selectedContents.add(maskingContent);
      return [{
        departmentPolicyId: departmentPolicy.departmentPolicyId,
        maskingContent,
        maskingClass: departmentPolicy.policy.maskingClass,
      }];
    });
  }

  /**
   * LPL은 Gateway가 정규식으로 이미 확정한 범위를 다시 반환하지 않으므로,
   * 원문 기준 반열림 인덱스와 실제 문자열을 함께 전달합니다.
   */
  private toNerExistingDetections(
    detections: readonly Readonly<MaskingDetection>[],
  ): NerExistingDetection[] {
    return detections.map((detection) => ({
      start: detection.startIdx,
      end: detection.endIdx,
      text: detection.targetText,
      type: this.toNerDetectionType(detection.maskingContent),
      source: 'regex',
      score: 1,
    }));
  }

  private async requestNerAnalysis(data: Readonly<{
    ticket: string;
    text: string;
    llmModel: string;
    nerDeploymentId: string | null;
    existingDetections: readonly NerExistingDetection[];
    policies: readonly Readonly<DepartmentMaskingPolicy>[];
    file: PersistedPromptFileForNer | undefined;
  }>): Promise<void> {
    const [nerDeploymentId, llmDeploymentId] = await Promise.all([
      data.nerDeploymentId ?? this.nerClient.getFirstNerDeploymentId(),
      this.resolveNerLlmDeploymentId(data.llmModel),
    ]);
    const [textResponse, ocrText] = await Promise.all([
      this.nerClient.requestAnalyze({
        text: data.text,
        nerDeploymentId,
        llmDeploymentId,
        existingDetections: data.existingDetections,
      } satisfies NerAnalyzeRequest),
      data.file === undefined
        ? Promise.resolve(null)
        : this.promptFileOcrService.extractText({
          objectKey: data.file.objectKey,
          extension: data.file.extension,
        }),
    ]);
    const textDetections = this.toNerTextDetections(
      data.text,
      textResponse.detections,
      data.existingDetections,
      data.policies,
    );

    if (data.file === undefined) {
      const saved = await this.maskingReportRepository.saveNerTextDetections(
        data.ticket,
        textDetections,
      );
      if (!saved) {
        // 사용자가 이미 취소한 요청 등, 완료 권한이 사라진 응답은 저장하지 않습니다.
        return;
      }
      await this.persistMaskedPromptText(data.ticket, data.text);
      return;
    }

    const fileOcrText = ocrText ?? '';
    const fileDetections = fileOcrText === ''
      ? []
      : this.toNerFileDetections(
        (await this.nerClient.requestAnalyze({
          text: fileOcrText,
          nerDeploymentId,
          llmDeploymentId,
          existingDetections: [],
        } satisfies NerAnalyzeRequest)).detections,
        data.policies,
      );
    const saved = await this.maskingReportRepository.saveNerTextAndFileDetections(
      data.ticket,
      textDetections,
      data.file.fileUrl,
      fileDetections,
    );
    if (!saved) {
      // 사용자가 이미 취소한 요청 등, 완료 권한이 사라진 응답은 저장하지 않습니다.
      return;
    }
    await this.persistMaskedPromptText(data.ticket, data.text);
  }

  /** 선택한 로컬 모델과 LPL Deployment를 연결할 수 없으면 기존 기본 배포를 사용합니다. */
  private async resolveNerLlmDeploymentId(llmModel: string): Promise<string> {
    if (isLocalLlmModelName(llmModel)) {
      const deploymentId = await this.nerClient
        .getEnabledLlmDeploymentIdByModelName(llmModel);
      if (deploymentId !== null) {
        return deploymentId;
      }
    }

    return this.nerClient.getFirstLlmDeploymentId();
  }

  private toNerTextDetections(
    text: string,
    detections: readonly Readonly<NerDetection>[],
    existingDetections: readonly Readonly<NerExistingDetection>[],
    policies: readonly Readonly<DepartmentMaskingPolicy>[],
  ): PromptData.NerTextDetection[] {
    const policyByContent = new Map(
      policies.map((policy) => [policy.maskingContent, policy] as const),
    );
    const occupiedRanges = existingDetections.map((detection) => ({
      start: detection.start,
      end: detection.end,
    }));

    return detections.flatMap((detection) => {
      const maskingContent = this.toMaskingContentFromNerType(detection.type);
      const policy = maskingContent === null
        ? undefined
        : policyByContent.get(maskingContent);
      // LPL은 탐지 위치만 제시하고 maskingText를 생략할 수 있습니다. 이 경우는
      // 마스킹할 요소가 없는 것으로 취급해 저장하지 않습니다. 현재 부서 정책에
      // 없는 유형도 Gateway가 임의로 기록하지 않고 건너뜁니다.
      if (detection.maskingText === undefined) {
        return [];
      }
      if (policy === undefined) {
        return [];
      }
      if (
        detection.text.length > MAX_STORED_DETECTION_LENGTH
        || detection.maskingText.length > MAX_STORED_DETECTION_LENGTH
        || detection.start < 0
        || detection.end > text.length
        || text.slice(detection.start, detection.end) !== detection.text
      ) {
        throw new Error('NER 탐지 응답의 원문 범위 또는 치환 문자열이 올바르지 않습니다.');
      }
      if (occupiedRanges.some((range) =>
        detection.start < range.end && range.start < detection.end
      )) {
        throw new Error('NER 탐지 응답이 기존 탐지 범위와 겹칩니다.');
      }
      occupiedRanges.push({ start: detection.start, end: detection.end });

      return [{
        originalText: detection.text,
        startIdx: detection.start,
        maskingText: detection.maskingText,
        departmentPolicyId: policy.departmentPolicyId,
      }];
    });
  }

  /** 파일 OCR 응답은 활성 부서 정책에 매핑되는 type만 저장합니다. */
  private toNerFileDetections(
    detections: readonly Readonly<NerDetection>[],
    policies: readonly Readonly<DepartmentMaskingPolicy>[],
  ): PromptData.NerDetection[] {
    const policyByContent = new Map(
      policies.map((policy) => [policy.maskingContent, policy] as const),
    );

    return detections.flatMap((detection) => {
      const maskingContent = this.toMaskingContentFromNerType(detection.type);
      const policy = maskingContent === null
        ? undefined
        : policyByContent.get(maskingContent);

      return policy === undefined
        ? []
        : [{ departmentPolicyId: policy.departmentPolicyId }];
    });
  }

  private toNerDetectionType(maskingContent: MaskingContent): string {
    switch (maskingContent) {
      case MASKING_CONTENT.PHONE:
        return 'PHONE_NUMBER';
      case MASKING_CONTENT.CARD:
        return 'CARD_NUMBER';
      default:
        return maskingContent;
    }
  }

  private toMaskingContentFromNerType(type: string): MaskingContent | null {
    switch (type.trim().toUpperCase().replace(/[\s-]+/g, '_')) {
      case 'PHONE_NUMBER':
        return MASKING_CONTENT.PHONE;
      case 'CARD_NUMBER':
        return MASKING_CONTENT.CARD;
      case 'RESIDENT_REGISTRATION_NUMBER':
        return MASKING_CONTENT.RESIDENT;
      case 'EMAIL_ADDRESS':
        return MASKING_CONTENT.EMAIL;
      default:
        return normalizeMaskingContent(type);
    }
  }

  private detectMaskingElements(
    text: string,
    enabledContents: ReadonlySet<MaskingContent>,
  ): MaskingDetection[] {
    if (text.length === 0) {
      return [];
    }

    const candidates: DetectionCandidate[] = [];

    if (enabledContents.has(MASKING_CONTENT.PHONE)) {
      for (const pattern of PHONE_PATTERNS) {
        candidates.push(...this.findDetectionCandidates(text, pattern, {
          maskingContent: MASKING_CONTENT.PHONE,
          priority: 60,
        }));
      }
    }

    if (enabledContents.has(MASKING_CONTENT.RESIDENT)) {
      candidates.push(...this.findDetectionCandidates(
        text,
        RESIDENT_REGISTRATION_NUMBER_PATTERN,
        {
          maskingContent: MASKING_CONTENT.RESIDENT,
          priority: 90,
          validate: (value) => this.hasValidResidentRegistrationDate(value),
        },
      ));
    }

    if (enabledContents.has(MASKING_CONTENT.CARD)) {
      for (const pattern of CARD_NUMBER_PATTERNS) {
        candidates.push(...this.findDetectionCandidates(text, pattern, {
          maskingContent: MASKING_CONTENT.CARD,
          priority: 80,
          validate: (value) => this.isCardNumberCandidate(value),
        }));
      }
    }

    if (enabledContents.has(MASKING_CONTENT.ACCOUNT)) {
      candidates.push(...this.findDetectionCandidates(
        text,
        ACCOUNT_NUMBER_PATTERN,
        {
          maskingContent: MASKING_CONTENT.ACCOUNT,
          // 전화번호·카드번호와 겹칠 때는 더 구체적인 기존 규칙을 우선합니다.
          priority: 50,
          validate: (value) => this.isAccountNumberCandidate(value),
        },
      ));
      candidates.push(...this.findDetectionCandidates(
        text,
        CONTEXTUAL_ACCOUNT_NUMBER_PATTERN,
        {
          maskingContent: MASKING_CONTENT.ACCOUNT,
          // 계좌 문맥이 명확하면 카드번호처럼 보이는 숫자열보다 우선합니다.
          priority: 85,
          captureGroup: 1,
          validate: (value) => this.isAccountNumberCandidate(value),
        },
      ));
    }

    if (enabledContents.has(MASKING_CONTENT.ADDRESS)) {
      for (const pattern of [
        KOREAN_ROAD_ADDRESS_PATTERN,
        KOREAN_JIBUN_ADDRESS_PATTERN,
      ]) {
        candidates.push(...this.findDetectionCandidates(text, pattern, {
          maskingContent: MASKING_CONTENT.ADDRESS,
          priority: 65,
        }));
      }
    }

    if (enabledContents.has(MASKING_CONTENT.EMAIL)) {
      candidates.push(...this.findDetectionCandidates(text, EMAIL_PATTERN, {
        maskingContent: MASKING_CONTENT.EMAIL,
        priority: 70,
        validate: (value) => this.isValidEmail(value),
      }));
    }

    if (enabledContents.has(MASKING_CONTENT.API_KEY)) {
      for (const pattern of KNOWN_API_KEY_PATTERNS) {
        candidates.push(...this.findDetectionCandidates(text, pattern, {
          maskingContent: MASKING_CONTENT.API_KEY,
          priority: 100,
        }));
      }

      candidates.push(...this.findDetectionCandidates(
        text,
        CONTEXTUAL_API_KEY_PATTERN,
        {
          maskingContent: MASKING_CONTENT.API_KEY,
          priority: 95,
          captureGroup: 1,
          validate: (value) => this.hasSufficientKeyDiversity(value),
        },
      ));
    }

    return this.resolveDetectionOverlaps(candidates).map(
      ({ priority: _priority, ...detection }) => detection,
    );
  }

  private findDetectionCandidates(
    text: string,
    pattern: RegExp,
    options: CandidateOptions,
  ): DetectionCandidate[] {
    const matcher = new RegExp(pattern.source, pattern.flags);
    const detections: DetectionCandidate[] = [];
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(text)) !== null) {
      const fullMatch = match[0];
      const value = options.captureGroup === undefined
        ? fullMatch
        : match[options.captureGroup];

      if (
        value === undefined
        || value.length === 0
        || value.length > MAX_STORED_DETECTION_LENGTH
      ) {
        continue;
      }

      if (options.validate !== undefined && !options.validate(value)) {
        continue;
      }

      const offsetInFullMatch = options.captureGroup === undefined
        ? 0
        : fullMatch.lastIndexOf(value);
      if (offsetInFullMatch < 0) {
        continue;
      }

      const startIdx = match.index + offsetInFullMatch;
      detections.push({
        maskingContent: options.maskingContent,
        targetText: value,
        startIdx,
        endIdx: startIdx + value.length,
        priority: options.priority,
      });
    }

    return detections;
  }

  private hasValidResidentRegistrationDate(value: string): boolean {
    const digits = value.replace(/[ -]/g, '');
    if (digits.length !== 13) {
      return false;
    }

    const centuryCode = Number(digits.charAt(6));
    const century = centuryCode === 1 || centuryCode === 2 ? 1900 : 2000;
    const year = century + Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const day = Number(digits.slice(4, 6));

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  private isCardNumberCandidate(value: string): boolean {
    const digits = value.replace(/[ -]/g, '');

    // 마스킹은 결제 유효성 검사가 아니므로 Luhn 실패도 민감정보 후보로 본다.
    return /^\d{13,19}$/.test(digits) && !/^(\d)\1+$/.test(digits);
  }

  private isAccountNumberCandidate(value: string): boolean {
    const digits = value.replace(/[ -]/g, '');

    return /^\d{10,14}$/.test(digits)
      && !/^(\d)\1+$/.test(digits)
      && !this.isPhoneNumberCandidate(digits)
      && !this.isResidentRegistrationNumberCandidate(value);
  }

  private isPhoneNumberCandidate(digits: string): boolean {
    return /^01[016789]\d{7,8}$/.test(digits)
      || /^02\d{7,8}$/.test(digits)
      || /^0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4]|70|80)\d{7,8}$/.test(digits);
  }

  private isResidentRegistrationNumberCandidate(value: string): boolean {
    return /^\d{6}[ -]?[1-4]\d{6}$/.test(value);
  }

  private isValidEmail(value: string): boolean {
    if (value.length > 254) {
      return false;
    }

    const separatorIndex = value.lastIndexOf('@');
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      return false;
    }

    const localPart = value.slice(0, separatorIndex);
    const domain = value.slice(separatorIndex + 1);
    if (
      localPart.length > 64
      || localPart.startsWith('.')
      || localPart.endsWith('.')
      || localPart.includes('..')
      || domain.length > 253
    ) {
      return false;
    }

    return domain.split('.').every(
      (label) => label.length > 0
        && label.length <= 63
        && !label.startsWith('-')
        && !label.endsWith('-'),
    );
  }

  private hasSufficientKeyDiversity(value: string): boolean {
    const characterGroups = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /\d/.test(value),
      /[_./+=-]/.test(value),
    ].filter(Boolean).length;

    return characterGroups >= 2 && !/^(.)\1+$/.test(value);
  }

  private resolveDetectionOverlaps(
    candidates: readonly DetectionCandidate[],
  ): DetectionCandidate[] {
    const byConfidence = [...candidates].sort((left, right) => {
      const priorityDifference = right.priority - left.priority;
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const lengthDifference =
        (right.endIdx - right.startIdx) - (left.endIdx - left.startIdx);
      if (lengthDifference !== 0) {
        return lengthDifference;
      }

      return left.startIdx - right.startIdx;
    });

    const selected: DetectionCandidate[] = [];
    for (const candidate of byConfidence) {
      const overlaps = selected.some(
        (existing) => candidate.startIdx < existing.endIdx
          && existing.startIdx < candidate.endIdx,
      );

      if (!overlaps) {
        selected.push(candidate);
      }
    }

    return selected.sort((left, right) =>
      left.startIdx - right.startIdx || left.endIdx - right.endIdx,
    );
  }

  private maskDetectedText(maskingContent: MaskingContent): string {
    return `[ ${this.toMaskingLabel(maskingContent)} ]`;
  }

  private toMaskingLabel(maskingContent: MaskingContent): string {
    switch (maskingContent) {
      case MASKING_CONTENT.PHONE:
        return '전화번호';
      case MASKING_CONTENT.RESIDENT:
        return '주민등록번호';
      case MASKING_CONTENT.CARD:
        return '카드번호';
      case MASKING_CONTENT.ACCOUNT:
        return '계좌번호';
      case MASKING_CONTENT.ADDRESS:
        return '주소';
      case MASKING_CONTENT.EMAIL:
        return '이메일';
      case MASKING_CONTENT.API_KEY:
        return 'API 키';
    }
  }

  private createFinalObjectKey(file: StoredPromptFile): string {
    const separatorIndex = file.objectKey.lastIndexOf('/');
    const objectName = file.objectKey.slice(separatorIndex + 1);
    if (!objectName.endsWith(file.extension)) {
      throw new Error('임시 파일 객체 이름이 올바르지 않습니다.');
    }

    const id = objectName.slice(0, -file.extension.length);
    if (!UUID_PATTERN.test(id)) {
      throw new Error('임시 파일 객체 이름이 올바르지 않습니다.');
    }

    return `${MASKING_OBJECT_PREFIX}/${id.toLowerCase()}${file.extension}`;
  }

  private toPromptSummary(text: string): string {
    return text.slice(0, 50);
  }

  private toDownloadResponseOptions(fileOriginalName: string, objectKey: string): {
    contentType: string;
    contentDisposition: string;
  } {
    const extension = objectKey.slice(objectKey.lastIndexOf('.') + 1).toLowerCase();
    const contentType = extension === 'png'
      ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : 'application/pdf';
    const disposition = contentType.startsWith('image/') ? 'inline' : 'attachment';

    return {
      contentType,
      contentDisposition:
        `${disposition}; filename*=UTF-8''${encodeURIComponent(fileOriginalName)}`,
    };
  }

  private isFinalMaskingObjectKey(objectKey: string): boolean {
    const prefix = `${MASKING_OBJECT_PREFIX}/`;
    if (!objectKey.startsWith(prefix)) {
      return false;
    }

    const objectName = objectKey.slice(prefix.length);
    const extension = ['.pdf', '.jpg', '.png'].find((candidate) =>
      objectName.endsWith(candidate)
    );
    if (extension === undefined) {
      return false;
    }

    return UUID_PATTERN.test(objectName.slice(0, -extension.length));
  }

  private async safeCancelRegex(ticket: string): Promise<void> {
    try {
      await this.maskingReportRepository.cancelRegex(ticket);
    } catch {
      // 최초 요청 오류를 유지합니다.
    }
  }

  private async safeCancelNer(ticket: string): Promise<void> {
    try {
      await this.maskingReportRepository.cancelNer(ticket);
    } catch {
      // 최초 요청 오류를 유지합니다.
    }
  }

  private async safeRemoveObject(
    objectKey: string,
    versionId?: string,
  ): Promise<void> {
    try {
      await this.objectStorage.removeObject(objectKey, versionId);
    } catch {
      // private bucket lifecycle이 보상 삭제 실패 객체를 최종 정리합니다.
    }
  }

  private async safeDeletePromptFile(promptFileId: string): Promise<void> {
    try {
      await this.promptFileRepository.deleteById(promptFileId);
    } catch {
      // 최초 요청 오류를 유지합니다.
    }
  }

  private async safeDeleteMaskingPromptLog(ticket: string): Promise<void> {
    try {
      await this.promptLogRepository.deleteByMaskingReportId(ticket);
    } catch {
      // 최초 요청 오류를 유지합니다.
    }
  }

  private async safeDeletePromptRoom(
    chatRoomId: string,
    memberId: number,
  ): Promise<void> {
    try {
      await this.promptRoomRepository.deleteByIdAndMemberId(
        chatRoomId,
        String(memberId),
      );
    } catch {
      // 최초 요청 오류를 유지합니다.
    }
  }

  private throwForbiddenModel(): never {
    throw new PromptException(PromptErrorStatus.FORBIDDEN_LLM_MODEL);
  }

  private normalizeRequestError(error: unknown): GatewayException {
    if (error instanceof GatewayException) {
      return error;
    }

    return new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
  }
}
