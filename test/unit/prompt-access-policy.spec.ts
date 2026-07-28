import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActiveLlmDAO } from '../../src/domain/admin/dao/active-llm.dao.js';
import {
  MaskingClass,
  PolicyDAO,
} from '../../src/domain/admin/dao/policy.dao.js';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import type { PromptData } from '../../src/domain/prompt/data/prompt.data.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { MaskingReportRepository } from '../../src/domain/prompt/repository/masking-report.repository.js';
import { PromptFileRepository } from '../../src/domain/prompt/repository/prompt-file.repository.js';
import { PromptRoomRepository } from '../../src/domain/prompt/repository/prompt-room.repository.js';
import { PromptService } from '../../src/domain/prompt/service/prompt.service.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import type { AuthenticatedUser } from '../../src/global/security/type/jwt-payload.type.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

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
  const policyRepository = {
    find: jest.fn(),
  };
  const maskingReportRepository = {
    validateRequestTickets: jest.fn(),
    create: jest.fn(),
    saveRegexDetections: jest.fn(),
    cancelRegex: jest.fn(),
    cancelNer: jest.fn(),
  };
  const promptRoomRepository = {
    create: jest.fn(),
    deleteByIdAndMemberId: jest.fn(),
    existsByIdAndMemberId: jest.fn(),
  };

  let service: PromptService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PromptService,
        {
          provide: getRepositoryToken(MemberDepartmentDAO),
          useValue: memberDepartmentRepository,
        },
        {
          provide: getRepositoryToken(ActiveLlmDAO),
          useValue: activeLlmRepository,
        },
        {
          provide: getRepositoryToken(PolicyDAO),
          useValue: policyRepository,
        },
        {
          provide: MaskingReportRepository,
          useValue: maskingReportRepository,
        },
        {
          provide: PromptFileRepository,
          useValue: {},
        },
        {
          provide: PromptRoomRepository,
          useValue: promptRoomRepository,
        },
        { provide: MinioObjectStorageService, useValue: {} },
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
    policyRepository.find.mockResolvedValue([]);
    maskingReportRepository.create.mockResolvedValue(undefined);
    maskingReportRepository.saveRegexDetections.mockResolvedValue(true);
    maskingReportRepository.cancelRegex.mockResolvedValue(true);
    maskingReportRepository.cancelNer.mockResolvedValue(true);
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
    );

    const validationOrder = [
      memberDepartmentRepository.findOne,
      activeLlmRepository.findOne,
      maskingReportRepository.validateRequestTickets,
      promptRoomRepository.existsByIdAndMemberId,
      policyRepository.find,
      maskingReportRepository.create,
    ].map((mock) => mock.mock.invocationCallOrder[0]);
    expect(validationOrder).toEqual([...validationOrder].sort((a, b) => a! - b!));
  });

  it('chatRoomId가 null인 최초 요청은 서버 UUID와 원문 요약으로 채팅방을 생성한다', async () => {
    const text = '  첫 번째 요청입니다.\n 다음 문장도 제목에 포함됩니다.  ';

    const result = await service.requestAnalyze(
      {
        model: 'GPT-5.4-nano',
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
    },
  );

  it('부서에서 활성화된 모델 이름을 active_llm 연결로 조회한다', async () => {
    activeLlmRepository.find.mockResolvedValueOnce([
      { llmDetailModel: { llmName: 'Claude Sonnet 5' } },
      { llmDetailModel: { llmName: null } },
      { llmDetailModel: { llmName: 'GPT-4o' } },
    ]);

    await expect(service.getModels(authentication)).resolves.toEqual([
      'Claude Sonnet 5',
      'GPT-4o',
    ]);

    expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
      select: { departmentId: true },
      where: { memberId: '42' },
    });
    expect(activeLlmRepository.find).toHaveBeenCalledWith({
      select: { llmDetailModel: { llmName: true } },
      relations: { activeApiKey: true, llmDetailModel: true },
      where: { activeApiKey: { departmentId: '10' } },
      order: { llmDetailModel: { llmName: 'ASC' } },
    });
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
    expect(policyRepository.find).not.toHaveBeenCalled();
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
    expect(policyRepository.find).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('활성 PRIVATE 부서 정책만 조회하고 탐지 텍스트와 마스킹 텍스트를 저장한다', async () => {
    policyRepository.find.mockImplementation(async () => [
      createPolicy('5', 'PHONE', MaskingClass.PRIVATE),
      createPolicy('8', 'NOT_SUPPORTED', MaskingClass.PRIVATE),
      createPolicy('11', 'resident', MaskingClass.PRIVATE),
    ].sort((left, right) => Number(left.policyId) - Number(right.policyId)));

    await requestAnalyze(
      'Claude Sonnet 5',
      '010-1234-5678, 900101-1234567',
    );

    expect(policyRepository.find).toHaveBeenCalledWith({
      select: {
        policyId: true,
        maskingContent: true,
        maskingClass: true,
      },
      where: {
        maskingClass: MaskingClass.PRIVATE,
        departmentPolicies: {
          departmentId: '10',
          isActive: true,
        },
      },
      order: { policyId: 'ASC' },
    });

    const detections = maskingReportRepository.saveRegexDetections.mock
      .calls[0]?.[1] as PromptData.RegexDetection[] | undefined;
    expect(detections).toEqual([
      expect.objectContaining({
        originalText: '010-1234-5678',
        maskingText: '[ 전화번호 ]',
        policyId: '5',
      }),
      expect.objectContaining({
        originalText: '900101-1234567',
        maskingText: '[ 주민등록번호 ]',
        policyId: '11',
      }),
    ]);
  });

  function requestAnalyze(
    model: string,
    text = '',
    requestRecentTicket: string | null = null,
  ) {
    return service.requestAnalyze(
      {
        model,
        text,
        ticket,
        recentTicket: requestRecentTicket,
        chatRoomId,
      },
      undefined,
      authentication,
    );
  }
});

function createPolicy(
  policyId: string,
  maskingContent: string,
  maskingClass: MaskingClass,
): PolicyDAO {
  return {
    policyId,
    maskingContent,
    maskingClass,
  } as PolicyDAO;
}
