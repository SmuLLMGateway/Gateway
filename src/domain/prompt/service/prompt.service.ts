import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, Raw, Repository } from 'typeorm';
import { MaskingClass } from '../../admin/dao/policy.dao.js';
import { ActiveLlmDAO } from '../../admin/dao/active-llm.dao.js';
import { LlmDetailModelDAO } from '../../admin/dao/llm-detail-model.dao.js';
import { DepartmentPolicyDAO } from '../../admin/dao/department-policy.dao.js';
import { DepartmentDAO } from '../../admin/dao/department.dao.js';
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
import {
  MASKING_CONTENT,
  normalizeMaskingContent,
  type DepartmentMaskingPolicy,
  type MaskingContent,
} from '../type/masking-content.type.js';
import { MaskingReportStatus } from '../type/masking-report-status.enum.js';
import type { StoredPromptFile } from '../type/stored-prompt-file.type.js';
import { LlmProvider } from '../../../global/llm/enum/llm-provider.enum.js';
import { ProviderClient } from '../../../global/llm/client/provider.client.js';
import { ApiKeyEncryptionService } from '../../../global/llm/service/api-key-encryption.service.js';
import { NerClient } from '../../../global/ner/client/ner.client.js';
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
  getLlmServiceDescriptor,
  isLocalLlmModelName,
  LOCAL_LLM_MODEL,
  resolveLlmServiceFromModelName,
} from '../../../global/llm/llm-service.mapping.js';

