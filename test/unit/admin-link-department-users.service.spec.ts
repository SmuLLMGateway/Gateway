import type { DataSource, EntityManager, Repository } from 'typeorm';
import { AdminErrorStatus } from '../../src/domain/admin/code/admin.status.js';
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
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import { LOCAL_LLM_MODEL } from '../../src/global/llm/llm-service.mapping.js';

describe('AdminService 부서-사용자 연동', () => {
  const departmentRepository = { findOne: jest.fn() };
  const memberRepository = { find: jest.fn(), findOneBy: jest.fn() };
  const memberDepartmentRepository = { find: jest.fn(), save: jest.fn() };
  const memberLimitRepository = { upsert: jest.fn() };
  const activeApiKeyRepository = { find: jest.fn() };
  const adminLogRepository = { save: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const dataSource = { transaction: jest.fn() };

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
    dataSource.transaction.mockImplementation(async (work) =>
      work(manager as unknown as EntityManager));
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === DepartmentDAO) return departmentRepository;
      if (entity === MemberDAO) return memberRepository;
      if (entity === MemberDepartmentDAO) return memberDepartmentRepository;
      if (entity === MemberLimitDAO) return memberLimitRepository;
      if (entity === ActiveApiKeyDAO) return activeApiKeyRepository;
      if (entity === AdminLogDAO) return adminLogRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
    memberRepository.findOneBy.mockResolvedValue({ memberName: '총관리자' });
  });

  const authentication = {
    userId: 1,
    expiredAt: '',
    accessToken: true,
    role: UserRole.TOTAL_ADMIN,
  } as const;

  it('미소속 활성 사용자만 요청 순서대로 연동하고 반환한다', async () => {
    departmentRepository.findOne.mockResolvedValue({
      departmentId: '4',
      departmentName: '정책기획팀',
      limit: '300',
    });
    memberRepository.find.mockResolvedValue([
      { memberId: '25', memberName: '김보안' },
      { memberId: '23', memberName: '박안녕' },
    ]);
    memberDepartmentRepository.find
      .mockResolvedValueOnce([{ memberId: '24' }])
      .mockResolvedValueOnce([
        { memberId: '24' },
        { memberId: '23' },
        { memberId: '25' },
      ]);
    memberDepartmentRepository.save.mockResolvedValue([]);
    activeApiKeyRepository.find.mockResolvedValue([
      { activeApiKeyId: '10' },
      { activeApiKeyId: '11' },
    ]);

    await expect(service.linkDepartmentUsers(
      4,
      { userIds: [23, 24, 25] },
      authentication,
    ))
      .resolves.toEqual({
        departmentId: 4,
        departmentName: '정책기획팀',
        users: [
          { userId: 23, userName: '박안녕' },
          { userId: 25, userName: '김보안' },
        ],
      });
    expect(memberDepartmentRepository.save).toHaveBeenCalledWith([
      { memberId: '23', departmentId: '4' },
      { memberId: '25', departmentId: '4' },
    ]);
    expect(memberLimitRepository.upsert).toHaveBeenCalledWith([
      { memberId: '24', activeApiKeyId: '10', limit: '100' },
      { memberId: '24', activeApiKeyId: '11', limit: '100' },
      { memberId: '23', activeApiKeyId: '10', limit: '100' },
      { memberId: '23', activeApiKeyId: '11', limit: '100' },
      { memberId: '25', activeApiKeyId: '10', limit: '100' },
      { memberId: '25', activeApiKeyId: '11', limit: '100' },
    ], ['memberId', 'activeApiKeyId']);
    expect(departmentRepository.findOne).toHaveBeenCalledWith({
      select: { departmentId: true, departmentName: true, limit: true },
      where: { departmentId: '4' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(activeApiKeyRepository.find).toHaveBeenCalledWith({
      select: { activeApiKeyId: true },
      where: {
        departmentId: '4',
        serviceType: expect.objectContaining({
          value: LOCAL_LLM_MODEL,
        }),
      },
    });
    expect(adminLogRepository.save).toHaveBeenCalledWith({
      logContent: '정책기획팀 부서에 사용자 2명을 연동했습니다.',
      actionAt: expect.any(Date),
      actionMemberName: '총관리자',
    });
  });

  it('잘못된 사용자 ID 목록은 요청 전 거절한다', async () => {
    for (const userIds of [[], [0], [1.1], [1, 1], ['1']]) {
      await expect(service.linkDepartmentUsers(
        4,
        { userIds } as never,
        authentication,
      ))
        .rejects.toMatchObject({ baseStatus: AdminErrorStatus.INVALID_USER_IDS });
    }
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('연동 가능한 사용자가 없으면 오류를 반환한다', async () => {
    departmentRepository.findOne.mockResolvedValue({
      departmentId: '4',
      departmentName: '정책기획팀',
      limit: '300',
    });
    memberRepository.find.mockResolvedValue([{ memberId: '23', memberName: '박안녕' }]);
    memberDepartmentRepository.find.mockResolvedValue([{ memberId: '23' }]);

    await expect(service.linkDepartmentUsers(
      4,
      { userIds: [23] },
      authentication,
    ))
      .rejects.toMatchObject({ baseStatus: AdminErrorStatus.NO_LINKABLE_USERS });
    expect(memberDepartmentRepository.save).not.toHaveBeenCalled();
    expect(adminLogRepository.save).not.toHaveBeenCalled();
  });
});
