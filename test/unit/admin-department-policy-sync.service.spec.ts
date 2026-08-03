import type { DataSource, EntityManager, Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { MaskingClass, PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { PresetPolicyDAO } from '../../src/domain/admin/dao/preset-policy.dao.js';
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
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

describe('AdminService 부서 정책 동기화', () => {
  const departmentRepository = { findOneBy: jest.fn() };
  const policyRepository = { find: jest.fn() };
  const departmentPolicyRepository = { update: jest.fn(), upsert: jest.fn() };
  const presetPolicyRepository = { find: jest.fn() };
  const memberRepository = { findOneBy: jest.fn() };
  const adminLogRepository = { save: jest.fn() };
  const lockedDepartmentRepository = { findOne: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const service = new AdminService(
    dataSource as unknown as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    {} as Repository<MemberDAO>,
    departmentRepository as unknown as Repository<DepartmentDAO>,
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
    departmentRepository.findOneBy.mockResolvedValue({
      departmentId: '4', departmentName: '정책기획팀',
    });
    lockedDepartmentRepository.findOne.mockResolvedValue({ departmentId: '4' });
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === DepartmentDAO) return lockedDepartmentRepository;
      if (entity === PolicyDAO) return policyRepository;
      if (entity === DepartmentPolicyDAO) return departmentPolicyRepository;
      if (entity === PresetPolicyDAO) return presetPolicyRepository;
      if (entity === MemberDAO) return memberRepository;
      if (entity === AdminLogDAO) return adminLogRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
    dataSource.transaction.mockImplementation(async (work) =>
      work(manager as unknown as EntityManager));
    memberRepository.findOneBy.mockResolvedValue({ memberName: '총괄관리자' });
    adminLogRepository.save.mockResolvedValue({});
    departmentPolicyRepository.update.mockResolvedValue({ affected: 1 });
    departmentPolicyRepository.upsert.mockResolvedValue({});
  });

  it('활성 프리셋에 없는 요청 정책은 무시하고 활성 정책만 적용한다', async () => {
    presetPolicyRepository.find.mockResolvedValue([
      {
        policyId: '2',
        policy: {
          policyId: '2', maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE,
        },
      },
    ]);
    policyRepository.find.mockResolvedValue([
      { policyId: '2', maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
    ]);

    await expect(service.syncPolicies(
      4,
      { policyName: '기본 정책', policies: ['PHONE', 'CARD'] },
      { userId: 1, expiredAt: '', accessToken: true, role: UserRole.TOTAL_ADMIN },
    )).resolves.toEqual({
      targetDepartment: '정책기획팀',
      policies: ['전화번호'],
    });
    expect(departmentPolicyRepository.upsert).toHaveBeenCalledWith([
      { departmentId: '4', policyId: '2', isActive: true },
    ], ['departmentId', 'policyId']);
    expect(presetPolicyRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        preset: { isActive: true },
      },
    }));
  });

  it('활성 프리셋에 없는 정책만 요청되면 부서 정책을 모두 비활성화한다', async () => {
    presetPolicyRepository.find.mockResolvedValue([]);
    policyRepository.find.mockResolvedValue([]);

    await expect(service.syncPolicies(
      4,
      { policyName: '기본 정책', policies: ['CARD'] },
      { userId: 1, expiredAt: '', accessToken: true, role: UserRole.TOTAL_ADMIN },
    )).resolves.toMatchObject({ policies: [] });
    expect(departmentPolicyRepository.upsert).not.toHaveBeenCalled();
    expect(departmentPolicyRepository.update).toHaveBeenCalledWith(
      { departmentId: '4' },
      { isActive: false },
    );
  });
});