const MASKING_OBJECT_PREFIX = 'masking';
const MAX_STORED_DETECTION_LENGTH = 255;
const MAX_PROMPT_ROOM_TITLE_LENGTH = 255;
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
    @InjectRepository(LlmDetailModelDAO)
    private readonly llmDetailModelRepository: Repository<LlmDetailModelDAO>,
    private readonly maskingReportRepository: MaskingReportRepository,
    private readonly promptFileRepository: PromptFileRepository,
    private readonly promptLogRepository: PromptLogRepository,
    private readonly promptRoomRepository: PromptRoomRepository,
    private readonly objectStorage: MinioObjectStorageService,
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
    let promptLogCreated = false;
    let createdChatRoomId: string | undefined;
    const recentTicket = dto.recentTicket ?? null;
    const requestedChatRoomId = dto.chatRoomId ?? null;

    try {
      const departmentId = await this.resolveDepartmentId(authentication.userId);
      const accessibleModel = await this.resolveAccessiblePromptModel(
        departmentId,
        dto.model,
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

      const chatRoomId = requestedChatRoomId ?? await this.createInitialChatRoom(
        authentication.userId,
        dto.text,
      );
      if (requestedChatRoomId === null) {
        createdChatRoomId = chatRoomId;
      }
      // NER 응답 전에는 최종 분석 완료가 될 수 없으므로 항상 PENDING으로 생성합니다.
      await this.maskingReportRepository.create(
        dto.ticket,
        authentication.userId,
        dto.text,
        recentTicket,
        true,
      );
      reportCreated = true;
      await this.promptLogRepository.replaceMasking(
        chatRoomId,
        dto.ticket,
        this.toPromptSummary(dto.text),
        accessibleModel.modelType,
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
      }

      const policyByContent = new Map(
        policies.map((policy) => [policy.maskingContent, policy] as const),
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

      const existingDetections = this.toNerExistingDetections(detections);
      void this.requestNerAnalysis({
        ticket: dto.ticket,
        text: dto.text,
        existingDetections,
        policies,
      }).catch(async (error: unknown) => {
        await this.safeCancelNer(dto.ticket);
        this.logger.error(
          `NER 탐지 요청 실패: ticket=${dto.ticket}`,
          error instanceof Error ? error.stack : undefined,
        );
      });

      return { chatRoomId };
    } catch (error: unknown) {
      if (promptLogCreated) {
        await this.safeDeleteMaskingPromptLog(dto.ticket);
      }
      if (reportCreated) {
        if (!regexCompleted) {
          await this.safeCancelRegex(dto.ticket);
        }
        await this.safeCancelNer(dto.ticket);
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
    if (
      model === null
      || promptLog.modelType?.trim().toLowerCase() === LOCAL_LLM_MODEL.toLowerCase()
      || isLocalLlmModelName(model)
    ) {
      throw new PromptException(PromptErrorStatus.FORBIDDEN_LLM_MODEL);
    }
    const departmentId = await this.resolveDepartmentId(authentication.userId);
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
    const maskedText = await this.toMaskedPromptText(
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
      try {
        await this.dataSource.getRepository(PromptLogDAO).update(
          { maskingReportId: ticket, status: PromptLogStatus.PENDING },
          { status: PromptLogStatus.ERROR },
        );
      } catch (statusUpdateError: unknown) {
        this.logger.error(
          `Provider LLM 실패 상태 기록 실패: ticket=${ticket}`,
          statusUpdateError instanceof Error ? statusUpdateError.stack : undefined,
        );
      }
      this.logger.error(`Provider LLM 전송 실패: ticket=${ticket}`, error instanceof Error ? error.stack : undefined);
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
    const [activeLlms, localLlmModels] = await Promise.all([
      this.activeLlmRepository.find({
        select: { llmDetailModel: { llmName: true } },
        relations: { activeApiKey: true, llmDetailModel: true },
        where: { activeApiKey: { departmentId } },
        order: { llmDetailModel: { llmName: 'ASC' } },
      }),
      this.llmDetailModelRepository.find({
        select: { llmName: true },
        where: {
          llmName: Raw(
            (columnAlias) => `LOWER(${columnAlias}) LIKE :localLlmPrefix`,
            { localLlmPrefix: 'local-%' },
          ),
        },
        order: { llmName: 'ASC' },
      }),
    ]);

    const externalModels = activeLlms.flatMap((activeLlm) => {
      const llmName = activeLlm.llmDetailModel.llmName;
      return llmName === null ? [] : [llmName];
    });

    const localModels = localLlmModels.flatMap((model) => (
      model.llmName === null || !isLocalLlmModelName(model.llmName)
        ? []
        : [model.llmName]
    ));

    return [
      ...[...new Set(localModels)].sort((left, right) => left.localeCompare(right)),
      ...[...new Set(externalModels)]
        .filter((model) => model !== LOCAL_LLM_MODEL && !isLocalLlmModelName(model))
        .sort((left, right) => left.localeCompare(right)),
    ];
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
        request: promptLog.request,
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

    const isAdministrator = authentication.role === UserRole.TOTAL_ADMIN
      || authentication.role === UserRole.DEPART_ADMIN;
    if (!isAdministrator && promptFile.memberId !== String(authentication.userId)) {
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

  private async resolveAccessiblePromptModel(
    departmentId: string,
    model: string,
  ): Promise<AccessiblePromptModel> {
    if (isLocalLlmModelName(model)) {
      const localLlm = await this.llmDetailModelRepository.findOne({
        select: { llmDetailModelId: true },
        where: { llmName: model },
      });
      if (localLlm === null) {
        this.throwForbiddenModel();
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
    existingDetections: readonly NerExistingDetection[];
    policies: readonly Readonly<DepartmentMaskingPolicy>[];
  }>): Promise<void> {
    const config = this.nerClient.getDetectionConfiguration();
    const response = await this.nerClient.requestAnalyze({
      text: data.text,
      nerDeploymentId: config.nerDeploymentId,
      llmDeploymentId: config.llmDeploymentId,
      existingDetections: data.existingDetections,
    } satisfies NerAnalyzeRequest);
    const detections = this.toNerTextDetections(
      data.text,
      response.detections,
      data.existingDetections,
      data.policies,
    );
    const saved = await this.maskingReportRepository.saveNerTextDetections(
      data.ticket,
      detections,
    );
    if (!saved) {
      // 사용자가 이미 취소한 요청 등, 완료 권한이 사라진 응답은 저장하지 않습니다.
      return;
    }
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

    return detections.map((detection) => {
      const maskingContent = this.toMaskingContentFromNerType(detection.type);
      const policy = maskingContent === null
        ? undefined
        : policyByContent.get(maskingContent);
      if (policy === undefined) {
        throw new Error(`활성 부서 정책에 매핑할 수 없는 NER 탐지 유형입니다: ${detection.type}`);
      }
      if (detection.maskingText === undefined) {
        throw new Error('NER 탐지 응답에 maskingText가 없습니다.');
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

      return {
        originalText: detection.text,
        startIdx: detection.start,
        maskingText: detection.maskingText,
        departmentPolicyId: policy.departmentPolicyId,
      };
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
