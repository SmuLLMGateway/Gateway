import type { DataSource, Repository } from 'typeorm';
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
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

describe('AdminService 전체 채팅 기록 사용자 목록 조회', () => {
  const totalAdmin = {
    userId: 1,
    expiredAt: '',
    accessToken: true,
    role: UserRole.TOTAL_ADMIN,
  } as const;
  const departmentAdmin = {
    userId: 7,
    expiredAt: '',
    accessToken: true,
    role: UserRole.DEPART_ADMIN,
  } as const;
  const queryBuilder = {
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    clone: jest.fn(),
    getCount: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn(),
  };
  const memberRepository = { createQueryBuilder: jest.fn() };
  const memberDepartmentRepository = { findOne: jest.fn() };
  const memberLimitRepository = { find: jest.fn() };
  const service = new AdminService(
    {} as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    memberRepository as unknown as Repository<MemberDAO>,
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
    for (const method of [
      'innerJoin', 'where', 'andWhere', 'select', 'addSelect', 'orderBy',
      'addOrderBy', 'offset', 'limit',
    ] as const) {
      queryBuilder[method].mockReturnValue(queryBuilder);
    }
    queryBuilder.clone.mockReturnValue(queryBuilder);
    memberRepository.createQueryBuilder.mockReturnValue(queryBuilder);
  });

  it('검색된 사용자별로 개인 사용량과 한도 합계를 반환한다', async () => {
    queryBuilder.getCount.mockResolvedValue(2);
    queryBuilder.getRawMany.mockResolvedValue([
      { userId: '2', name: '김서윤', department: '정책기획팀' },
      { userId: '3', name: '이도윤', department: '정책기획팀' },
    ]);
    memberLimitRepository.find.mockResolvedValue([
      { memberId: '2', limit: '100', usage: '25' },
      { memberId: '2', limit: '200', usage: '50' },
      { memberId: '3', limit: '0', usage: '300' },
    ]);

    await expect(service.getUserPromptOverview({
      pageNumber: 1,
      pageSize: 10,
      query: '정책기획팀',
    }, totalAdmin)).resolves.toEqual({
      data: [
        { userId: 2, name: '김서윤', department: '정책기획팀', usage: 75, limit: 300 },
        { userId: 3, name: '이도윤', department: '정책기획팀', usage: 300, limit: 0 },
      ],
      totalCnt: 2,
      dataCnt: 2,
      pageNumber: 1,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(member.memberName LIKE :query OR department.departmentName LIKE :query)',
      { query: '%정책기획팀%' },
    );
    expect(memberLimitRepository.find).toHaveBeenCalledWith({
      select: { memberId: true, limit: true, usage: true },
      where: { memberId: expect.anything() },
      order: { memberId: 'ASC', memberLimitId: 'ASC' },
    });
  });

  it('검색 결과가 없으면 null을 반환한다', async () => {
    queryBuilder.getCount.mockResolvedValue(0);

    await expect(service.getUserPromptOverview({
      pageNumber: 1,
      pageSize: 10,
      query: '없는 사용자',
    }, totalAdmin)).resolves.toBeNull();
    expect(memberLimitRepository.find).not.toHaveBeenCalled();
  });

  it('부서 관리자의 전체 프롬프트 사용자 목록은 자신의 부서 일반 사용자만 조건에 포함한다', async () => {
    memberDepartmentRepository.findOne.mockResolvedValue({ departmentId: '7' });
    queryBuilder.getCount.mockResolvedValue(0);

    await expect(service.getUserPromptOverview({
      pageNumber: 1,
      pageSize: 10,
      query: '정책',
    }, departmentAdmin)).resolves.toBeNull();

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'membership.departmentId = :departmentId',
      { departmentId: '7' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'member.authorize = :normalUserRole',
      { normalUserRole: UserRole.USER },
    );
  });
});
