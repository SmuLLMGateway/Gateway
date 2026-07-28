import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import { UserService } from '../../src/domain/user/service/user.service.js';

describe('UserService.getUserInfo', () => {
  const memberRepository = { findOneBy: jest.fn() };
  const memberDepartmentRepository = { findOne: jest.fn() };
  const departmentRepository = { findOneBy: jest.fn() };
  const memberLimitRepository = { find: jest.fn() };
  const activeApiKeyRepository = { find: jest.fn() };
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
    getRawOne: jest.fn(),
  };
  const service = new UserService(
    memberRepository as never,
    memberDepartmentRepository as never,
    departmentRepository as never,
    memberLimitRepository as never,
    activeApiKeyRepository as never,
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
    departmentRepository.findOneBy.mockResolvedValue({ departmentName: '개발팀' });
    memberLimitRepository.find.mockResolvedValue([{ usage: '12.5' }, { usage: '3.5' }]);
    activeApiKeyRepository.find.mockResolvedValue([{ usage: '20' }, { usage: '4.5' }]);
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
    summaryQueryBuilder.getRawOne.mockResolvedValue({
      totalChatCnt: '10',
      filter: '3',
      masking: '2',
      local: '4',
    });
    promptLogRepository.findAndCount.mockResolvedValue([[
      {
        promptLogId: '101',
        promptSummary: '계약서 검토 요청',
        communicatedAt: new Date('2026-07-27T01:00:00.000Z'),
        modelType: 'gpt-5.5',
        maskingReportId: 'report-1',
      },
      {
        promptLogId: '102',
        promptSummary: '로컬 요약 요청',
        communicatedAt: new Date('2026-07-26T01:00:00.000Z'),
        modelType: 'Local LLM',
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
      role: '일반 사용자',
      filter: 1,
      personalLimitRate: 16,
      departmentLimitRate: 24.5,
    });

    expect(memberLimitRepository.find).toHaveBeenCalledWith({
      select: { usage: true },
      where: { memberId: '42' },
    });
    expect(activeApiKeyRepository.find).toHaveBeenCalledWith({
      select: { usage: true },
      where: { departmentId: '7' },
    });
    expect(maskingDetailRepository.find).toHaveBeenCalledWith({
      select: { maskingReportId: true },
      where: { maskingReportId: expect.anything() },
    });
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
      recent: '7일전',
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
          promptId: '101',
          promptSummary: '계약서 검토 요청',
          promptedAt: '2026-07-27T01:00:00.000Z',
          llmModel: 'gpt-5.5',
          detectCnt: 2,
        },
        {
          promptId: '102',
          promptSummary: '로컬 요약 요청',
          promptedAt: '2026-07-26T01:00:00.000Z',
          llmModel: 'Local LLM',
          detectCnt: 1,
        },
      ],
      totalCnt: 2,
      dataCnt: 2,
      pageNumber: 1,
    });
    expect(promptLogRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          maskingReport: { memberId: '42' },
        }),
        order: { communicatedAt: 'DESC', promptLogId: 'DESC' },
        take: 10,
        skip: 0,
      }),
    );
  });
});
