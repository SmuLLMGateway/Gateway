import type { DataSource, Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { PromptLogStatus } from '../../src/domain/prompt/type/prompt-log-status.enum.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

describe('AdminService 사용자 프롬프트 목록 조회', () => {
  const promptLogRepository = { findAndCount: jest.fn() };
  const dataSource = { getRepository: jest.fn() };
  const service = new AdminService(
    dataSource as unknown as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    {} as Repository<MemberDAO>,
    {} as Repository<DepartmentDAO>,
    {} as Repository<MemberDepartmentDAO>,
    {} as Repository<MemberLimitDAO>,
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
      throw new Error('정의되지 않은 Repository입니다.');
    });
  });

  it('사용자가 실제 전송한 내·외부 LLM 프롬프트를 최신순으로 페이지 조회한다', async () => {
    promptLogRepository.findAndCount.mockResolvedValue([
      [
        {
          maskingReportId: 'masking-report-2',
          promptSummary: '내부 LLM 질문',
          communicatedAt: new Date('2026-08-02T12:00:00.000Z'),
          modelType: 'Local LLM',
          usage: null,
        },
        {
          maskingReportId: 'masking-report-1',
          promptSummary: '외부 LLM 질문',
          communicatedAt: new Date('2026-08-02T11:00:00.000Z'),
          modelType: 'GPT',
          usage: 4800,
        },
      ],
      12,
    ]);

    await expect(service.getUserPromptList(42, {
      pageSize: 10,
      pageNumber: 2,
    })).resolves.toEqual({
      data: [
        {
          promptId: 'masking-report-2',
          promptSummary: '내부 LLM 질문',
          promptedAt: '2026-08-02T12:00:00.000Z',
          model: 'Local LLM',
          usage: 0,
        },
        {
          promptId: 'masking-report-1',
          promptSummary: '외부 LLM 질문',
          promptedAt: '2026-08-02T11:00:00.000Z',
          model: 'GPT',
          usage: 4800,
        },
      ],
      totalCnt: 12,
      dataCnt: 2,
      pageNumber: 2,
    });
    expect(promptLogRepository.findAndCount).toHaveBeenCalledWith({
      select: {
        promptLogId: true,
        maskingReportId: true,
        promptSummary: true,
        communicatedAt: true,
        modelType: true,
        usage: true,
      },
      relations: { promptRoom: true },
      where: {
        status: expect.anything(),
        communicatedAt: expect.anything(),
        promptRoom: { memberId: '42' },
      },
      order: { communicatedAt: 'DESC', promptLogId: 'DESC' },
      take: 10,
      skip: 10,
    });
    const where = promptLogRepository.findAndCount.mock.calls[0]?.[0]?.where;
    expect(where.status.value).toBe(PromptLogStatus.MASKING);
  });

  it('전송 기록이 없으면 빈 목록을 반환한다', async () => {
    promptLogRepository.findAndCount.mockResolvedValue([[], 0]);

    await expect(service.getUserPromptList(42, {
      pageSize: 10,
      pageNumber: 1,
    })).resolves.toEqual({ data: [], totalCnt: 0, dataCnt: 0, pageNumber: 1 });
  });
});
