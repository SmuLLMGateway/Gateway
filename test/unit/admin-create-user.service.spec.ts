import type { DataSource, EntityManager, Repository } from 'typeorm';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

describe('AdminService 사용자 생성', () => {
  const memberRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const memberDepartmentRepository = { findOneBy: jest.fn(), save: jest.fn() };
  const adminLogRepository = { save: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const passwordEncoder = { encode: jest.fn() };
  const userMapper = {
    toMemberDAO: jest.fn(),
    toMemberDepartmentDAO: jest.fn(),
  };
  const service = new AdminService(
    dataSource as unknown as DataSource,
    passwordEncoder as unknown as PasswordEncoderService,
    userMapper as unknown as UserMapper,
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
    dataSource.transaction.mockImplementation(async (work) =>
      work(manager as unknown as EntityManager));
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === MemberDAO) return memberRepository;
      if (entity === MemberDepartmentDAO) return memberDepartmentRepository;
      if (entity === AdminLogDAO) return adminLogRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
  });

  it('총괄 관리자가 사용자를 생성하면 비밀번호를 해싱하고 생성 이력을 남긴다', async () => {
    memberRepository.findOne.mockResolvedValue(null);
    memberRepository.findOneBy.mockResolvedValue({
      memberId: '1',
      memberName: '총괄 관리자',
      authorize: UserRole.TOTAL_ADMIN,
      disabledAt: null,
    });
    passwordEncoder.encode.mockResolvedValue('encoded-password');
    userMapper.toMemberDAO.mockImplementation((data) => data);
    memberRepository.save.mockResolvedValue({
      memberId: '10',
      memberName: '김서윤',
    });

    await expect(service.createUser({
      name: '김서윤',
      email: 'seoyun@example.com',
      password: 'Gateway123!',
      authorize: UserRole.USER,
    }, {
      userId: 1,
      expiredAt: '',
      accessToken: true,
      role: UserRole.TOTAL_ADMIN,
    })).resolves.toEqual({ id: 10, name: '김서윤' });

    expect(passwordEncoder.encode).toHaveBeenCalledWith('Gateway123!');
    expect(memberRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      email: 'seoyun@example.com',
      password: 'encoded-password',
      authorize: UserRole.USER,
      disabledAt: null,
    }));
    expect(memberDepartmentRepository.save).not.toHaveBeenCalled();
    expect(adminLogRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      logContent: '김서윤 사용자 계정을 생성했습니다.',
      actionMemberName: '총괄 관리자',
    }));
  });
});
