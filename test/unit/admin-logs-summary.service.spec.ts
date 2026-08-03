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

describe('AdminService 전체 채팅 기록 요약 조회', () => {
  const queryBuilder = {
    leftJoin: jest.fn(),
    where: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    getRawOne: jest.fn(),
  };
  const promptLogRepository = { createQueryBuilder: jest.fn() };
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
    for (const method of ['leftJoin', 'where', 'select', 'addSelect'] as const) {
      queryBuilder[method].mockReturnValue(queryBuilder);
    }
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PromptLogDAO) return promptLogRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
    promptLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);
  });

  it('MASKING 상태를 제외하고 프롬프트별 감지를 중복 없이 집계한다', async () => {
    queryBuilder.getRawOne.mockResolvedValue({
      totalChatCnt: '10',
      filterDetectCnt: '4',
      masking: '3',
      local: '2',
    });

    await expect(service.getLogsSummary()).resolves.toMatchObject({
      totalChatCnt: 10,
      filterDetectCnt: 4,
      masking: 3,
      local: 2,
      localRate: 50,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'promptLog.status != :maskingStatus',
      { maskingStatus: PromptLogStatus.MASKING },
    );
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'COUNT(DISTINCT promptLog.promptLogId)',
      'totalChatCnt',
    );
  });

  it('정책 감지 건수가 없으면 localRate는 0이다', async () => {
    queryBuilder.getRawOne.mockResolvedValue({
      totalChatCnt: '3',
      filterDetectCnt: '0',
      masking: '0',
      local: '1',
    });

    await expect(service.getLogsSummary()).resolves.toMatchObject({ localRate: 0 });
  });
});
