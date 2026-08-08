import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import { UserErrorStatus } from '../../src/domain/user/code/user.status.js';
import { UserService } from '../../src/domain/user/service/user.service.js';

describe('UserService.getUserInfo', () => {
  const memberRepository = { findOneBy: jest.fn() };
  const memberDepartmentRepository = { findOne: jest.fn() };
  const departmentRepository = { findOneBy: jest.fn() };
  const memberLimitRepository = { find: jest.fn() };
  const promptLogRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const maskingDetailRepository = { find: jest.fn() };
  const summaryQueryBuilder = {
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    take: jest.fn(),
    skip: jest.fn(),
    getRawOne: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const service = new UserService(
    memberRepository as never,
    memberDepartmentRepository as never,
    departmentRepository as never,
    memberLimitRepository as never,
    promptLogRepository as never,
    maskingDetailRepository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    memberRepository.findOneBy.mockResolvedValue({
      email: 'user@example.com',
      memberName: '홍길동',
      authorize: UserRole.USER,
    });
    memberDepartmentRepository.findOne.mockResolvedValue({ departmentId: '7' });
    departmentRepository.findOneBy.mockResolvedValue({
      departmentName: '개발팀',
      usage: '24.5',
    });
    memberLimitRepository.find.mockResolvedValue([{ usage: '12.5' }, { usage: '3.5' }]);
    promptLogRepository.find.mockResolvedValue([
      { promptLogId: '1', maskingReportId: 'report-1' },
      { promptLogId: '2', maskingReportId: 'report-2' },
    ]);
    maskingDetailRepository.find.mockResolvedValue([
      { maskingReportId: 'report-1' },
      { maskingReportId: 'report-1' },
    ]);
    promptLogRepository.createQueryBuilder.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.innerJoin.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.leftJoin.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.where.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.andWhere.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.select.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.addSelect.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.orderBy.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.addOrderBy.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.take.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.skip.mockReturnValue(summaryQueryBuilder);
    summaryQueryBuilder.getRawOne.mockResolvedValue({
      totalChatCnt: '10',
      filter: '3',
      masking: '2',
      local: '4',
    });
    summaryQueryBuilder.getManyAndCount.mockResolvedValue([[
      {
        promptLogId: '101',
        promptSummary: '계약서 검토 요청',
        communicatedAt: new Date('2026-07-27T01:00:00.000Z'),
        modelType: 'GPT',
        activeApiKey: { serviceType: 'GPT' },
        maskingReportId: 'report-1',
      },
      {
        promptLogId: '102',
        promptSummary: '로컬 요약 요청',
        communicatedAt: new Date('2026-07-26T01:00:00.000Z'),
        modelType: 'Local LLM',
        activeApiKey: null,
        maskingReportId: 'report-2',
      },
    ], 2]);
  });

  it('토큰 사용자의 이번 달 탐지 수와 개인·부서 사용량 합계를 반환한다', async () => {
    await expect(service.getUserInfo({
      userId: 42,
      role: UserRole.USER,
      expiredAt: '2026-07-27T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      email: 'user@example.com',
      name: '홍길동',
      department: '개발팀',
      authorize: '일반 사용자',
      filter: 1,
      personalLimitRate: 16,
      departmentLimitRate: 24.5,
    });

    expect(memberLimitRepository.find).toHaveBeenCalledWith({
      select: { usage: true },
      where: { memberId: '42' },
    });
    expect(departmentRepository.findOneBy).toHaveBeenCalledWith({
      departmentId: '7',
    });
    expect(maskingDetailRepository.find).toHaveBeenCalledWith({
      select: { maskingReportId: true },
      where: { maskingReportId: expect.anything() },
    });
  });

  it('부서 미소속 총 관리자는 사용자 정보를 정상 반환한다', async () => {
    memberRepository.findOneBy.mockResolvedValue({
      email: 'total-admin@example.com',
      memberName: '총관리자',
      authorize: UserRole.TOTAL_ADMIN,
    });
    memberDepartmentRepository.findOne.mockResolvedValue(null);
    memberLimitRepository.find.mockResolvedValue([]);
    promptLogRepository.find.mockResolvedValue([]);

    await expect(service.getUserInfo({
      userId: 1,
      role: UserRole.TOTAL_ADMIN,
      expiredAt: '2026-07-27T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      email: 'total-admin@example.com',
      name: '총관리자',
      department: null,
      authorize: '총 관리자',
      filter: 0,
      personalLimitRate: 0,
      departmentLimitRate: 0,
    });
    expect(departmentRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('전송된 프롬프트의 탐지·외부 마스킹·로컬 전송 수와 비율을 반환한다', async () => {
    const result = await service.getMessageSummary({
      userId: 42,
      role: UserRole.USER,
      expiredAt: '2026-07-27T00:00:00.000Z',
      accessToken: true,
    });

    expect(result).toMatchObject({
      totalChatCnt: 10,
      filter: 3,
      filterPercent: 30,
      masking: 2,
      local: 4,
      localPercent: 40,
    });
    expect(result.updatedAt).toEqual(expect.any(String));
    expect(summaryQueryBuilder.where).toHaveBeenCalledWith(
      'maskingReport.member_id = :memberId',
      { memberId: '42' },
    );
    expect(summaryQueryBuilder.andWhere).toHaveBeenCalledWith(
      'promptLog.communicated_at IS NOT NULL',
    );
  });

  it('기간 내 전송 프롬프트를 단일 로그 단위로 반환하고 탐지 건수를 합산한다', async () => {
    maskingDetailRepository.find.mockResolvedValueOnce([
      { maskingReportId: 'report-1' },
      { maskingReportId: 'report-1' },
      { maskingReportId: 'report-2' },
    ]);

    await expect(service.getMessages({
      recent: '7d',
      pageSize: 10,
      pageNumber: 1,
    }, {
      userId: 42,
      role: UserRole.USER,
      expiredAt: '2026-07-27T00:00:00.000Z',
      accessToken: true,
    })).resolves.toEqual({
      data: [
        {
          promptId: 101,
          ticket: 'report-1',
          promptSummary: '계약서 검토 요청',
          promptedAt: '2026-07-27T10:00:00.000+09:00',
          llmModel: 'GPT',
          detectCnt: 2,
        },
        {
          promptId: 102,
          ticket: 'report-2',
          promptSummary: '로컬 요약 요청',
          promptedAt: '2026-07-26T10:00:00.000+09:00',
          llmModel: 'Local LLM',
          detectCnt: 1,
        },
      ],
      totalCnt: 2,
      dataCnt: 2,
      pageNumber: 1,
    });
    expect(summaryQueryBuilder.where).toHaveBeenCalledWith(
      'maskingReport.memberId = :memberId',
      { memberId: '42' },
    );
    expect(summaryQueryBuilder.orderBy).toHaveBeenCalledWith(
      'promptLog.communicatedAt',
      'DESC',
    );
  });

  it.each(['7일전', '30일전', '90일전', '전체', 'invalid'])
  ('지원하지 않는 recent 값 %s은 전체 조회로 처리하지 않고 거부한다', async (recent) => {
    await expect(service.getMessages({
      recent,
      pageSize: 10,
      pageNumber: 1,
    }, {
      userId: 42,
      role: UserRole.USER,
      expiredAt: '2026-07-27T00:00:00.000Z',
      accessToken: true,
    })).rejects.toMatchObject({
      baseStatus: UserErrorStatus.INVALID_MESSAGE_LIST,
    });

    expect(summaryQueryBuilder.getManyAndCount).not.toHaveBeenCalled();
  });
});
