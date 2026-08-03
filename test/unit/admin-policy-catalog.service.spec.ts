import type { DataSource, Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { PresetDAO } from '../../src/domain/admin/dao/preset.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

describe('AdminService 보안 정책 목록 조회', () => {
  const presetRepository = { find: jest.fn() };
  const dataSource = {
    getRepository: jest.fn((target: unknown) => {
      if (target === PresetDAO) {
        return presetRepository;
      }
      throw new Error('Unexpected repository');
    }),
  };
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

  beforeEach(() => jest.clearAllMocks());

  it('활성 여부와 관계없이 모든 프리셋별 정책 한글 표시명을 반환한다', async () => {
    presetRepository.find.mockResolvedValue([
      {
        name: '기본 보안 정책',
        presetPolicies: [
          { policy: { maskingContent: 'API_KEY' } },
          { policy: { maskingContent: 'EMAIL' } },
        ],
      },
      {
        name: '이전 보안 정책',
        presetPolicies: [
          { policy: { maskingContent: 'PHONE' } },
        ],
      },
    ]);

    await expect(service.getPolicyCatalog()).resolves.toEqual([
      {
        presetName: '기본 보안 정책',
        policies: ['API 키', '이메일'],
      },
      {
        presetName: '이전 보안 정책',
        policies: ['전화번호'],
      },
    ]);
    expect(presetRepository.find).toHaveBeenCalledWith({
      select: {
        policyPresetId: true,
        name: true,
        presetPolicies: {
          presetPolicyId: true,
          policy: { policyId: true, maskingContent: true },
        },
      },
      relations: {
        presetPolicies: { policy: true },
      },
      order: {
        policyPresetId: 'ASC',
        presetPolicies: { policy: { policyId: 'ASC' } },
      },
    });
  });

  it('저장된 프리셋이 없으면 null을 반환한다', async () => {
    presetRepository.find.mockResolvedValue([]);

    await expect(service.getPolicyCatalog()).resolves.toBeNull();
  });
});
