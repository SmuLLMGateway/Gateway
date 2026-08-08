import type { DataSource } from 'typeorm';
import { MaskingClass } from '../../src/domain/admin/dao/policy.dao.js';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { PromptService } from '../../src/domain/prompt/service/prompt.service.js';
import { MemberLimitDAO } from '../../src/domain/user/dao/member-limit.dao.js';
import type { AuthenticatedUser } from '../../src/global/security/type/jwt-payload.type.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

describe('PromptService 사용자 프롬프트 상세 조회', () => {
  const promptLogRepository = { findOne: jest.fn() };
  const maskingDetailRepository = { find: jest.fn() };
  const memberLimitRepository = { find: jest.fn() };
  const memberDepartmentRepository = { findOne: jest.fn() };
  const dataSource = { getRepository: jest.fn() };
  const authentication: AuthenticatedUser = {
    userId: 42,
    role: UserRole.USER,
    expiredAt: '2026-08-08T00:00:00.000Z',
    accessToken: true,
  };
  const service = new PromptService(
    dataSource as unknown as DataSource,
    memberDepartmentRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PromptLogDAO) return promptLogRepository;
      if (entity === MemberLimitDAO) return memberLimitRepository;
      if (entity === MaskingDetailDAO) return maskingDetailRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
    promptLogRepository.findOne.mockResolvedValue({
      promptLogId: '101',
      communicatedAt: new Date('2026-08-02T15:57:23.000Z'),
      usage: 12400,
      maskingReportId: 'report-1',
      promptRoom: {
        memberId: '42',
        member: { memberId: '42', memberName: '김서윤', email: 'seoyun@example.com' },
      },
      maskingReport: {
        originalText: 'API키와 01012345678',
        maskingText: '**와 [전화]',
        createdAt: new Date('2026-08-02T15:55:00.000Z'),
      },
    });
    memberDepartmentRepository.findOne.mockResolvedValue({
      departmentId: '7',
      department: { departmentName: '정책기획팀' },
    });
    memberLimitRepository.find.mockResolvedValue([
      { limit: '200000', usage: '50000' },
    ]);
    maskingDetailRepository.find.mockResolvedValue([
      {
        maskingDetailId: '1',
        originalText: 'API키',
        startIdx: 0,
        maskingText: '**',
        departmentPolicy: {
          policy: { maskingContent: 'API_KEY', maskingClass: MaskingClass.SENSITIVE },
        },
      },
      {
        maskingDetailId: '2',
        originalText: '01012345678',
        startIdx: 6,
        maskingText: '[전화]',
        departmentPolicy: {
          policy: { maskingContent: 'PHONE', maskingClass: MaskingClass.PRIVATE },
        },
      },
    ]);
  });

  it('프롬프트 요청자와 로그인 사용자가 같으면 관리자 상세 응답 DTO와 같은 값을 반환한다', async () => {
    await expect(service.getPromptDetail(101, authentication)).resolves.toEqual({
      promptId: 101,
      ticket: 'report-1',
      name: '김서윤',
      department: '정책기획팀',
      email: 'seoyun@example.com',
      limit: 200000,
      usage: 12400,
      usagePercent: 6.2,
      promptedAt: '2026-08-03T00:57:23.000+09:00',
      detectCnt: 2,
      maskingCnt: 2,
      originalText: 'API키와 01012345678',
      sendText: '**와 [전화]',
      detect: [
        {
          targetText: 'API키',
          startIdx: 0,
          endIdx: 3,
          maskingCategory: '민감 정보',
          detailCategory: 'API 키',
          maskingText: '**',
          maskingStartIdx: 0,
          maskingEndIdx: 1,
        },
        {
          targetText: '01012345678',
          startIdx: 6,
          endIdx: 16,
          maskingCategory: '개인 정보',
          detailCategory: '전화번호',
          maskingText: '[전화]',
          maskingStartIdx: 6,
          maskingEndIdx: 9,
        },
      ],
    });
    expect(promptLogRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { promptLogId: '101' } }),
    );
  });

  it('프롬프트 요청자와 로그인 사용자가 다르면 상세 정보를 조회하지 못한다', async () => {
    await expect(service.getPromptDetail(101, {
      ...authentication,
      userId: 999,
    })).rejects.toMatchObject<Partial<PromptException>>({
      baseStatus: PromptErrorStatus.FORBIDDEN_PROMPT_DETAIL,
    });

    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
    expect(memberLimitRepository.find).not.toHaveBeenCalled();
    expect(maskingDetailRepository.find).not.toHaveBeenCalled();
  });

  it('프롬프트가 없으면 기존 프롬프트 미존재 오류를 반환한다', async () => {
    promptLogRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.getPromptDetail(404, authentication)).rejects
      .toMatchObject<Partial<PromptException>>({
        baseStatus: PromptErrorStatus.NOT_FOUND_PROMPT,
      });
  });
});
