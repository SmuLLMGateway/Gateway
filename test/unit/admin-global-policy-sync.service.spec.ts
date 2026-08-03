import type { DataSource, EntityManager, Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { MaskingClass, PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { PresetDAO } from '../../src/domain/admin/dao/preset.dao.js';
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

describe('AdminService 전역 보안 정책 동기화', () => {
  const policyRepository = { find: jest.fn(), update: jest.fn() };
  const departmentPolicyRepository = { update: jest.fn() };
  const presetRepository = { create: jest.fn(), findOne: jest.fn(), save: jest.fn(), update: jest.fn() };
  const presetPolicyRepository = { delete: jest.fn(), save: jest.fn() };
  const memberRepository = { findOneBy: jest.fn() };
  const adminLogRepository = { save: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const service = new AdminService(
    dataSource as unknown as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    memberRepository as unknown as Repository<MemberDAO>,
    {} as Repository<DepartmentDAO>,
    {} as Repository<MemberDepartmentDAO>,
    {} as Repository<MemberLimitDAO>,
    {} as Repository<ActiveApiKeyDAO>,
    {} as Repository<DepartmentPolicyDAO>,
    policyRepository as unknown as Repository<PolicyDAO>,
    adminLogRepository as unknown as Repository<AdminLogDAO>,
    {} as Repository<HealthHistoryDAO>,
    {} as LlmApiKeyValidationClient,
    {} as ApiKeyEncryptionService,
    {} as MinioObjectStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation(async (work) =>
      work(manager as unknown as EntityManager));
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PolicyDAO) return policyRepository;
      if (entity === DepartmentPolicyDAO) return departmentPolicyRepository;
      if (entity === PresetDAO) return presetRepository;
      if (entity === PresetPolicyDAO) return presetPolicyRepository;
      if (entity === MemberDAO) return memberRepository;
      if (entity === AdminLogDAO) return adminLogRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
    memberRepository.findOneBy.mockResolvedValue({ memberName: '총관리자' });
  });

  it('전역 정책과 프리셋 매핑을 교체하고, 제외된 부서 정책은 비활성화한다', async () => {
    policyRepository.find
      .mockResolvedValueOnce([
        { policyId: '2', maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
        { policyId: '4', maskingContent: 'API_KEY', maskingClass: MaskingClass.PRIVATE },
      ]);
    presetRepository.findOne.mockResolvedValue(null);
    presetRepository.create.mockReturnValue({ name: '기본 정책', isActive: true });
    presetRepository.save.mockResolvedValue({ policyPresetId: '9', name: '기본 정책' });
    departmentPolicyRepository.update.mockResolvedValue({ affected: 2 });
    presetRepository.update.mockResolvedValue({ affected: 1 });
    presetPolicyRepository.delete.mockResolvedValue({ affected: 0 });
    presetPolicyRepository.save.mockResolvedValue([]);

    await expect(service.syncGlobalPolicies(
      { presetName: ' 기본 정책 ', policies: ['PHONE', 'API_KEY'] },
      { userId: 1, expiredAt: '', accessToken: true, role: UserRole.TOTAL_ADMIN },
    )).resolves.toEqual(['전화번호', 'API 키']);

    expect(policyRepository.update).not.toHaveBeenCalled();
    expect(departmentPolicyRepository.update).toHaveBeenNthCalledWith(
      1,
      { policyId: expect.anything(), isActive: true },
      { isActive: false },
    );
    expect(departmentPolicyRepository.update).toHaveBeenNthCalledWith(
      2,
      { policyId: expect.anything(), isActive: false },
      { isActive: true },
    );
    expect(presetPolicyRepository.delete).toHaveBeenCalledWith({ policyPresetId: '9' });
    expect(presetRepository.update).toHaveBeenCalledWith(
      { isActive: true },
      { isActive: false },
    );
    expect(presetRepository.create).toHaveBeenCalledWith({
      name: '기본 정책',
      isActive: true,
    });
    expect(presetPolicyRepository.save).toHaveBeenCalledWith([
      { policyPresetId: '9', policyId: '2' },
      { policyPresetId: '9', policyId: '4' },
    ]);
    expect(adminLogRepository.save).toHaveBeenCalledWith({
      logContent: '전역 보안 정책 프리셋 기본 정책을 동기화했습니다.',
      actionAt: expect.any(Date),
      actionMemberName: '총관리자',
    });
  });

  it('정책 목록 없이 기존 프리셋을 요청하면 프리셋 외 부서 정책은 비활성화하고 프리셋 정책만 활성화한다', async () => {
    presetRepository.findOne.mockResolvedValue({
      policyPresetId: '9',
      presetPolicies: [
        { policy: { policyId: '2', maskingContent: 'PHONE' } },
        { policy: { policyId: '4', maskingContent: 'API_KEY' } },
      ],
    });
    presetRepository.update.mockResolvedValue({ affected: 1 });
    departmentPolicyRepository.update.mockResolvedValue({ affected: 2 });

    await expect(service.syncGlobalPolicies(
      { presetName: '기본 정책' },
      { userId: 1, expiredAt: '', accessToken: true, role: UserRole.TOTAL_ADMIN },
    )).resolves.toEqual(['전화번호', 'API 키']);

    expect(presetRepository.update).toHaveBeenNthCalledWith(
      1,
      { isActive: true },
      { isActive: false },
    );
    expect(presetRepository.update).toHaveBeenNthCalledWith(
      2,
      { policyPresetId: '9' },
      { isActive: true },
    );
    expect(departmentPolicyRepository.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ isActive: true }),
      { isActive: false },
    );
    expect(departmentPolicyRepository.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ isActive: false }),
      { isActive: true },
    );
    expect(policyRepository.update).not.toHaveBeenCalled();
    expect(presetPolicyRepository.delete).not.toHaveBeenCalled();
    expect(adminLogRepository.save).toHaveBeenCalledWith({
      logContent: '전역 보안 정책 프리셋 기본 정책을 동기화했습니다.',
      actionAt: expect.any(Date),
      actionMemberName: '총관리자',
    });
  });
});
