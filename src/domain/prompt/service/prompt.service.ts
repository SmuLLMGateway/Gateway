import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../admin/dao/active-api-key.dao.js';
import { PolicyDAO } from '../../admin/dao/policy.dao.js';
import { LlmDetailModelDAO } from '../../admin/dao/llm-detail-model.dao.js';
import { MemberDepartmentDAO } from '../../user/dao/member-department.dao.js';
import { GatewayException } from '../../../global/apiPayload/exception/gateway.exception.js';
import { NerRequestException } from '../../../global/ner/exception/ner-request.exception.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { MinioObjectStorageService } from '../../../global/storage/service/minio-object-storage.service.js';
import { NerClient } from '../../../global/ner/client/ner.client.js';
import { PromptErrorStatus } from '../code/prompt.status.js';
import type { NerCallbackRequestDTO } from '../dto/ner-callback.request.dto.js';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptException } from '../exception/prompt.exception.js';
import { PromptMapper } from '../mapper/prompt.mapper.js';
import { MaskingReportRepository } from '../repository/masking-report.repository.js';
import { PromptFileRepository } from '../repository/prompt-file.repository.js';
import { PromptRoomRepository } from '../repository/prompt-room.repository.js';
import {
  MASKING_CONTENT,
  normalizeMaskingContent,
  type DepartmentMaskingPolicy,
  type MaskingContent,
} from '../type/masking-content.type.js';
import { MaskingReportStatus } from '../type/masking-report-status.enum.js';
import type { StoredPromptFile } from '../type/stored-prompt-file.type.js';

const MASKING_OBJECT_PREFIX = 'masking';
const MAX_STORED_DETECTION_LENGTH = 255;

const LLM_PROVIDER = {
  CLAUDE: 'Claude',
  GPT: 'GPT',
  GEMINI: 'Gemini',
} as const;

type LlmProvider = (typeof LLM_PROVIDER)[keyof typeof LLM_PROVIDER];

const MODEL_PREFIXES: ReadonlyArray<{
  readonly provider: LlmProvider;
  readonly pattern: RegExp;
}> = [
  { provider: LLM_PROVIDER.CLAUDE, pattern: /^Claude(?=$|[\s-])/ },
  { provider: LLM_PROVIDER.GPT, pattern: /^GPT(?=$|[\s-])/ },
  { provider: LLM_PROVIDER.GEMINI, pattern: /^Gemini(?=$|[\s-])/ },
];

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

@Injectable()
export class PromptService {
  constructor(
    @InjectRepository(MemberDepartmentDAO)
    private readonly memberDepartmentRepository: Repository<MemberDepartmentDAO>,
    @InjectRepository(ActiveApiKeyDAO)
    private readonly activeApiKeyRepository: Repository<ActiveApiKeyDAO>,
    @InjectRepository(PolicyDAO)
    private readonly policyRepository: Repository<PolicyDAO>,
    @InjectRepository(LlmDetailModelDAO)
    private readonly llmDetailModelRepository: Repository<LlmDetailModelDAO>,
    private readonly maskingReportRepository: MaskingReportRepository,
    private readonly promptFileRepository: PromptFileRepository,
    private readonly promptRoomRepository: PromptRoomRepository,
    private readonly objectStorage: MinioObjectStorageService,
    private readonly nerClient: NerClient,
  ) {}

