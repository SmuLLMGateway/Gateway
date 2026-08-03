import type { DataSource, Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { MaskingClass, PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

describe('AdminService 프롬프트 상세 조회', () => {
  const promptLogRepository = { findOne: jest.fn() };
  const maskingDetailRepository = { find: jest.fn() };
  const memberDepartmentRepository = { findOne: jest.fn() };
  const memberLimitRepository = { find: jest.fn() };
  const dataSource = { getRepository: jest.fn() };
  const service = new AdminService(
    dataSource as unknown as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    {} as Repository<MemberDAO>,
    {} as Repository<DepartmentDAO>,
    memberDepartmentRepository as unknown as Repository<MemberDepartmentDAO>,
    memberLimitRepository as unknown as Repository<MemberLimitDAO>,
    {} as Repository<ActiveApiKeyDAO>,
    {} as Repository<DepartmentPolicyDAO>,
    {} as Repository<PolicyDAO>,
    {} as Repository<AdminLogDAO>,
    {} as Repository<HealthHistoryDAO>,
    {} as LlmApiKeyValidationClient,
    {} as ApiKeyEncryptionService,
    {} as MinioObjectStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PromptLogDAO) return promptLogRepository;
      if (entity === MaskingDetailDAO) return maskingDetailRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
  });

  it('작성자·개인 한도·사용량·마스킹 상세를 반환한다', async () => {
    promptLogRepository.findOne.mockResolvedValue({
      promptLogId: '101',
      communicatedAt: new Date('2026-08-02T15:57:23.000Z'),
      usage: 12400,
      maskingReportId: 'report-1',
      promptRoom: {
        memberId: '42',
        member: { memberId: '42', memberName: '김서윤', email: 'seoyun@example.com' },
      },
      maskingReport: {
        originalText: 'API키와 01012345678',
        createdAt: new Date('2026-08-02T15:55:00.000Z'),
      },
    });
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '7',
      department: { departmentName: '정책기획팀' },
    });
    memberLimitRepository.find.mockResolvedValue([
      { limit: '200000', usage: '50000' },
    ]);
    maskingDetailRepository.find.mockResolvedValue([
      {
        maskingDetailId: '1',
        originalText: 'API키',
        startIdx: 0,
        maskingText: '**',
        departmentPolicy: { policy: { maskingContent: 'API_KEY', maskingClass: MaskingClass.SENSITIVE } },
      },
      {
        maskingDetailId: '2',
        originalText: '01012345678',
        startIdx: 6,
        maskingText: '[전화]',
        departmentPolicy: { policy: { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE } },
      },
    ]);

    await expect(service.getPromptDetail('101')).resolves.toEqual({
      name: '김서윤',
      department: '정책기획팀',
      email: 'seoyun@example.com',
      limit: 200000,
      usage: 12400,
      usagePercent: 6.2,
      promptedAt: '2026-08-03T00:57:23.000+09:00',
      detectCnt: 2,
      maskingCnt: 2,
      originalText: 'API키와 01012345678',
      sendText: '**와 [전화]',
      detect: [
        {
          targetText: 'API키',
          startIdx: 0,
          endIdx: 3,
          maskingCategory: '민감 정보',
          detailCategory: 'API 키',
          maskingText: '**',
          maskingStartIdx: 0,
          maskingEndIdx: 1,
        },
        {
          targetText: '01012345678',
          startIdx: 6,
          endIdx: 16,
          maskingCategory: '개인 정보',
          detailCategory: '전화번호',
          maskingText: '[전화]',
          maskingStartIdx: 6,
          maskingEndIdx: 9,
        },
      ],
    });
  });

  it('외부 LLM 사용량이 없으면 0으로 반환하고, 로그가 없으면 404를 반환한다', async () => {
    promptLogRepository.findOne.mockResolvedValueOnce({
      promptLogId: '102',
      communicatedAt: null,
      usage: null,
      maskingReportId: 'report-2',
      promptRoom: {
        memberId: '42',
        member: { memberId: '42', memberName: '김서윤', email: 'seoyun@example.com' },
      },
      maskingReport: {
        originalText: '원문',
        createdAt: new Date('2026-08-02T15:55:00.000Z'),
      },
    });
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '7',
      department: { departmentName: '정책기획팀' },
    });
    memberLimitRepository.find.mockResolvedValue([]);
    maskingDetailRepository.find.mockResolvedValue([]);

    await expect(service.getPromptDetail('102')).resolves.toMatchObject({
      usage: 0,
      usagePercent: 0,
      promptedAt: '2026-08-03T00:55:00.000+09:00',
    });

    promptLogRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.getPromptDetail('404')).rejects.toBeInstanceOf(PromptException);
  });
});
