import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActiveLlmDAO } from '../../src/domain/admin/dao/active-llm.dao.js';
import {
  MaskingClass,
} from '../../src/domain/admin/dao/policy.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import type { PromptData } from '../../src/domain/prompt/data/prompt.data.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { MaskingReportRepository } from '../../src/domain/prompt/repository/masking-report.repository.js';
import { PromptFileRepository } from '../../src/domain/prompt/repository/prompt-file.repository.js';
import { PromptRoomRepository } from '../../src/domain/prompt/repository/prompt-room.repository.js';
import { PromptLogRepository } from '../../src/domain/prompt/repository/prompt-log.repository.js';
import { PromptFileOcrService } from '../../src/domain/prompt/service/prompt-file-ocr.service.js';
import { PromptService } from '../../src/domain/prompt/service/prompt.service.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import type { AuthenticatedUser } from '../../src/global/security/type/jwt-payload.type.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import { ProviderClient } from '../../src/global/llm/client/provider.client.js';
import { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import { LOCAL_LLM_MODEL } from '../../src/global/llm/llm-service.mapping.js';
import { NerClient } from '../../src/global/ner/client/ner.client.js';
import { NerRequestException } from '../../src/global/ner/exception/ner-request.exception.js';
import { MaskingReportStatus } from '../../src/domain/prompt/type/masking-report-status.enum.js';
import { PromptLogStatus } from '../../src/domain/prompt/type/prompt-log-status.enum.js';
import type { DepartmentMaskingPolicy } from '../../src/domain/prompt/type/masking-content.type.js';

describe('PromptService 부서 접근 및 정책 조회', () => {
  const ticket = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const recentTicket = '8e88c068-722e-4c04-93c5-906cea400be2';
  const chatRoomId = '840c66ce-0b5d-4663-bc63-b4c4666cd0f5';
  const authentication: AuthenticatedUser = {
    userId: 42,
    role: UserRole.USER,
    expiredAt: '2026-07-21T12:00:00.000Z',
    accessToken: true,
  };
  const memberDepartmentRepository = {
    findOne: jest.fn(),
  };
  const activeLlmRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const departmentPolicyRepository = {
    find: jest.fn(),
  };
  const maskingReportRepository = {
    validateRequestTickets: jest.fn(),
    create: jest.fn(),
    saveRegexDetections: jest.fn(),
    saveNerTextDetections: jest.fn(),
    saveNerTextAndFileDetections: jest.fn(),
    updateMaskingText: jest.fn(),
    cancelRegex: jest.fn(),
    cancelNer: jest.fn(),
  };
  const promptRoomRepository = {
    create: jest.fn(),
    deleteByIdAndMemberId: jest.fn(),
    existsByIdAndMemberId: jest.fn(),
  };
  const promptLogRepository = {
    replaceMasking: jest.fn(),
    updatePromptSummary: jest.fn(),
    deleteByMaskingReportId: jest.fn(),
  };
  const maskingDetailRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const departmentRepository = {
    findOne: jest.fn(),
    increment: jest.fn(),
  };
  const memberLimitRepository = {
    increment: jest.fn(),
  };
  const promptLogDataRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const providerClient = {
    request: jest.fn(),
  };
  const promptFileRepository = {
    findByReportId: jest.fn(),
    findDownloadReferenceByFileUrl: jest.fn(),
  };
  const apiKeyEncryption = {
    decrypt: jest.fn(),
  };
  const nerClient = {
    getFirstNerDeploymentId: jest.fn(),
    getFirstLlmDeploymentId: jest.fn(),
    getEnabledLlmDeploymentIdByModelName: jest.fn(),
    getLlmDeployments: jest.fn(),
    getNerDeployments: jest.fn(),
    requestAnalyze: jest.fn(),
    requestLlmGenerate: jest.fn(),
    requestChatTitle: jest.fn(),
  };
  const promptFileOcrService = {
    extractText: jest.fn(),
  };
  const objectStorage = {
    parseObjectUrl: jest.fn(),
    presignedGetObject: jest.fn(),
  };
  const dataSource = {
    getRepository: jest.fn(),
    transaction: jest.fn(),
  };

  let service: PromptService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PromptService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(MemberDepartmentDAO),
          useValue: memberDepartmentRepository,
        },
        {
          provide: getRepositoryToken(ActiveLlmDAO),
          useValue: activeLlmRepository,
        },
        {
          provide: getRepositoryToken(DepartmentPolicyDAO),
          useValue: departmentPolicyRepository,
        },
        {
          provide: MaskingReportRepository,
          useValue: maskingReportRepository,
        },
        {
          provide: PromptFileRepository,
          useValue: promptFileRepository,
        },
        {
          provide: PromptRoomRepository,
          useValue: promptRoomRepository,
        },
        {
          provide: PromptLogRepository,
          useValue: promptLogRepository,
        },
        { provide: MinioObjectStorageService, useValue: objectStorage },
        { provide: PromptFileOcrService, useValue: promptFileOcrService },
        { provide: ProviderClient, useValue: providerClient },
        { provide: ApiKeyEncryptionService, useValue: apiKeyEncryption },
        { provide: NerClient, useValue: nerClient },
      ],
    }).compile();

    service = moduleRef.get(PromptService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    memberDepartmentRepository.findOne.mockResolvedValue({ departmentId: '10' });
    activeLlmRepository.findOne.mockResolvedValue({
      activeLlmId: '100',
    });
    activeLlmRepository.find.mockResolvedValue([]);
    maskingReportRepository.validateRequestTickets.mockResolvedValue(undefined);
    promptRoomRepository.create.mockResolvedValue(undefined);
    promptRoomRepository.deleteByIdAndMemberId.mockResolvedValue(undefined);
    promptRoomRepository.existsByIdAndMemberId.mockResolvedValue(true);
    promptLogRepository.replaceMasking.mockResolvedValue(undefined);
    promptLogRepository.updatePromptSummary.mockResolvedValue(true);
    promptLogRepository.deleteByMaskingReportId.mockResolvedValue(undefined);
    promptFileRepository.findByReportId.mockResolvedValue([]);
    promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValue(null);
    departmentPolicyRepository.find.mockResolvedValue([]);
    maskingReportRepository.create.mockResolvedValue(undefined);
    maskingReportRepository.saveRegexDetections.mockResolvedValue(true);
    maskingReportRepository.saveNerTextDetections.mockResolvedValue(true);
    maskingReportRepository.saveNerTextAndFileDetections.mockResolvedValue(true);
    maskingReportRepository.updateMaskingText.mockResolvedValue(true);
    maskingReportRepository.cancelRegex.mockResolvedValue(true);
    maskingReportRepository.cancelNer.mockResolvedValue(true);
    nerClient.getFirstNerDeploymentId.mockResolvedValue('ner-gliner-multi');
    nerClient.getFirstLlmDeploymentId.mockResolvedValue('llm-qwen3-14b');
    nerClient.getEnabledLlmDeploymentIdByModelName.mockResolvedValue(null);
    nerClient.getLlmDeployments.mockResolvedValue([
      { deploymentId: 'local-Llama-3.1', enabled: true },
      { deploymentId: 'local-Qwen2.5-7B-Instruct', enabled: true },
      { deploymentId: 'local-qwen3:8b', enabled: true },
    ]);
    nerClient.getNerDeployments.mockResolvedValue([]);
    nerClient.requestAnalyze.mockResolvedValue({ detections: [] });
    nerClient.requestLlmGenerate.mockResolvedValue({ text: '로컬 LLM 응답' });
    nerClient.requestChatTitle.mockResolvedValue({ title: 'LPL 생성 요약' });
    promptFileOcrService.extractText.mockResolvedValue('OCR 추출 텍스트');
    objectStorage.parseObjectUrl.mockReturnValue(
      'masking/a81cc17e-e10a-46ae-8113-dceffb932d6c.pdf',
    );
    objectStorage.presignedGetObject.mockResolvedValue('https://download.example/file');
    dataSource.getRepository.mockImplementation((target) => (
      target === PromptLogDAO
        ? promptLogDataRepository
        : target === DepartmentDAO
          ? departmentRepository
          : maskingDetailRepository
    ));
    dataSource.transaction.mockImplementation(async (callback) => callback({
      getRepository: (target: unknown) => (
        target === PromptLogDAO
          ? promptLogDataRepository
          : target === DepartmentDAO
            ? departmentRepository
            : memberLimitRepository
      ),
    }));
    maskingDetailRepository.find.mockResolvedValue([]);
    maskingDetailRepository.findOne.mockResolvedValue(null);
    departmentRepository.findOne.mockResolvedValue({
      departmentId: '10',
      mustFiltering: true,
    });
    promptLogDataRepository.findOne.mockResolvedValue(null);
    promptLogDataRepository.update.mockResolvedValue({ affected: 1 });
    providerClient.request.mockResolvedValue({ outputText: '외부 LLM 응답', totalUsd: 0.1 });
    apiKeyEncryption.decrypt.mockReturnValue('external-api-key');
  });

  it('회원 부서에서 활성화된 모델, 요청 티켓, 소유 채팅방을 검증한 뒤 리포트를 생성한다', async () => {
    await expect(requestAnalyze('Claude Sonnet 5')).resolves.toEqual({
      chatRoomId,
    });

    expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
      select: { departmentId: true },
      where: { memberId: '42' },
    });
    expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
      select: { activeLlmId: true },
      where: {
        activeApiKey: { departmentId: '10', serviceType: 'Claude' },
        llmDetailModel: { llmName: 'Claude Sonnet 5' },
      },
    });
    expect(maskingReportRepository.validateRequestTickets).toHaveBeenCalledWith(
      ticket,
      null,
      authentication.userId,
    );
    expect(promptRoomRepository.existsByIdAndMemberId).toHaveBeenCalledWith(
      chatRoomId,
      String(authentication.userId),
    );
    expect(maskingReportRepository.create).toHaveBeenCalledWith(
      ticket,
      authentication.userId,
      '',
      null,
      false,
    );

    const validationOrder = [
      memberDepartmentRepository.findOne,
      activeLlmRepository.findOne,
      maskingReportRepository.validateRequestTickets,
      promptRoomRepository.existsByIdAndMemberId,
      departmentPolicyRepository.find,
      maskingReportRepository.create,
    ].map((mock) => mock.mock.invocationCallOrder[0]);
    expect(validationOrder).toEqual([...validationOrder].sort((a, b) => a! - b!));
  });

  it('chatRoomId가 null인 최초 요청은 서버 UUID와 원문 요약으로 채팅방을 생성한다', async () => {
    const text = '  첫 번째 요청입니다.\n 다음 문장도 제목에 포함됩니다.  ';

    const result = await service.requestAnalyze(
      {
        llmModel: 'GPT-5.4-nano',
        text,
        ticket,
        recentTicket: null,
        chatRoomId: null,
      },
      undefined,
      authentication,
    );

    expect(promptRoomRepository.existsByIdAndMemberId).not.toHaveBeenCalled();
    const createdRoom = promptRoomRepository.create.mock.calls[0]?.[0] as {
      promptRoomId: string;
      startedAt: Date;
      lastCommunicatedAt: Date;
      promptRoomTitle: string;
      memberId: string;
    };
    expect(createdRoom).toEqual({
      promptRoomId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      startedAt: expect.any(Date),
      lastCommunicatedAt: expect.any(Date),
      promptRoomTitle: '첫 번째 요청입니다. 다음 문장도 제목에 포함됩니다.',
      memberId: String(authentication.userId),
    });
    expect(createdRoom.startedAt).toBe(createdRoom.lastCommunicatedAt);
    expect(result).toEqual({ chatRoomId: createdRoom.promptRoomId });
    expect(maskingReportRepository.create).toHaveBeenCalledWith(
      ticket,
      authentication.userId,
      text,
      null,
      false,
    );
  });

  it.each([
    ['Claude Sonnet 5', 'Claude'],
    ['GPT-4o', 'GPT'],
    ['Gemini 2.5 Pro', 'Gemini'],
  ] as const)(
    '%s 모델과 %s provider가 모두 활성화되어 있는지 조회한다',
    async (model, provider) => {
      await expect(requestAnalyze(model)).resolves.toEqual({ chatRoomId });

      expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
        select: { activeLlmId: true },
        where: {
          activeApiKey: { departmentId: '10', serviceType: provider },
          llmDetailModel: { llmName: model },
        },
      });
      expect(promptLogRepository.replaceMasking).toHaveBeenCalledWith(
        chatRoomId,
        ticket,
        '',
        model,
        model,
      );
    },
  );

  it('부서의 Local LLM 활성 키에 연결된 local-* 모델과 외부 모델을 함께 조회한다', async () => {
    activeLlmRepository.find.mockResolvedValueOnce([
      {
        activeApiKey: { serviceType: 'Claude' },
        llmDetailModel: { llmName: 'Claude Sonnet 5' },
      },
      {
        activeApiKey: { serviceType: LOCAL_LLM_MODEL },
        llmDetailModel: { llmName: 'local-Qwen2.5-7B-Instruct' },
      },
      {
        activeApiKey: { serviceType: 'GPT' },
        llmDetailModel: { llmName: null },
      },
      {
        activeApiKey: { serviceType: 'GPT' },
        llmDetailModel: { llmName: 'GPT-4o' },
      },
      {
        activeApiKey: { serviceType: LOCAL_LLM_MODEL },
        llmDetailModel: { llmName: 'local-Llama-3.1' },
      },
      {
        activeApiKey: { serviceType: 'Claude' },
        llmDetailModel: { llmName: 'local-Legacy-External-Key' },
      },
      {
        activeApiKey: { serviceType: LOCAL_LLM_MODEL },
        llmDetailModel: { llmName: 'local-Qwen2.5-7B-Instruct' },
      },
    ]);

    await expect(service.getModels(authentication)).resolves.toEqual([
      'local-Llama-3.1',
      'local-Qwen2.5-7B-Instruct',
      'Claude Sonnet 5',
      'GPT-4o',
    ]);

    expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
      select: { departmentId: true },
      where: { memberId: '42' },
    });
    expect(activeLlmRepository.find).toHaveBeenCalledWith({
      select: {
        activeApiKey: { serviceType: true },
        llmDetailModel: { llmName: true },
      },
      relations: { activeApiKey: true, llmDetailModel: true },
      where: { activeApiKey: { departmentId: '10' } },
      order: { llmDetailModel: { llmName: 'ASC' } },
    });
  });

  it('모든 로그인 사용자가 부서 조회 없이 LPL의 로컬 NER 목록을 조회할 수 있다', async () => {
    const deployments = [
      { deploymentId: 'ner-gliner-multi', enabled: true },
      { deploymentId: 'ner-disabled', enabled: false },
    ];
    nerClient.getNerDeployments.mockResolvedValueOnce(deployments);

    await expect(service.getNerList()).resolves.toEqual({ deployments });

    expect(nerClient.getNerDeployments).toHaveBeenCalledTimes(1);
    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
    expect(activeLlmRepository.find).not.toHaveBeenCalled();
  });

  it('LPL 로컬 NER 목록 조회 실패는 프롬프트 도메인 오류로 변환한다', async () => {
    nerClient.getNerDeployments.mockRejectedValueOnce(
      new NerRequestException({ status: 502 }),
    );

    await expect(service.getNerList()).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.NER_DEPLOYMENT_LIST_UNAVAILABLE,
    });
  });

  it('부서에 활성화된 local-* LLM mapping을 통해 로컬 모델을 사용할 수 있다', async () => {
    await expect(requestAnalyze('local-Qwen2.5-7B-Instruct')).resolves.toEqual({ chatRoomId });

    expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
      select: { activeLlmId: true },
      where: {
        activeApiKey: { departmentId: '10', serviceType: LOCAL_LLM_MODEL },
        llmDetailModel: { llmName: 'local-Qwen2.5-7B-Instruct' },
      },
    });
  });

  it('로컬 LLM은 API 키와 파일을 제외하고 LPL /generate에 마스킹된 본문을 전송한다', async () => {
    const phone = '010-1234-5678';
    const originalText = `담당자 연락처는 ${phone}입니다.`;
    promptLogDataRepository.findOne.mockResolvedValueOnce({
      promptLogId: '91',
      status: PromptLogStatus.MASKING,
      modelType: 'local-qwen3:8b',
      modelName: 'local-qwen3:8b',
      maskingReport: {
        status: MaskingReportStatus.DONE,
        originalText,
      },
      promptRoom: { memberId: String(authentication.userId) },
    });
    maskingDetailRepository.find.mockResolvedValueOnce([{
      originalText: phone,
      startIdx: originalText.indexOf(phone),
      maskingText: '[ 전화번호 ]',
    }]);
    nerClient.requestLlmGenerate.mockResolvedValueOnce({
      text: '마스킹된 내용을 확인했습니다.',
      modelName: 'qwen3:8b',
      finishReason: 'stop',
    });

    await expect(service.requestLlm({ ticket }, authentication)).resolves.toBeNull();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
      select: { activeLlmId: true },
      where: {
        activeApiKey: {
          departmentId: '10',
          serviceType: LOCAL_LLM_MODEL,
        },
        llmDetailModel: { llmName: 'local-qwen3:8b' },
      },
    });
    expect(nerClient.requestLlmGenerate).toHaveBeenCalledWith({
      text: '담당자 연락처는 [ 전화번호 ]입니다.',
      llmDeploymentId: 'local-qwen3:8b',
    });
    expect(nerClient.requestChatTitle).toHaveBeenCalledWith({
      text: '담당자 연락처는 [ 전화번호 ]입니다.',
      llmDeploymentId: 'local-qwen3:8b',
    });
    expect(promptLogRepository.updatePromptSummary).toHaveBeenCalledWith(
      '91',
      'LPL 생성 요약',
    );
    expect(providerClient.request).not.toHaveBeenCalled();
    expect(apiKeyEncryption.decrypt).not.toHaveBeenCalled();

    const [reserveCondition, reserveValues] = promptLogDataRepository.update.mock
      .calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(reserveCondition).toMatchObject({ promptLogId: '91' });
    expect(reserveValues).toMatchObject({
      status: PromptLogStatus.PENDING,
      communicatedAt: expect.any(Date),
      activeApiKeyId: null,
    });
    expect(promptLogDataRepository.update).toHaveBeenLastCalledWith(
      { maskingReportId: ticket, status: PromptLogStatus.PENDING },
      {
        status: PromptLogStatus.DONE,
        responseText: '마스킹된 내용을 확인했습니다.',
        usage: null,
        activeApiKeyId: null,
      },
    );
  });

  it('LPL 로컬 LLM 생성 실패는 프롬프트 로그를 ERROR로 전환한다', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
      .mockImplementation();
    promptLogDataRepository.findOne.mockResolvedValueOnce({
      promptLogId: '92',
      status: PromptLogStatus.MASKING,
      modelType: 'local-qwen3:8b',
      modelName: 'local-qwen3:8b',
      maskingReport: {
        status: MaskingReportStatus.DONE,
        originalText: '마스킹된 본문',
      },
      promptRoom: { memberId: String(authentication.userId) },
    });
    nerClient.requestLlmGenerate.mockRejectedValueOnce(
      new NerRequestException({ status: 503 }),
    );

    try {
      await expect(service.requestLlm({ ticket }, authentication)).resolves.toBeNull();
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(promptLogDataRepository.update).toHaveBeenLastCalledWith(
        { maskingReportId: ticket, status: PromptLogStatus.PENDING },
        { status: PromptLogStatus.ERROR },
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Local LLM 전송 실패: ticket=${ticket}`,
        expect.any(String),
      );
    } finally {
      loggerErrorSpy.mockRestore();
    }
  });

  it('mustFiltering=true이고 탐지 상세가 있으면 외부 LLM 전송을 차단한다', async () => {
    promptLogDataRepository.findOne.mockResolvedValueOnce(
      createExternalMaskingPromptLog(),
    );
    activeLlmRepository.findOne.mockResolvedValueOnce(
      createExternalActiveLlm(),
    );
    maskingDetailRepository.findOne.mockResolvedValueOnce({
      maskingDetailId: '501',
    });

    await expect(service.requestLlm({ ticket }, authentication)).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_EXTERNAL_LLM_WITH_DETECTIONS,
    });

    expect(promptLogDataRepository.update).not.toHaveBeenCalled();
    expect(providerClient.request).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: 'mustFiltering=true이지만 탐지 상세가 없는 경우',
      mustFiltering: true,
      detection: null,
    },
    {
      description: 'mustFiltering=false이고 탐지 상세가 있는 경우',
      mustFiltering: false,
      detection: { maskingDetailId: '501' },
    },
  ])('$description 외부 LLM 전송을 허용한다', async ({
    mustFiltering,
    detection,
  }) => {
    promptLogDataRepository.findOne.mockResolvedValueOnce(
      createExternalMaskingPromptLog(),
    );
    activeLlmRepository.findOne.mockResolvedValueOnce(
      createExternalActiveLlm(),
    );
    departmentRepository.findOne.mockResolvedValueOnce({
      departmentId: '10',
      mustFiltering,
    });
    maskingDetailRepository.findOne.mockResolvedValueOnce(detection);

    await expect(service.requestLlm({ ticket }, authentication)).resolves.toBeNull();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(providerClient.request).toHaveBeenCalledWith({
      ticket,
      model: 'Claude Sonnet 5',
      apiKey: 'external-api-key',
      text: '외부 LLM 전송 본문',
      files: [],
    });
    expect(nerClient.getFirstLlmDeploymentId).toHaveBeenCalled();
    expect(nerClient.requestChatTitle).toHaveBeenCalledWith({
      text: '외부 LLM 전송 본문',
      llmDeploymentId: 'llm-qwen3-14b',
    });
    expect(promptLogRepository.updatePromptSummary).toHaveBeenCalledWith(
      '93',
      'LPL 생성 요약',
    );
    if (!mustFiltering) {
      expect(maskingDetailRepository.findOne).not.toHaveBeenCalled();
    }
  });

  it('부서의 activeLocalLLM이 false이면 외부 LLM 전송은 유지하고 LPL 제목 생성만 건너뛴다', async () => {
    promptLogDataRepository.findOne.mockResolvedValueOnce(
      createExternalMaskingPromptLog(),
    );
    activeLlmRepository.findOne.mockResolvedValueOnce(
      createExternalActiveLlm(),
    );
    departmentRepository.findOne
      .mockResolvedValueOnce({ departmentId: '10', mustFiltering: false })
      .mockResolvedValueOnce({ departmentId: '10', activeLocalLLM: false });

    await expect(service.requestLlm({ ticket }, authentication)).resolves.toBeNull();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(providerClient.request).toHaveBeenCalled();
    expect(nerClient.requestChatTitle).not.toHaveBeenCalled();
    expect(promptLogRepository.updatePromptSummary).not.toHaveBeenCalled();
  });

  it('비활성화된 local-* LLM mapping은 PROM403_1로 거부하고 리포트를 생성하지 않는다', async () => {
    activeLlmRepository.findOne.mockResolvedValueOnce(null);

    await expect(requestAnalyze('local-Qwen2.5-7B-Instruct')).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    });

    expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
      select: { activeLlmId: true },
      where: {
        activeApiKey: { departmentId: '10', serviceType: LOCAL_LLM_MODEL },
        llmDetailModel: { llmName: 'local-Qwen2.5-7B-Instruct' },
      },
    });
    expect(maskingReportRepository.validateRequestTickets).not.toHaveBeenCalled();
    expect(promptRoomRepository.existsByIdAndMemberId).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('미지원 모델 prefix는 PROM403_1을 반환하고 리포트를 생성하지 않는다', async () => {
    await expect(requestAnalyze('Llama 3.1')).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    });

    expect(activeLlmRepository.findOne).not.toHaveBeenCalled();
    expect(maskingReportRepository.validateRequestTickets).not.toHaveBeenCalled();
    expect(promptRoomRepository.existsByIdAndMemberId).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('부서에 활성화된 모델 연결이 없으면 PROM403_1을 반환하고 리포트를 생성하지 않는다', async () => {
    activeLlmRepository.findOne.mockResolvedValueOnce(null);

    await expect(requestAnalyze('Claude 미등록 모델')).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    });
    expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
      select: { activeLlmId: true },
      where: {
        activeApiKey: { departmentId: '10', serviceType: 'Claude' },
        llmDetailModel: { llmName: 'Claude 미등록 모델' },
      },
    });
    expect(maskingReportRepository.validateRequestTickets).not.toHaveBeenCalled();
    expect(promptRoomRepository.existsByIdAndMemberId).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('회원의 부서 소속 정보가 없으면 PROM403_1을 반환한다', async () => {
    memberDepartmentRepository.findOne.mockResolvedValue(null);

    await expect(requestAnalyze('Claude Sonnet 5')).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    });
    expect(activeLlmRepository.findOne).not.toHaveBeenCalled();
    expect(maskingReportRepository.validateRequestTickets).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('사용자 소유 채팅방이 없으면 PROM404_6을 반환하고 리포트를 생성하지 않는다', async () => {
    promptRoomRepository.existsByIdAndMemberId.mockResolvedValueOnce(false);

    await expect(requestAnalyze('Claude Sonnet 5')).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.NOT_FOUND_CHAT_ROOM,
    });
    expect(promptRoomRepository.existsByIdAndMemberId).toHaveBeenCalledWith(
      chatRoomId,
      String(authentication.userId),
    );
    expect(departmentPolicyRepository.find).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: '중복 ticket',
      requestRecentTicket: null,
      errorStatus: PromptErrorStatus.DUPLICATED_TICKET,
    },
    {
      description: '존재하지 않는 recentTicket',
      requestRecentTicket: recentTicket,
      errorStatus: PromptErrorStatus.NOT_FOUND_RECENT_TICKET,
    },
  ])('$description 검증이 실패하면 리포트를 생성하지 않는다', async ({
    requestRecentTicket,
    errorStatus,
  }) => {
    maskingReportRepository.validateRequestTickets.mockRejectedValueOnce(
      new PromptException(errorStatus),
    );

    await expect(
      requestAnalyze('Claude Sonnet 5', '', requestRecentTicket),
    ).rejects.toMatchObject({ baseStatus: errorStatus });
    expect(maskingReportRepository.validateRequestTickets).toHaveBeenCalledWith(
      ticket,
      requestRecentTicket,
      authentication.userId,
    );
    expect(promptRoomRepository.existsByIdAndMemberId).not.toHaveBeenCalled();
    expect(departmentPolicyRepository.find).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('활성 부서 정책을 조회하고 탐지 텍스트와 마스킹 텍스트를 저장한다', async () => {
    departmentPolicyRepository.find.mockImplementation(async () => [
      createDepartmentPolicy('5', 'PHONE', MaskingClass.PRIVATE),
      createDepartmentPolicy('8', 'NOT_SUPPORTED', MaskingClass.PRIVATE),
      createDepartmentPolicy('11', 'resident', MaskingClass.PRIVATE),
    ].sort((left, right) =>
      Number(left.departmentPolicyId) - Number(right.departmentPolicyId)));

    await requestAnalyze(
      'Claude Sonnet 5',
      '010-1234-5678, 900101-1234567',
    );

    expect(departmentPolicyRepository.find).toHaveBeenCalledWith({
      select: {
        departmentPolicyId: true,
        policy: {
          maskingContent: true,
          maskingClass: true,
        },
      },
      relations: { policy: true },
      where: {
        departmentId: '10',
        isActive: true,
      },
      order: { departmentPolicyId: 'ASC' },
    });

    const detections = maskingReportRepository.saveRegexDetections.mock
      .calls[0]?.[1] as PromptData.RegexDetection[] | undefined;
    expect(detections).toEqual([
      expect.objectContaining({
        originalText: '010-1234-5678',
        maskingText: '[ 전화번호 ]',
        departmentPolicyId: '5',
      }),
      expect.objectContaining({
        originalText: '900101-1234567',
        maskingText: '[ 주민등록번호 ]',
        departmentPolicyId: '11',
      }),
    ]);
  });

  it('활성 ACCOUNT와 ADDRESS 정책의 계좌번호·한국 주소만 정규식으로 저장한다', async () => {
    const accountNumber = '110-123-456789';
    const roadAddress = '서울특별시 강남구 테헤란로 123 101동 1001호';
    const jibunAddress = '경기도 성남시 분당구 정자동 1-2';
    const text = [
      `입금 계좌는 ${accountNumber}입니다.`,
      `도로명 주소는 ${roadAddress}입니다.`,
      `지번 주소는 ${jibunAddress}입니다.`,
      '전화번호는 010-1234-5678, 주민번호는 900101-1234567입니다.',
    ].join(' ');
    departmentPolicyRepository.find.mockResolvedValue([
      createDepartmentPolicy('12', 'ACCOUNT', MaskingClass.PRIVATE),
      createDepartmentPolicy('13', 'ADDRESS', MaskingClass.PRIVATE),
    ]);

    await requestAnalyze('Claude Sonnet 5', text);

    expect(maskingReportRepository.saveRegexDetections).toHaveBeenCalledWith(
      ticket,
      [
        {
          originalText: accountNumber,
          startIdx: text.indexOf(accountNumber),
          endIdx: text.indexOf(accountNumber) + accountNumber.length,
          maskingText: '[ 계좌번호 ]',
          departmentPolicyId: '12',
        },
        {
          originalText: roadAddress,
          startIdx: text.indexOf(roadAddress),
          endIdx: text.indexOf(roadAddress) + roadAddress.length,
          maskingText: '[ 주소 ]',
          departmentPolicyId: '13',
        },
        {
          originalText: jibunAddress,
          startIdx: text.indexOf(jibunAddress),
          endIdx: text.indexOf(jibunAddress) + jibunAddress.length,
          maskingText: '[ 주소 ]',
          departmentPolicyId: '13',
        },
      ],
    );
  });

  it('PRIVATE가 아닌 정책은 정규식 탐지 대상에서 제외하고 이후 NER/LLM 분석용 정책으로만 유지한다', async () => {
    const phone = '010-1234-5678';
    departmentPolicyRepository.find.mockResolvedValue([
      createDepartmentPolicy('5', 'PHONE', MaskingClass.SENSITIVE),
    ]);

    await requestAnalyze('Claude Sonnet 5', phone);

    expect(maskingReportRepository.saveRegexDetections).toHaveBeenCalledWith(
      ticket,
      [],
    );
  });

  it('NER 탐지가 중지된 동안에는 NER 서버 요청과 NER 상태 전이를 수행하지 않는다', async () => {
    const text = '010-1234-5678 / ner-secret';
    departmentPolicyRepository.find.mockResolvedValue([
      createDepartmentPolicy('5', 'PHONE', MaskingClass.PRIVATE),
      createDepartmentPolicy('9', 'API_KEY', MaskingClass.PRIVATE),
    ]);

    await requestAnalyze('Claude Sonnet 5', text);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(maskingReportRepository.create).toHaveBeenCalledWith(
      ticket,
      authentication.userId,
      text,
      null,
      false,
    );
    expect(nerClient.requestAnalyze).not.toHaveBeenCalled();
    expect(nerClient.getEnabledLlmDeploymentIdByModelName).not.toHaveBeenCalled();
    expect(nerClient.getFirstNerDeploymentId).not.toHaveBeenCalled();
    expect(nerClient.getFirstLlmDeploymentId).not.toHaveBeenCalled();
    expect(maskingReportRepository.saveNerTextDetections).not.toHaveBeenCalled();
    expect(maskingReportRepository.saveNerTextAndFileDetections).not.toHaveBeenCalled();
    expect(maskingReportRepository.cancelNer).not.toHaveBeenCalled();
  });

  it('LLM 전송 본문은 저장된 텍스트 탐지 항목을 뒤에서부터 마스킹한다', async () => {
    const email = 'seoyun@example.com';
    const phone = '010-1234-5678';
    const originalText = `연락처는 ${phone}, 이메일은 ${email}입니다.`;
    maskingDetailRepository.find.mockResolvedValue([
      {
        originalText: email,
        startIdx: originalText.indexOf(email),
        maskingText: '[ 이메일 ]',
      },
      {
        originalText: null,
        startIdx: null,
        maskingText: null,
      },
      {
        originalText: phone,
        startIdx: originalText.indexOf(phone),
        maskingText: '[ 전화번호 ]',
      },
    ]);

    const maskingService = service as unknown as {
      toMaskedPromptText(ticket: string, text: string): Promise<string>;
    };

    await expect(
      maskingService.toMaskedPromptText(ticket, originalText),
    ).resolves.toBe('연락처는 [ 전화번호 ], 이메일은 [ 이메일 ]입니다.');
    expect(dataSource.getRepository).toHaveBeenCalledWith(MaskingDetailDAO);
    expect(maskingDetailRepository.find).toHaveBeenCalledWith({
      select: {
        originalText: true,
        startIdx: true,
        maskingText: true,
      },
      where: { maskingReportId: ticket },
    });
  });

  it('텍스트 탐지 항목의 치환 정보가 불완전하면 원문을 전송하지 않고 실패한다', async () => {
    maskingDetailRepository.find.mockResolvedValue([
      {
        originalText: '010-1234-5678',
        startIdx: 0,
        maskingText: null,
      },
    ]);
    const maskingService = service as unknown as {
      toMaskedPromptText(ticket: string, text: string): Promise<string>;
    };

    await expect(
      maskingService.toMaskedPromptText(ticket, '010-1234-5678'),
    ).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
    });
  });

  it('NER 응답에서 maskingText가 빠진 탐지는 마스킹 대상 없음으로 간주해 저장하지 않는다', () => {
    const nerMapper = service as unknown as {
      toNerTextDetections(
        text: string,
        detections: readonly Readonly<{
          start: number;
          end: number;
          text: string;
          type: string;
          source: 'ner' | 'llm';
          score: number;
          maskingText?: string;
        }>[],
        existingDetections: readonly [],
        policies: readonly Readonly<DepartmentMaskingPolicy>[],
      ): PromptData.NerTextDetection[];
    };

    expect(nerMapper.toNerTextDetections(
      '홍길동에게 전달',
      [{
        start: 0,
        end: 3,
        text: '홍길동',
        type: 'PHONE_NUMBER',
        source: 'ner',
        score: 0.9,
      }],
      [],
      [{
        departmentPolicyId: '9',
        maskingContent: 'PHONE',
        maskingClass: MaskingClass.PRIVATE,
      }],
    )).toEqual([]);
  });

  it('부서 관리자는 자기 부서 일반 사용자의 파일만 다운로드할 수 있다', async () => {
    promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValue({
      promptFileId: '1',
      maskingReportId: ticket,
      fileUrl: 'minio://masking/a81cc17e-e10a-46ae-8113-dceffb932d6c.pdf',
      fileOriginalName: '검토문서.pdf',
      memberId: '99',
    });
    memberDepartmentRepository.findOne
      .mockResolvedValueOnce({ departmentId: '10' })
      .mockResolvedValueOnce({
        departmentId: '10',
        member: { authorize: UserRole.USER },
      });

    await expect(service.downloadFile({
      fileUrl: 'minio://masking/a81cc17e-e10a-46ae-8113-dceffb932d6c.pdf',
    }, {
      ...authentication,
      userId: 7,
      role: UserRole.DEPART_ADMIN,
    })).resolves.toBe('https://download.example/file');

    expect(objectStorage.presignedGetObject).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      description: '다른 부서 일반 사용자',
      target: { departmentId: '11', member: { authorize: UserRole.USER } },
    },
    {
      description: '같은 부서 관리자',
      target: { departmentId: '10', member: { authorize: UserRole.DEPART_ADMIN } },
    },
  ])('부서 관리자는 $description 파일을 다운로드할 수 없다', async ({ target }) => {
    promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValue({
      promptFileId: '1',
      maskingReportId: ticket,
      fileUrl: 'minio://masking/a81cc17e-e10a-46ae-8113-dceffb932d6c.pdf',
      fileOriginalName: '검토문서.pdf',
      memberId: '99',
    });
    memberDepartmentRepository.findOne
      .mockResolvedValueOnce({ departmentId: '10' })
      .mockResolvedValueOnce(target);

    await expect(service.downloadFile({
      fileUrl: 'minio://masking/a81cc17e-e10a-46ae-8113-dceffb932d6c.pdf',
    }, {
      ...authentication,
      userId: 7,
      role: UserRole.DEPART_ADMIN,
    })).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_FILE_DOWNLOAD,
    });

    expect(objectStorage.presignedGetObject).not.toHaveBeenCalled();
  });

  function requestAnalyze(
    llmModel: string,
    text = '',
    requestRecentTicket: string | null = null,
    ner?: string,
  ) {
    return service.requestAnalyze(
      {
        llmModel,
        text,
        ticket,
        recentTicket: requestRecentTicket,
        chatRoomId,
        ...(ner === undefined ? {} : { ner }),
      },
      undefined,
      authentication,
    );
  }

  function createExternalMaskingPromptLog() {
    return {
      promptLogId: '93',
      status: PromptLogStatus.MASKING,
      modelType: 'Claude',
      modelName: 'Claude Sonnet 5',
      maskingReport: {
        status: MaskingReportStatus.DONE,
        originalText: '외부 LLM 전송 본문',
      },
      promptRoom: { memberId: String(authentication.userId) },
    };
  }

  function createExternalActiveLlm() {
    return {
      activeLlmId: '301',
      activeApiKeyId: '401',
      activeApiKey: {
        apiKey: 'encrypted-api-key',
        serviceType: 'Claude',
      },
      llmDetailModel: { llmName: 'Claude Sonnet 5' },
    };
  }
});

function createDepartmentPolicy(
  departmentPolicyId: string,
  maskingContent: string,
  maskingClass: MaskingClass,
): DepartmentPolicyDAO {
  return {
    departmentPolicyId,
    policy: {
      policyId: `policy-${departmentPolicyId}`,
      maskingContent,
      maskingClass,
    },
  } as DepartmentPolicyDAO;
}