  /** 마스킹 요소 탐지 요청의 전체 비즈니스 흐름을 수행합니다. */
  async requestAnalyze(
    dto: Readonly<PromptReqDTO.PrePrompt>,
    file: StoredPromptFile | undefined,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<PromptResDTO.Empty> {
    let reportCreated = false;
    let regexCompleted = false;
    let finalObjectKey: string | undefined;
    let finalObjectVersionId: string | undefined;
    let promptFileId: string | undefined;

    try {
      const departmentId = await this.resolveDepartmentId(authentication.userId);
      await this.assertModelAccessible(departmentId, dto.model);
      const policies = await this.findSupportedPolicies(departmentId);

      await this.maskingReportRepository.create(
        dto.ticket,
        authentication.userId,
        dto.text,
        file !== undefined,
        dto.recentTicket,
      );
      reportCreated = true;

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
          policyId: policyByContent.get(detection.maskingContent)!.policyId,
        })),
      );

      if (!regexSaved) {
        throw new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
      }
      regexCompleted = true;

      if (file !== undefined) {
        finalObjectKey = this.createFinalObjectKey(dto.ticket);
        const copiedObject = await this.objectStorage.copyObject({
          sourceObjectKey: file.objectKey,
          destinationObjectKey: finalObjectKey,
          sourceVersionId: file.versionId ?? undefined,
        });
        finalObjectVersionId = copiedObject.versionId ?? undefined;
        const fileUrl = this.objectStorage.getObjectUrl(finalObjectKey);
        const promptFile = await this.promptFileRepository.create(
          dto.ticket,
          fileUrl,
          file.originalname,
        );
        promptFileId = promptFile.promptFileId;

        // NER 서버 연동을 다시 활성화할 때 아래 요청 블록의 주석을 해제합니다.
        /*
        const presignedFileUrl = await this.objectStorage.presignedGetObject(
          finalObjectKey,
        );
        await this.nerClient.requestAnalyze({
          ticket: dto.ticket,
          text: dto.text,
          file: {
            url: presignedFileUrl,
            contentType: file.contentType,
            size: file.size,
            sha256: file.sha256,
          },
        });
        */

        // 콜백이 오지 않아 분석 상태가 영구 PENDING이 되는 것을 방지합니다.
        const nerCompleted =
          await this.maskingReportRepository.saveNerDetections(
            dto.ticket,
            fileUrl,
            [],
          );
        if (!nerCompleted) {
          throw new PromptException(
            PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
          );
        }
      }

      return null;
    } catch (error: unknown) {
      if (reportCreated) {
        if (!regexCompleted) {
          await this.safeCancelRegex(dto.ticket);
        }
        if (file !== undefined) {
          await this.safeCancelNer(dto.ticket);
        }
      }

      if (finalObjectKey !== undefined) {
        if (promptFileId !== undefined) {
          await this.safeDeletePromptFile(promptFileId);
        }
        await this.safeRemoveObject(finalObjectKey, finalObjectVersionId);
      }

      throw this.normalizeRequestError(error);
    }
  }

  /** NER 서버의 비동기 분석 결과를 검증하고 리포트에 반영합니다. */
  async applyNerResult(dto: Readonly<NerCallbackRequestDTO>): Promise<null> {
    if (dto.status === 'CANCEL') {
      await this.maskingReportRepository.cancelNer(dto.ticket);
      return null;
    }

    const memberId = await this.maskingReportRepository.findMemberId(dto.ticket);
    if (memberId === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_ANAL_REQ);
    }

    const numericMemberId = Number(memberId);
    if (!Number.isSafeInteger(numericMemberId) || numericMemberId <= 0) {
      throw new PromptException(PromptErrorStatus.INVALID_NER_CALLBACK);
    }

    const departmentId = await this.resolveDepartmentId(numericMemberId);
    const policies = await this.findSupportedPolicies(departmentId);
    const policyByContent = new Map(
      policies.map((policy) => [policy.maskingContent, policy] as const),
    );

    const detections = dto.detections.map((detection) => {
      const maskingContent = normalizeMaskingContent(detection.maskingContent);
      const policy = maskingContent === null
        ? undefined
        : policyByContent.get(maskingContent);

      if (policy === undefined) {
        throw new PromptException(PromptErrorStatus.INVALID_NER_CALLBACK);
      }

      return { policyId: policy.policyId };
    });

    const fileUrl = this.objectStorage.getObjectUrl(
      this.createFinalObjectKey(dto.ticket),
    );
    await this.maskingReportRepository.saveNerDetections(
      dto.ticket,
      fileUrl,
      detections,
    );
    return null;
  }

  async getAnalyze(
    dto: Readonly<PromptReqDTO.Analyze>,
    authentication: Readonly<AuthenticatedUser>,
  ): Promise<{
    pending: boolean;
    result: PromptResDTO.Analyze | null;
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
        const [promptFile] = await this.promptFileRepository.findByReportId(
          dto.ticket,
        );
        return {
          pending: false,
          result: PromptMapper.toAnalyzeResult(
            report,
            promptFile,
          ),
        };
      }
    }
  }

  async requestLlm(
    dto: PromptReqDTO.LlmRequest,
  ): Promise<PromptResDTO.Empty> {
    void dto;
    return null;
  }

  async getLlmResponse(
    dto: PromptReqDTO.LlmResponse,
  ): Promise<{
    pending: boolean;
    result: PromptResDTO.LlmResponse;
  }> {
    void dto;
    return {
      pending: true,
      result: null,
    };
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
    const models = await this.llmDetailModelRepository.find({
      select: { llmName: true },
      relations: { activeApiKey: true },
      where: { activeApiKey: { departmentId } },
      order: { llmName: 'ASC' },
    });

    return models.flatMap((model) =>
      model.llmName === null ? [] : [model.llmName],
    );
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

    const [promptFile] = await this.promptFileRepository.findByReportId(
      report.ticket,
    );
    return PromptMapper.toRecentAnalyze(report, promptFile);
  }

  async getPromptList(
    chatRoomId: string,
    dto: Readonly<PromptReqDTO.PromptList>,
  ): Promise<PromptResDTO.PromptList> {
    void chatRoomId;
    void dto;
    return null;
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

    if (promptFile.memberId !== String(authentication.userId)) {
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
      || storedObjectKey !== this.createFinalObjectKey(
        promptFile.maskingReportId,
      )
    ) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_FILE);
    }

    try {
      const url = await this.objectStorage.presignedGetObject(storedObjectKey);
      return PromptMapper.toFileDownload(url);
    } catch {
      throw new PromptException(
        PromptErrorStatus.FILE_DOWNLOAD_SERVICE_UNAVAILABLE,
      );
    }
  }

  async searchPrompts(dto: PromptReqDTO.Search): Promise<PromptResDTO.Search> {
    void dto;
    return PromptMapper.toSearch(null);
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

  private async assertModelAccessible(
    departmentId: string,
    model: string,
  ): Promise<void> {
    const provider = this.resolveModelProvider(model);
    const activeApiKey = await this.activeApiKeyRepository.findOne({
      select: { activeApiKeyId: true },
      where: { departmentId, serviceType: provider },
    });

    if (activeApiKey === null) {
      this.throwForbiddenModel();
    }
  }

  private resolveModelProvider(model: string): LlmProvider {
    const match = MODEL_PREFIXES.find(({ pattern }) => pattern.test(model));

    if (match === undefined) {
      this.throwForbiddenModel();
    }

    return match.provider;
  }

  private async findSupportedPolicies(
    departmentId: string,
  ): Promise<DepartmentMaskingPolicy[]> {
    const policies = await this.policyRepository.find({
      select: {
        policyId: true,
        maskingContent: true,
        maskingClass: true,
      },
      where: { departmentId, isActive: true },
      order: { policyId: 'ASC' },
    });
    const selectedContents = new Set<MaskingContent>();

    return policies.flatMap((policy) => {
      const maskingContent = normalizeMaskingContent(policy.maskingContent);

      if (maskingContent === null || selectedContents.has(maskingContent)) {
        return [];
      }

      selectedContents.add(maskingContent);
      return [{
        policyId: policy.policyId,
        maskingContent,
        maskingClass: policy.maskingClass,
      }];
    });
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

  private createFinalObjectKey(ticket: string): string {
    return `${MASKING_OBJECT_PREFIX}/${ticket}/source`;
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

  private throwForbiddenModel(): never {
    throw new PromptException(PromptErrorStatus.FORBIDDEN_LLM_MODEL);
  }

  private normalizeRequestError(error: unknown): GatewayException {
    if (error instanceof GatewayException) {
      return error;
    }

    if (error instanceof NerRequestException) {
      return new PromptException(PromptErrorStatus.NER_SERVER_ERROR);
    }

    return new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
  }
}
