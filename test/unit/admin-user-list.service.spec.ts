import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AdminErrorStatus } from '../../src/domain/admin/code/admin.status.js';
import { DepartmentDAO } from '../../src/domain/admin/dao/department.dao.js';
import { PolicyDAO } from '../../src/domain/admin/dao/policy.dao.js';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { DepartmentPolicyDAO } from '../../src/domain/admin/dao/department-policy.dao.js';
import { AdminLogDAO } from '../../src/domain/admin/dao/admin-log.dao.js';
import { HealthHistoryDAO } from '../../src/domain/admin/dao/health-history.dao.js';
import { AdminMapper } from '../../src/domain/admin/mapper/admin.mapper.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { MemberDAO } from '../../src/domain/user/dao/member.dao.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import { PromptLogStatus } from '../../src/domain/prompt/type/prompt-log-status.enum.js';
import type { UserMapper } from '../../src/domain/user/mapper/user.mapper.js';
import type { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import type { ApiKeyEncryptionService } from '../../src/global/llm/service/api-key-encryption.service.js';
import type { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
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
  const memberCountQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn(),
  };
  const policyCountQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn(),
  };
  const memberRepository = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
  const departmentRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const departmentRiskQueryBuilder = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    setParameter: jest.fn(),
    getRawMany: jest.fn(),
  };
  const memberDepartmentRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const memberLimitRepository = {
    find: jest.fn(),
  };
  const activeApiKeyRepository = {
    find: jest.fn(),
  };
  const departmentPolicyRepository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };
  const policyRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const policyDetectQueryBuilder = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getRawMany: jest.fn(),
  };
  const adminLogRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };
  const dashboardQueryBuilder = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    setParameters: jest.fn(),
    getRawOne: jest.fn(),
  };
  const promptLogRepository = {
    createQueryBuilder: jest.fn(),
  };
  const dataSource = {
    getRepository: jest.fn(),
  };

  const service = new AdminService(
    dataSource as unknown as DataSource,
    {} as PasswordEncoderService,
    {} as UserMapper,
    {} as AdminMapper,
    memberRepository as unknown as Repository<MemberDAO>,
    departmentRepository as unknown as Repository<DepartmentDAO>,
    memberDepartmentRepository as unknown as Repository<MemberDepartmentDAO>,
    memberLimitRepository as unknown as Repository<MemberLimitDAO>,
    activeApiKeyRepository as unknown as Repository<ActiveApiKeyDAO>,
    departmentPolicyRepository as unknown as Repository<DepartmentPolicyDAO>,
    policyRepository as unknown as Repository<PolicyDAO>,
    adminLogRepository as unknown as Repository<AdminLogDAO>,
    {} as Repository<HealthHistoryDAO>,
    {} as LlmApiKeyValidationClient,
    {} as ApiKeyEncryptionService,
    {} as MinioObjectStorageService,
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
    for (const method of ['leftJoin', 'select', 'addSelect', 'setParameters'] as const) {
      dashboardQueryBuilder[method].mockReturnValue(dashboardQueryBuilder);
    }
    promptLogRepository.createQueryBuilder.mockReturnValue(dashboardQueryBuilder);
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PromptLogDAO) {
        return promptLogRepository;
      }
      throw new Error('테스트에서 정의하지 않은 Repository입니다.');
    });
    dashboardQueryBuilder.getRawOne.mockResolvedValue({
      chatCnt: '0', chatRate: '0', filterDetect: '0', filterDetectRate: '0',
      maskingToGpt: '0', maskingToClaude: '0', maskingToGemini: '0',
      totalGpt: '0', totalClaude: '0', totalGemini: '0', local: '0',
      currentLocalCnt: '0', currentTotalCnt: '0',
      previousLocalCnt: '0', previousTotalCnt: '0',
    });
    memberRepository.createQueryBuilder.mockReturnValue(
      queryBuilder as unknown as SelectQueryBuilder<MemberDAO>,
    );
    queryBuilder.clone
      .mockReturnValueOnce(totalCountQuery)
      .mockReturnValueOnce(filteredCountQuery);
    totalCountQuery.getCount.mockResolvedValue(3);
    filteredCountQuery.getCount.mockResolvedValue(1);

    for (const countQueryBuilder of [
      memberCountQueryBuilder,
      policyCountQueryBuilder,
    ]) {
      countQueryBuilder.select.mockReturnValue(countQueryBuilder);
      countQueryBuilder.addSelect.mockReturnValue(countQueryBuilder);
      countQueryBuilder.where.mockReturnValue(countQueryBuilder);
      countQueryBuilder.groupBy.mockReturnValue(countQueryBuilder);
    }
    policyCountQueryBuilder.andWhere.mockReturnValue(policyCountQueryBuilder);
    memberDepartmentRepository.createQueryBuilder.mockReturnValue(
      memberCountQueryBuilder as unknown as SelectQueryBuilder<MemberDepartmentDAO>,
    );
    departmentPolicyRepository.createQueryBuilder.mockReturnValue(
      policyCountQueryBuilder as unknown as SelectQueryBuilder<DepartmentPolicyDAO>,
    );
    memberCountQueryBuilder.getRawMany.mockResolvedValue([]);
    policyCountQueryBuilder.getRawMany.mockResolvedValue([]);
    activeApiKeyRepository.find.mockResolvedValue([]);
    departmentPolicyRepository.find.mockResolvedValue([]);
    memberLimitRepository.find.mockResolvedValue([]);
    policyRepository.find.mockResolvedValue([]);
    for (const method of [
      'leftJoin', 'select', 'addSelect', 'groupBy', 'addGroupBy', 'orderBy', 'addOrderBy',
    ] as const) {
      policyDetectQueryBuilder[method].mockReturnValue(policyDetectQueryBuilder);
    }
    policyDetectQueryBuilder.getRawMany.mockResolvedValue([]);
    policyRepository.createQueryBuilder.mockReturnValue(policyDetectQueryBuilder);
    for (const method of [
      'leftJoin', 'select', 'addSelect', 'groupBy', 'addGroupBy', 'orderBy', 'addOrderBy', 'setParameter',
    ] as const) {
      departmentRiskQueryBuilder[method].mockReturnValue(departmentRiskQueryBuilder);
    }
    departmentRiskQueryBuilder.getRawMany.mockResolvedValue([]);
    departmentRepository.createQueryBuilder.mockReturnValue(departmentRiskQueryBuilder);
    adminLogRepository.find.mockResolvedValue([]);
    adminLogRepository.save.mockResolvedValue({});
    departmentRepository.find.mockResolvedValue([]);
    memberRepository.count.mockResolvedValue(0);
  });

  it('총괄 관리자는 이름이나 이메일을 검색하고 페이지 응답을 반환한다', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        userId: '12',
        name: '김서윤',
        email: 'seoyun@example.com',
        department: '정책기획팀',
        authorize: UserRole.USER,
        disabledAt: null,
      },
      {
        userId: '1',
        name: '총괄관리자',
        email: 'admin@example.com',
        department: null,
        authorize: UserRole.TOTAL_ADMIN,
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
          status: '활성',
        },
        {
          userId: 1,
          name: '총괄관리자',
          email: 'admin@example.com',
          department: null,
          authorize: '총 관리자',
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
    expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
      MemberDepartmentDAO,
      'membership',
      'membership.memberId = member.memberId',
    );
    expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
      DepartmentDAO,
      'department',
      'department.departmentId = membership.departmentId',
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

  it('사용자 목록의 null 페이지 번호는 첫 페이지로 조회한다', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await expect(service.getUsers(
      { pageSize: 10, pageNumber: 'null' as unknown as number },
      {
        userId: 1,
        role: UserRole.TOTAL_ADMIN,
        expiredAt: '2026-07-25T00:00:00.000Z',
        accessToken: true,
      },
    )).resolves.toMatchObject({ pageNumber: 1 });

    expect(queryBuilder.offset).toHaveBeenCalledWith(0);
    expect(queryBuilder.limit).toHaveBeenCalledWith(10);
  });

  it('총괄 관리자의 사용자 계정 요약을 이번 달 신규 계정과 함께 반환한다', async () => {
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
      updatedAt: '2026-07-24T12:00:00.000+09:00',
      totalUserCnt: 132,
      activateUserCnt: 128,
      disabledUserCnt: 4,
      newUserCnt: 6,
    });
    expect(queryBuilder.setParameter).toHaveBeenCalledWith(
      'newUserSince',
      new Date('2026-07-01T00:00:00.000Z'),
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

  it('운영 현황을 프롬프트별 필터 감지 기준으로 중복 없이 집계한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-26T00:00:00.000Z'));
    memberRepository.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(9);
    dashboardQueryBuilder.getRawOne.mockResolvedValueOnce({
      chatCnt: '400', chatRate: '80', filterDetect: '55', filterDetectRate: '12',
      maskingToGpt: '20', maskingToClaude: '15', maskingToGemini: '10',
      totalGpt: '120', totalClaude: '90', totalGemini: '70', local: '75',
      currentLocalCnt: '12', currentTotalCnt: '80',
      previousLocalCnt: '6', previousTotalCnt: '80',
    });

    await expect(service.getDashboard()).resolves.toEqual({
      updatedAt: '2026-07-26T09:00:00.000+09:00',
      userCnt: 120,
      userRate: 9,
      chatCnt: 400,
      chatRate: 80,
      filterDetect: 55,
      filterDetectRate: 12,
      maskingToGpt: 20,
      maskingToClaude: 15,
      maskingToGemini: 10,
      totalGpt: 120,
      totalClaude: 90,
      totalGemini: 70,
      local: 75,
      localRate: 7.5,
    });
    expect(dashboardQueryBuilder.leftJoin).toHaveBeenCalledWith(
      MaskingDetailDAO,
      'maskingDetail',
      'maskingDetail.maskingReportId = promptLog.maskingReportId',
    );
    expect(dashboardQueryBuilder.setParameters).toHaveBeenCalledWith({
      recentSince: new Date('2026-06-26T00:00:00.000Z'),
      previousSince: new Date('2026-05-27T00:00:00.000Z'),
      errorStatus: PromptLogStatus.ERROR,
    });
    expect(dashboardQueryBuilder.addSelect).toHaveBeenCalledWith(
      "COUNT(DISTINCT CASE WHEN maskingDetail.maskingDetailId IS NOT NULL AND promptLog.status != :errorStatus AND LOWER(promptLog.modelType) LIKE 'gpt%' THEN promptLog.promptLogId END)",
      'maskingToGpt',
    );
    jest.useRealTimers();
  });

  it('최근 관리자 활동을 최신 활동순으로 응답 필드에 매핑한다', async () => {
    adminLogRepository.find.mockResolvedValue([
      {
        adminLogId: '8',
        logContent: '정책기획팀 보안 정책을 수정했습니다.',
        actionAt: new Date('2026-07-26T01:02:03.000Z'),
        actionMemberName: '총괄관리자',
      },
    ]);

    await expect(service.getAdminLogs()).resolves.toEqual([
      {
        title: '정책기획팀 보안 정책을 수정했습니다.',
        activityAt: '2026-07-26T10:02:03.000+09:00',
        adminName: '총괄관리자',
      },
    ]);
    expect(adminLogRepository.find).toHaveBeenCalledWith({
      select: {
        adminLogId: true,
        logContent: true,
        actionAt: true,
        actionMemberName: true,
      },
      order: { actionAt: 'DESC', adminLogId: 'DESC' },
    });
  });

  it('관리자 활동이 없으면 빈 배열 대신 null을 반환한다', async () => {
    adminLogRepository.find.mockResolvedValue([]);

    await expect(service.getAdminLogs()).resolves.toBeNull();
  });

  it('모든 보안 정책의 프롬프트 기준 감지 건수를 반환한다', async () => {
    policyDetectQueryBuilder.getRawMany.mockResolvedValue([
      { category: 'PRIVATE', detailCategory: 'PHONE', count: '7' },
      { category: 'SENSITIVE', detailCategory: 'SECURITY_INFRA', count: '0' },
    ]);

    await expect(service.getPolicyDetect()).resolves.toEqual([
      { category: '개인정보', detailCategory: '전화번호', count: 7 },
      { category: '민감정보', detailCategory: '보안 인프라 정보', count: 0 },
    ]);
    expect(policyDetectQueryBuilder.leftJoin).toHaveBeenCalledWith(
      PromptLogDAO,
      'promptLog',
      'promptLog.maskingReportId = maskingDetail.maskingReportId',
    );
  });

  it('기간별 부서 위험 분포를 프롬프트 기준 탐지 비율로 반환한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T00:00:00.000Z'));
    departmentRiskQueryBuilder.getRawMany.mockResolvedValue([
      { departmentName: '감사팀', llmRequestCnt: '10', userCnt: '4', detectCnt: '3' },
      { departmentName: '정책기획팀', llmRequestCnt: '0', userCnt: '2', detectCnt: '0' },
    ]);

    await expect(service.getDepartmentRisks({ recent: '7d' })).resolves.toEqual([
      { departmentName: '감사팀', llmRequestCnt: 10, userCnt: 4, detectRate: 30 },
      { departmentName: '정책기획팀', llmRequestCnt: 0, userCnt: 2, detectRate: 0 },
    ]);
    expect(departmentRiskQueryBuilder.setParameter).toHaveBeenCalledWith(
      'since',
      new Date('2026-07-20T00:00:00.000Z'),
    );
    jest.useRealTimers();
  });

  it('사용자 기본 정보와 이용 통계를 상세 응답으로 반환한다', async () => {
    queryBuilder.getRawOne.mockResolvedValue({
      name: '김서윤',
      email: 'seoyun@example.com',
      department: '정책기획팀',
      role: UserRole.USER,
      createdAt: new Date('2026-07-19T12:34:56.000Z'),
      createdBy: '신정보',
      chatCnt: '42',
      filterDetectCnt: '17',
      masking: '31',
      local: '6',
    });
    memberLimitRepository.find.mockResolvedValue([
      { limit: '100', usage: '40' },
      { limit: '0', usage: '2' },
    ]);

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
      createdAt: '2026-07-19T21:34:56.000+09:00',
      createdBy: '신정보',
      limit: 0,
      usage: 42,
      chatCnt: 42,
      filterDetectCnt: 17,
      masking: 31,
      local: 6,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'member.memberId = :userId',
      { userId: '12' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'member.disabledAt IS NULL',
    );
    expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
      PromptLogDAO,
      'promptLog',
      'promptLog.promptRoomId = promptRoom.promptRoomId AND promptLog.communicatedAt IS NOT NULL',
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

  it('총괄 관리자가 부서 미소속 활성 사용자 계정을 비활성화하고 세션을 해제한다', async () => {
    jest.useFakeTimers().setSystemTime(
      new Date('2026-07-24T04:00:00.000Z'),
    );
    memberDepartmentRepository.findOne.mockResolvedValue(null);
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
      disabledAt: '2026-07-24T13:00:00.000+09:00',
    });
    expect(memberRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: '12' }),
      {
        disabledAt: new Date('2026-07-24T04:00:00.000Z'),
        refreshToken: null,
      },
    );
    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();

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
      disabledAt: '2026-07-20T13:00:00.000+09:00',
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
      restoredAt: '2026-07-24T14:00:00.000+09:00',
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
        {
          departmentId: '2',
          departmentName: '감사팀',
          limit: '200000',
          usage: '118000',
          mustFiltering: true,
        },
        {
          departmentId: '7',
          departmentName: '정책기획팀',
          limit: '0',
          usage: '500',
          mustFiltering: false,
        },
      ],
      20,
    ]);
    memberCountQueryBuilder.getRawMany.mockResolvedValue([
      { departmentId: '2', departmentUserCnt: '119' },
    ]);
    activeApiKeyRepository.find.mockResolvedValue([
      {
        departmentId: '2',
        serviceType: 'GPT',
      },
      {
        departmentId: '7',
        serviceType: 'Claude',
      },
      {
        departmentId: '7',
        serviceType: 'Gemini',
      },
    ]);
    policyCountQueryBuilder.getRawMany.mockResolvedValue([
      { departmentId: '2', policyCnt: '16' },
      { departmentId: '7', policyCnt: '5' },
    ]);

    await expect(service.getDepartments({
      pageSize: 2,
      pageNumber: 3,
    })).resolves.toEqual({
      data: [
        {
          departmentId: 2,
          departmentName: '감사팀',
          departmentUserCnt: 119,
          canUseLLMModel: ['Local LLM', 'GPT'],
          policyType: '표준',
          policyCnt: 16,
          outbound: '허용',
          departLimitPercent: 59,
          departLimitUsd: 200000,
          departUseUsd: 118000,
        },
        {
          departmentId: 7,
          departmentName: '정책기획팀',
          departmentUserCnt: 0,
          canUseLLMModel: ['Local LLM', 'Gemini', 'Claude'],
          policyType: '커스텀',
          policyCnt: 5,
          outbound: '불가',
          departLimitPercent: 100,
          departLimitUsd: 0,
          departUseUsd: 500,
        },
      ],
      totalCnt: 20,
      dataCnt: 2,
      pageNumber: 3,
    });
    expect(departmentRepository.findAndCount).toHaveBeenCalledWith({
      select: {
        departmentId: true,
        departmentName: true,
        mustFiltering: true,
        limit: true,
        usage: true,
      },
      order: {
        departmentName: 'ASC',
        departmentId: 'ASC',
      },
      skip: 4,
      take: 2,
    });
    expect(memberCountQueryBuilder.where).toHaveBeenCalledWith(
      'memberDepartment.departmentId IN (:...departmentIds)',
      { departmentIds: ['2', '7'] },
    );
    expect(policyCountQueryBuilder.andWhere).toHaveBeenCalledWith(
      'departmentPolicy.isActive = :isActive',
      { isActive: true },
    );
    expect(activeApiKeyRepository.find).toHaveBeenCalledWith({
      select: {
        departmentId: true,
        serviceType: true,
      },
      where: { departmentId: expect.anything() },
      order: { serviceType: 'ASC' },
    });
  });

  it('부서명을 대소문자 구분 없이 검색하고 검색 결과 기준으로 페이지를 계산한다', async () => {
    departmentRepository.findAndCount.mockResolvedValue([
      [
        {
          departmentId: '12',
          departmentName: 'Security Operations',
          limit: '0',
          usage: '0',
          mustFiltering: true,
        },
      ],
      3,
    ]);

    await expect(service.getDepartments({
      pageSize: 2,
      pageNumber: 2,
      query: '  SeCuRiTy  ',
    })).resolves.toEqual({
      data: [
        {
          departmentId: 12,
          departmentName: 'Security Operations',
          departmentUserCnt: 0,
          canUseLLMModel: ['Local LLM'],
          policyType: '커스텀',
          policyCnt: 0,
          outbound: '허용',
          departLimitPercent: 100,
          departLimitUsd: 0,
          departUseUsd: 0,
        },
      ],
      totalCnt: 3,
      dataCnt: 1,
      pageNumber: 2,
    });

    const findOptions = departmentRepository.findAndCount.mock.calls[0]?.[0] as {
      where?: {
        departmentName?: {
          type: string;
          objectLiteralParameters?: Record<string, string>;
          getSql: (columnAlias: string) => string;
        };
      };
      skip?: number;
      take?: number;
    };
    const departmentName = findOptions.where?.departmentName;

    expect(findOptions).toMatchObject({
      select: {
        departmentId: true,
        departmentName: true,
        mustFiltering: true,
        limit: true,
        usage: true,
      },
      order: {
        departmentName: 'ASC',
        departmentId: 'ASC',
      },
      skip: 2,
      take: 2,
    });
    expect(departmentName?.type).toBe('raw');
    expect(departmentName?.objectLiteralParameters).toEqual({
      departmentName: '%security%',
    });
    expect(departmentName?.getSql('department.department_name')).toBe(
      'LOWER(department.department_name) LIKE :departmentName',
    );
  });

  it('부서명 검색어의 LIKE 와일드카드를 이스케이프한다', async () => {
    departmentRepository.findAndCount.mockResolvedValue([[], 0]);

    await service.getDepartments({
      pageSize: 10,
      pageNumber: 1,
      query: 'A%_\\B',
    });

    const findOptions = departmentRepository.findAndCount.mock.calls[0]?.[0] as {
      where?: {
        departmentName?: {
          objectLiteralParameters?: Record<string, string>;
        };
      };
    };
    expect(findOptions.where?.departmentName?.objectLiteralParameters).toEqual({
      departmentName: '%a\\%\\_\\\\b%',
    });
  });

  it('조회할 부서 데이터가 없으면 목록 페이지 대신 null을 반환한다', async () => {
    departmentRepository.findAndCount.mockResolvedValue([[], 0]);

    await expect(service.getDepartments({
      pageSize: 10,
      pageNumber: 1,
    })).resolves.toBeNull();
    expect(memberDepartmentRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(activeApiKeyRepository.find).not.toHaveBeenCalled();
    expect(departmentPolicyRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('부서·사용자·부서 사용량을 집계해 부서 관리 요약을 반환한다', async () => {
    departmentRepository.find.mockResolvedValue([
      {
        departmentId: '2',
        mustFiltering: false,
        limit: '100',
        usage: '25',
        recentUsePercent: '20',
      },
      {
        departmentId: '7',
        mustFiltering: true,
        limit: '100',
        usage: '50',
        recentUsePercent: '50',
      },
      {
        departmentId: '9',
        mustFiltering: false,
        limit: '0',
        usage: '10',
        recentUsePercent: '80',
      },
    ]);
    memberRepository.count.mockResolvedValue(102);

    const result = await service.getDepartmentManagementSummary();

    expect(result).toEqual({
      updatedAt: expect.any(String),
      totalDepartmentCnt: 3,
      totalUserCnt: 102,
      outboundDepartmentCnt: 2,
      averageUsePercent: 58.3,
      averageRate: 8.3,
    });
    expect(Date.parse(result.updatedAt)).not.toBeNaN();
    expect(departmentRepository.find).toHaveBeenCalledWith({
      select: {
        departmentId: true,
        mustFiltering: true,
        limit: true,
        usage: true,
        recentUsePercent: true,
      },
    });
  });

  it('직전 평균 사용률이 0이면 현재 평균 사용률만큼 증감값을 반환한다', async () => {
    departmentRepository.find.mockResolvedValue([
      {
        departmentId: '2',
        mustFiltering: true,
        limit: '100',
        usage: '50',
        recentUsePercent: '0',
      },
    ]);
    memberRepository.count.mockResolvedValue(1);

    await expect(service.getDepartmentManagementSummary()).resolves
      .toMatchObject({
        averageUsePercent: 50,
        averageRate: 50,
      });
  });

  it('현재 평균 사용률이 직전 평균보다 낮으면 음수 증감값을 반환한다', async () => {
    departmentRepository.find.mockResolvedValue([
      {
        departmentId: '2',
        mustFiltering: true,
        limit: '100',
        usage: '50',
        recentUsePercent: '75',
      },
    ]);
    memberRepository.count.mockResolvedValue(1);

    await expect(service.getDepartmentManagementSummary()).resolves
      .toMatchObject({
        averageUsePercent: 50,
        averageRate: -25,
      });
  });

  it('부서 관리자·일반 사용자·서비스 사용량·활성 정책을 상세 응답으로 반환한다', async () => {
    departmentRepository.findOneBy.mockResolvedValue({
      departmentId: '10',
      departmentName: '정책기획팀',
      limit: '100',
      usage: '75',
      mustFiltering: true,
    });
    queryBuilder.getRawOne
      .mockResolvedValueOnce({
        name: '장우진',
        role: '감사담당관',
        authorize: UserRole.DEPART_ADMIN,
        email: 'woojin@example.com',
      })
      .mockResolvedValueOnce({ userCnt: '9' });
    activeApiKeyRepository.find.mockResolvedValue([
      { serviceType: 'GPT' },
      { serviceType: 'Claude' },
      { serviceType: 'Gemini' },
    ]);
    departmentPolicyRepository.find.mockResolvedValue([
      {
        departmentPolicyId: '3',
        isActive: true,
        policy: {
          policyId: '3',
          maskingContent: 'PHONE',
          maskingClass: 'PRIVATE',
        },
      },
      {
        departmentPolicyId: '8',
        isActive: true,
        policy: {
          policyId: '8',
          maskingContent: 'API_KEY',
          maskingClass: 'PRIVATE',
        },
      },
    ]);

    await expect(service.getDepartmentDetail(10)).resolves.toEqual({
      departmentName: '정책기획팀',
      departmentAdminName: '장우진',
      departmentAdminAuthorize: '부서 관리자',
      email: 'woojin@example.com',
      userCnt: 9,
      usePercent: 75,
      useUsd: 75,
      limitUsd: 100,
      remainUsd: 25,
      llmModel: [
        { modelName: 'Local LLM', hasApiKey: true },
        { modelName: 'Gemini', hasApiKey: true },
        { modelName: 'GPT', hasApiKey: true },
        { modelName: 'Claude', hasApiKey: true },
      ],
      mustFiltering: true,
      policies: [
        {
          policyId: 3,
          maskingContent: '전화번호',
          maskingClass: '개인 정보',
          isActive: true,
        },
        {
          policyId: 8,
          maskingContent: 'API 키',
          maskingClass: '개인 정보',
          isActive: true,
        },
      ],
    });
    expect(departmentPolicyRepository.find).toHaveBeenCalledWith({
      select: {
        departmentPolicyId: true,
        isActive: true,
        policy: {
          policyId: true,
          maskingContent: true,
          maskingClass: true,
        },
      },
      relations: { policy: true },
      where: {
        departmentId: '10',
      },
      order: {
        policy: { policyId: 'ASC' },
        departmentPolicyId: 'ASC',
      },
    });
  });

  it('부서 관리자가 없으면 관리자 관련 필드를 null로 반환한다', async () => {
    departmentRepository.findOneBy.mockResolvedValue({
      departmentId: '10',
      departmentName: '정책기획팀',
      limit: '0',
      usage: '0',
      mustFiltering: false,
    });
    queryBuilder.getRawOne
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ userCnt: '0' });

    await expect(service.getDepartmentDetail(10)).resolves.toMatchObject({
      departmentAdminName: null,
      departmentAdminAuthorize: null,
      email: null,
      userCnt: 0,
      llmModel: [{ modelName: 'Local LLM', hasApiKey: true }],
      mustFiltering: false,
      policies: null,
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

  it('부서 목록의 null 페이지 번호는 첫 페이지로 조회한다', async () => {
    departmentRepository.findAndCount.mockResolvedValue([[], 0]);

    await expect(service.getDepartments({
      pageSize: 10,
      pageNumber: 'null' as unknown as number,
    })).resolves.toBeNull();

    expect(departmentRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it.each([
    { caseName: '공백 검색어', query: '   ' },
    { caseName: '256자 검색어', query: 'a'.repeat(256) },
  ])('$caseName는 조회하지 않고 거부한다', async ({ query }) => {
    await expect(service.getDepartments({
      pageSize: 10,
      pageNumber: 1,
      query,
    })).rejects.toMatchObject({
      baseStatus: AdminErrorStatus.INVALID_DEPARTMENT_LIST_QUERY,
    });
    expect(departmentRepository.findAndCount).not.toHaveBeenCalled();
  });
});
