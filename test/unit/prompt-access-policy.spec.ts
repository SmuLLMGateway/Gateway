import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { LlmDetailModelDAO } from '../../src/domain/admin/dao/llm-detail-model.dao.js';
import {
  MaskingClass,
  PolicyDAO,
} from '../../src/domain/admin/dao/policy.dao.js';
import { NerClient } from '../../src/global/ner/client/ner.client.js';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import type { PromptData } from '../../src/domain/prompt/data/prompt.data.js';
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
  const authentication: AuthenticatedUser = {
    userId: 42,
    role: UserRole.USER,
    expiredAt: '2026-07-21T12:00:00.000Z',
    accessToken: true,
  };
  const memberDepartmentRepository = {
    findOne: jest.fn(),
  };
  const activeApiKeyRepository = {
    findOne: jest.fn(),
  };
  const policyRepository = {
    find: jest.fn(),
  };
  const llmDetailModelRepository = {
    find: jest.fn(),
  };
  const maskingReportRepository = {
    create: jest.fn(),
    saveRegexDetections: jest.fn(),
    cancelRegex: jest.fn(),
    cancelNer: jest.fn(),
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
          provide: getRepositoryToken(ActiveApiKeyDAO),
          useValue: activeApiKeyRepository,
        },
        {
          provide: getRepositoryToken(PolicyDAO),
          useValue: policyRepository,
        },
        {
          provide: getRepositoryToken(LlmDetailModelDAO),
          useValue: llmDetailModelRepository,
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
          useValue: {},
        },
        { provide: MinioObjectStorageService, useValue: {} },
        { provide: NerClient, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(PromptService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    memberDepartmentRepository.findOne.mockResolvedValue({ departmentId: '10' });
    activeApiKeyRepository.findOne.mockResolvedValue({ activeApiKeyId: '100' });
    policyRepository.find.mockResolvedValue([]);
    maskingReportRepository.create.mockResolvedValue(undefined);
    maskingReportRepository.saveRegexDetections.mockResolvedValue(true);
    maskingReportRepository.cancelRegex.mockResolvedValue(true);
    maskingReportRepository.cancelNer.mockResolvedValue(true);
  });

  it('memberId로 회원이 소속된 departmentId를 조회해 분석을 진행한다', async () => {
    await expect(requestAnalyze('Claude Sonnet 5')).resolves.toBeNull();

    expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
      select: { departmentId: true },
      where: { memberId: '42' },
    });
    expect(activeApiKeyRepository.findOne).toHaveBeenCalledWith({
      select: { activeApiKeyId: true },
      where: { departmentId: '10', serviceType: 'Claude' },
    });
  });

  it('회원의 부서 소속 정보가 없으면 PROM403_1을 반환한다', async () => {
    memberDepartmentRepository.findOne.mockResolvedValue(null);

    await expect(requestAnalyze('Claude Sonnet 5')).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    });
    expect(activeApiKeyRepository.findOne).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['Claude Sonnet 5', 'Claude'],
    ['GPT-4o', 'GPT'],
    ['Gemini 2.5 Pro', 'Gemini'],
  ] as const)(
    '%s 모델 prefix를 %s provider로 변환하여 부서 API 키를 조회한다',
    async (model, provider) => {
      await expect(requestAnalyze(model)).resolves.toBeNull();

      expect(activeApiKeyRepository.findOne).toHaveBeenCalledWith({
        select: { activeApiKeyId: true },
        where: { departmentId: '10', serviceType: provider },
      });
    },
  );

  it.each([
    'Llama 3.1',
    'claude Sonnet 5',
    'gpt-4o',
    'gemini 2.5 Pro',
  ])('알 수 없거나 소문자인 모델 %s는 PROM403_1을 반환한다', async (model) => {
    await expect(requestAnalyze(model)).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    });
    expect(activeApiKeyRepository.findOne).not.toHaveBeenCalled();
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('provider에 등록된 부서 API 키가 없으면 PROM403_1을 반환한다', async () => {
    activeApiKeyRepository.findOne.mockResolvedValue(null);

    await expect(requestAnalyze('Claude Sonnet 5')).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    });
    expect(activeApiKeyRepository.findOne).toHaveBeenCalledWith({
      select: { activeApiKeyId: true },
      where: { departmentId: '10', serviceType: 'Claude' },
    });
    expect(maskingReportRepository.create).not.toHaveBeenCalled();
  });

  it('정책 문자열을 정규화하고 미지원 값과 중복 정책을 제외한다', async () => {
    policyRepository.find.mockImplementation(async () => [
      createPolicy('20', ' phone ', MaskingClass.SENSITIVE),
      createPolicy('5', 'PHONE', MaskingClass.PRIVATE),
      createPolicy('7', 'api key', MaskingClass.SENSITIVE),
      createPolicy('8', 'NOT_SUPPORTED', MaskingClass.PRIVATE),
      createPolicy('11', 'resident', MaskingClass.PRIVATE),
    ].sort((left, right) => Number(left.policyId) - Number(right.policyId)));

    await requestAnalyze(
      'Claude Sonnet 5',
      '010-1234-5678, 900101-1234567, api_key=AbCdEfGhIjKlMnOp1234',
    );

    expect(policyRepository.find).toHaveBeenCalledWith({
      select: {
        policyId: true,
        maskingContent: true,
        maskingClass: true,
      },
      where: { departmentId: '10', isActive: true },
      order: { policyId: 'ASC' },
    });

    const detections = maskingReportRepository.saveRegexDetections.mock
      .calls[0]?.[1] as PromptData.RegexDetection[] | undefined;
    expect(detections).toEqual([
      expect.objectContaining({
        originalText: '010-1234-5678',
        policyId: '5',
      }),
      expect.objectContaining({
        originalText: '900101-1234567',
        policyId: '11',
      }),
      expect.objectContaining({
        originalText: 'AbCdEfGhIjKlMnOp1234',
        policyId: '7',
      }),
    ]);
  });

  function requestAnalyze(model: string, text = ''): Promise<null> {
    return service.requestAnalyze(
      {
        model,
        text,
        ticket,
        recentTicket: null,
        chatRoomId: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
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
    isActive: true,
    departmentId: '10',
  } as PolicyDAO;
}
