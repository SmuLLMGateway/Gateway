import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AdminErrorStatus } from '../../src/domain/admin/code/admin.status.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { PasswordEncoderService } from '../../src/global/security/service/password-encoder.service.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

describe('AdminService 사용자 목록 조회', () => {
  const totalCountQuery = { getCount: jest.fn() };
  const filteredCountQuery = { getCount: jest.fn() };
  const queryBuilder = {
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    clone: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn(),
    setParameter: jest.fn(),
    getRawOne: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
  };
  const memberRepository = {
    createQueryBuilder: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
  const departmentRepository = {
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
  };
  const memberDepartmentRepository = {
    findOne: jest.fn(),
  };

  const service = new AdminService(
    {} as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    memberRepository as unknown as Repository<MemberDAO>,
    departmentRepository as unknown as Repository<DepartmentDAO>,
    memberDepartmentRepository as unknown as Repository<MemberDepartmentDAO>,
    {} as Repository<ActiveApiKeyDAO>,
    {} as Repository<PolicyDAO>,
    {} as LlmApiKeyValidationClient,
    {} as ApiKeyEncryptionService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of [
      'innerJoin',
      'leftJoin',
      'where',
      'andWhere',
      'select',
      'addSelect',
      'orderBy',
      'addOrderBy',
      'offset',
      'limit',
      'setParameter',
      'groupBy',
      'addGroupBy',
    ] as const) {
      queryBuilder[method].mockReturnValue(queryBuilder);
    }
    memberRepository.createQueryBuilder.mockReturnValue(
      queryBuilder as unknown as SelectQueryBuilder<MemberDAO>,
    );
    queryBuilder.clone
      .mockReturnValueOnce(totalCountQuery)
      .mockReturnValueOnce(filteredCountQuery);
    totalCountQuery.getCount.mockResolvedValue(3);
    filteredCountQuery.getCount.mockResolvedValue(1);
  });

  it('총괄 관리자는 이름이나 이메일을 검색하고 페이지 응답을 반환한다', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        userId: '12',
        name: '김서윤',
        email: 'seoyun@example.com',
        department: '정책기획팀',
        role: UserRole.USER,
        lastLoginAt: new Date('2026-07-19T21:49:17.000Z'),
        disabledAt: null,
      },
      {
        userId: '1',
        name: '총괄관리자',
        email: 'admin@example.com',
        department: '관리팀',
        role: UserRole.TOTAL_ADMIN,
        lastLoginAt: new Date('2026-07-19T20:00:00.000Z'),
        disabledAt: null,
      },
    ]);

    await expect(service.getUsers(
      { pageSize: 10, pageNumber: 1, query: '서윤' },
      {
        userId: 1,
        role: UserRole.TOTAL_ADMIN,
        expiredAt: '2026-07-25T00:00:00.000Z',
        accessToken: true,
      },
    )).resolves.toEqual({
      data: [
        {
          userId: 12,
          name: '김서윤',
          email: 'seoyun@example.com',
          department: '정책기획팀',
          authorize: '일반 사용자',
          lastLoginAt: '2026-07-19T21:49:17.000Z',
          status: '활성',
        },
        {
          userId: 1,
          name: '총괄관리자',
          email: 'admin@example.com',
          department: '관리팀',
          authorize: '총괄 관리자',
          lastLoginAt: '2026-07-19T20:00:00.000Z',
          status: '활성',
        },
      ],
      totalCnt: 3,
      dataCnt: 2,
      filteringCnt: 1,
      pageNumber: 1,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(member.memberName LIKE :query OR member.email LIKE :query)',
      { query: '%서윤%' },
    );
    expect(queryBuilder.offset).toHaveBeenCalledWith(0);
    expect(queryBuilder.limit).toHaveBeenCalledWith(10);
  });

  it('부서 관리자는 사용자 목록을 조회할 수 없다', async () => {
    await expect(service.getUsers(
      { pageSize: 20, pageNumber: 2, orderBy: 'status' },
      {
        userId: 2,
        role: UserRole.DEPART_ADMIN,
        expiredAt: '2026-07-25T00:00:00.000Z',
        accessToken: true,
      },
    )).rejects.toMatchObject({
      baseStatus: {
        code: 'AUTH403_1',
      },
    });
    expect(memberRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('페이지 조건이 유효하지 않으면 조회하지 않는다', async () => {
    await expect(service.getUsers(
      { pageSize: 0, pageNumber: 1 },
      {
        userId: 1,
        role: UserRole.TOTAL_ADMIN,
        expiredAt: '2026-07-25T00:00:00.000Z',
        accessToken: true,
      },
    )).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_USER_LIST_QUERY,
    });
    expect(memberRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('총괄 관리자의 사용자 계정 요약을 최근 7일 신규 계정과 함께 반환한다', async () => {
    jest.useFakeTimers().setSystemTime(
      new Date('2026-07-24T03:00:00.000Z'),
    );
    queryBuilder.getRawOne.mockResolvedValue({
      totalUserCnt: '132',
      activateUserCnt: '128',
      disabledUserCnt: '4',
      newUserCnt: '6',
    });

    await expect(service.getUserSummary({
      userId: 1,
      role: UserRole.TOTAL_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      updatedAt: '2026-07-24T03:00:00.000Z',
      totalUserCnt: 132,
      activateUserCnt: 128,
      disabledUserCnt: 4,
      newUserCnt: 6,
    });
    expect(queryBuilder.setParameter).toHaveBeenCalledWith(
      'newUserSince',
      new Date('2026-07-17T03:00:00.000Z'),
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('부서 관리자의 사용자 계정 요약은 자기 부서만 집계한다', async () => {
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '10',
    });
    departmentRepository.findOneBy.mockResolvedValue({
      departmentId: '10',
      departmentName: '정책기획팀',
    });
    queryBuilder.getRawOne.mockResolvedValue(undefined);

    await expect(service.getUserSummary({
      userId: 2,
      role: UserRole.DEPART_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).resolves.toMatchObject({
      totalUserCnt: 0,
      activateUserCnt: 0,
      disabledUserCnt: 0,
      newUserCnt: 0,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'membership.departmentId = :departmentId',
      { departmentId: '10' },
    );
  });

  it('사용자 기본 정보와 이용 통계를 상세 응답으로 반환한다', async () => {
    queryBuilder.getRawOne.mockResolvedValue({
      name: '김서윤',
      email: 'seoyun@example.com',
      department: '정책기획팀',
      role: UserRole.USER,
      createdAt: new Date('2026-07-19T12:34:56.000Z'),
      createdBy: '신정보',
      lastLoginAt: new Date('2026-07-23T22:00:50.000Z'),
      chatCnt: '42',
      filterDetectCnt: '17',
      masking: '31',
      local: '6',
    });

    await expect(service.getUserDetail(12, {
      userId: 1,
      role: UserRole.TOTAL_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      name: '김서윤',
      email: 'seoyun@example.com',
      department: '정책기획팀',
      role: '일반 사용자',
      createdAt: '2026-07-19',
      createdBy: '신정보',
      lastLoginAt: '2026-07-23T22:00:50.000Z',
      chatCnt: 42,
      filterDetectCnt: 17,
      masking: 31,
      local: 6,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'member.memberId = :userId',
      { userId: '12' },
    );
  });

  it('부서 관리자가 다른 부서 사용자를 조회하면 사용자 미존재로 처리한다', async () => {
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '10',
    });
    departmentRepository.findOneBy.mockResolvedValue({
      departmentId: '10',
      departmentName: '정책기획팀',
    });
    queryBuilder.getRawOne.mockResolvedValue(undefined);

    await expect(service.getUserDetail(99, {
      userId: 2,
      role: UserRole.DEPART_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).rejects.toMatchObject({
      baseStatus: {
        code: 'AUTH404_1',
      },
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'membership.departmentId = :departmentId',
      { departmentId: '10' },
    );
  });

  it('총괄 관리자가 활성 사용자 계정을 비활성화하고 세션을 해제한다', async () => {
    jest.useFakeTimers().setSystemTime(
      new Date('2026-07-24T04:00:00.000Z'),
    );
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '10',
    });
    memberRepository.findOneBy.mockResolvedValue({
      memberId: '12',
      memberName: '김서윤',
      authorize: UserRole.USER,
      disabledAt: null,
    });
    memberRepository.update.mockResolvedValue({ affected: 1 });

    await expect(service.disableUser(12, {
      userId: 1,
      role: UserRole.TOTAL_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      name: '김서윤',
      disabledAt: '2026-07-24T04:00:00.000Z',
    });
    expect(memberRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: '12' }),
      {
        disabledAt: new Date('2026-07-24T04:00:00.000Z'),
        refreshToken: null,
      },
    );

    jest.useRealTimers();
  });

  it('이미 비활성화된 계정은 저장하지 않고 기존 시각을 반환한다', async () => {
    const disabledAt = new Date('2026-07-20T04:00:00.000Z');
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '10',
    });
    memberRepository.findOneBy.mockResolvedValue({
      memberId: '12',
      memberName: '김서윤',
      authorize: UserRole.USER,
      disabledAt,
    });

    await expect(service.disableUser(12, {
      userId: 1,
      role: UserRole.TOTAL_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      name: '김서윤',
      disabledAt: disabledAt.toISOString(),
    });
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('비활성화된 사용자 계정을 복구한다', async () => {
    jest.useFakeTimers().setSystemTime(
      new Date('2026-07-24T05:00:00.000Z'),
    );
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '10',
    });
    memberRepository.findOneBy.mockResolvedValue({
      memberId: '12',
      memberName: '김서윤',
      authorize: UserRole.USER,
      disabledAt: new Date('2026-07-20T04:00:00.000Z'),
    });
    memberRepository.update.mockResolvedValue({ affected: 1 });

    await expect(service.restoreUser(12, {
      userId: 1,
      role: UserRole.TOTAL_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      name: '김서윤',
      restoredAt: '2026-07-24T05:00:00.000Z',
    });
    expect(memberRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: '12' }),
      { disabledAt: null },
    );

    jest.useRealTimers();
  });

  it('부서 관리자는 관리자 계정 상태를 변경할 수 없다', async () => {
    memberDepartmentRepository.findOne
      .mockResolvedValueOnce({ departmentId: '10' })
      .mockResolvedValueOnce({ departmentId: '10' });
    memberRepository.findOneBy.mockResolvedValue({
      memberId: '20',
      memberName: '부서관리자',
      authorize: UserRole.DEPART_ADMIN,
      disabledAt: null,
    });
    departmentRepository.findOneBy.mockResolvedValue({
      departmentId: '10',
      departmentName: '정책기획팀',
    });

    await expect(service.disableUser(20, {
      userId: 2,
      role: UserRole.DEPART_ADMIN,
      expiredAt: '2026-07-25T00:00:00.000Z',
      accessToken: true,
    })).rejects.toMatchObject({
      baseStatus: {
        code: 'AUTH403_1',
      },
    });
    expect(memberRepository.update).not.toHaveBeenCalled();
  });

  it('부서 목록을 이름순으로 페이지 조회한다', async () => {
    departmentRepository.findAndCount.mockResolvedValue([
      [
        { departmentId: '2', departmentName: '감사팀' },
        { departmentId: '7', departmentName: '정책기획팀' },
      ],
      20,
    ]);

    await expect(service.getDepartments({
      pageSize: 2,
      pageNumber: 3,
    })).resolves.toEqual({
      data: [
        { departmentId: 2, departmentName: '감사팀' },
        { departmentId: 7, departmentName: '정책기획팀' },
      ],
      totalCnt: 20,
      dataCnt: 2,
      pageNumber: 3,
    });
    expect(departmentRepository.findAndCount).toHaveBeenCalledWith({
      select: {
        departmentId: true,
        departmentName: true,
      },
      order: {
        departmentName: 'ASC',
        departmentId: 'ASC',
      },
      skip: 4,
      take: 2,
    });
  });

  it('부서 목록 페이지 조건이 유효하지 않으면 조회하지 않는다', async () => {
    await expect(service.getDepartments({
      pageSize: 101,
      pageNumber: 1,
    })).rejects.toMatchObject({
      baseStatus: {
        code: 'ADMIN400_11',
      },
    });
    expect(departmentRepository.findAndCount).not.toHaveBeenCalled();
  });
});
