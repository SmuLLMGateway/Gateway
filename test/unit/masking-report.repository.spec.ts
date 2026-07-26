import { getMetadataArgsStorage, QueryFailedError } from 'typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { MaskingClass } from '../../src/domain/admin/dao/policy.dao.js';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { MaskingDetailDAO } from '../../src/domain/prompt/dao/masking-detail.dao.js';
import { MaskingReportDAO } from '../../src/domain/prompt/dao/masking-report.dao.js';
import type { PromptData } from '../../src/domain/prompt/data/prompt.data.js';
import { PromptMapper } from '../../src/domain/prompt/mapper/prompt.mapper.js';
import { MaskingReportRepository } from '../../src/domain/prompt/repository/masking-report.repository.js';
import { MaskingReportStatus } from '../../src/domain/prompt/type/masking-report-status.enum.js';

describe('MaskingReportRepository', () => {
  const ticket = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const recentTicket = '8e88c068-722e-4c04-93c5-906cea400be2';
  const originalText = '원본 텍스트 010-1234-5678';
  const fileUrl = `s3://gateway-test/masking/${ticket}/source`;
  const reportRepository = {
    insert: jest.fn(),
    findOne: jest.fn(),
  };
  const detailRepository = {
    find: jest.fn(),
  };
  const transactionReportRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const transactionDetailRepository = {
    insert: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === MaskingReportDAO) {
        return transactionReportRepository;
      }

      if (entity === MaskingDetailDAO) {
        return transactionDetailRepository;
      }

      throw new Error('예상하지 못한 트랜잭션 Repository입니다.');
    }),
  };
  const dataSource = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === MaskingReportDAO) {
        return reportRepository;
      }

      if (entity === MaskingDetailDAO) {
        return detailRepository;
      }

      throw new Error('예상하지 못한 DataSource Repository입니다.');
    }),
    transaction: jest.fn(
      async (work: (entityManager: EntityManager) => Promise<unknown>) =>
        work(manager as unknown as EntityManager),
    ),
  };
  const promptMapper = {
    toMaskingReportDAO: jest.fn(
      (data: Readonly<PromptData.CreateMaskingReport>) =>
        ({ ...data }) as MaskingReportDAO,
    ),
    toMaskingDetailDAO: jest.fn(
      (data: Readonly<PromptData.CreateMaskingDetail>) =>
        ({ ...data }) as MaskingDetailDAO,
    ),
  };
  const repository = new MaskingReportRepository(
    dataSource as unknown as DataSource,
    promptMapper as unknown as PromptMapper,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    reportRepository.insert.mockResolvedValue(undefined);
    detailRepository.find.mockResolvedValue([]);
    transactionReportRepository.update.mockResolvedValue(undefined);
    transactionDetailRepository.insert.mockResolvedValue(undefined);
  });

  it('원본 텍스트를 original_text TEXT NOT NULL 컬럼으로 매핑한다', () => {
    const column = getMetadataArgsStorage().columns.find(
      (metadata) => metadata.target === MaskingReportDAO
        && metadata.propertyName === 'originalText',
    );

    expect(column?.options).toEqual(expect.objectContaining({
      name: 'original_text',
      type: 'text',
      nullable: false,
    }));
  });

  it('최종·정규식은 PENDING, 비활성화된 NER는 DONE으로 생성한다', async () => {
    await repository.create(ticket, 42, originalText, null);

    const expected = {
      maskingReportId: ticket,
      status: MaskingReportStatus.PENDING,
      regexStatus: MaskingReportStatus.PENDING,
      nerStatus: MaskingReportStatus.DONE,
      memberId: '42',
      originalText,
      recentMaskingReportId: null,
    };
    expect(promptMapper.toMaskingReportDAO).toHaveBeenCalledWith(expected);
    expect(reportRepository.insert).toHaveBeenCalledWith(expected);
  });

  it('ER_DUP_ENTRY를 PROM400_2로 변환한다', async () => {
    const driverError = Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    });
    reportRepository.insert.mockRejectedValueOnce(
      new QueryFailedError('INSERT INTO masking_report', [], driverError),
    );

    await expect(
      repository.create(ticket, 42, originalText, null),
    ).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.DUPLICATED_TICKET,
    });
  });

  it('요청 ticket이 이미 존재하면 PROM400_2로 거부한다', async () => {
    reportRepository.findOne.mockResolvedValueOnce({
      maskingReportId: ticket,
    });

    await expect(
      repository.validateRequestTickets(ticket, recentTicket, 42),
    ).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.DUPLICATED_TICKET,
    });

    expect(reportRepository.findOne).toHaveBeenCalledTimes(1);
    expect(reportRepository.findOne).toHaveBeenCalledWith({
      select: { maskingReportId: true },
      where: { maskingReportId: ticket },
    });
  });

  it('recentTicket이 null이면 요청 ticket 중복만 검증한다', async () => {
    reportRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      repository.validateRequestTickets(ticket, null, 42),
    ).resolves.toBeUndefined();

    expect(reportRepository.findOne).toHaveBeenCalledTimes(1);
    expect(reportRepository.findOne).toHaveBeenCalledWith({
      select: { maskingReportId: true },
      where: { maskingReportId: ticket },
    });
  });

  it('요청 ticket이 없고 recentTicket이 요청자 소유이면 검증을 통과한다', async () => {
    reportRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ maskingReportId: recentTicket });

    await expect(
      repository.validateRequestTickets(ticket, recentTicket, 42),
    ).resolves.toBeUndefined();

    expect(reportRepository.findOne).toHaveBeenNthCalledWith(2, {
      select: { maskingReportId: true },
      where: {
        maskingReportId: recentTicket,
        memberId: '42',
      },
    });
  });

  it('recentTicket이 없거나 다른 사용자 소유이면 PROM404_5로 거부한다', async () => {
    reportRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      repository.validateRequestTickets(ticket, recentTicket, 42),
    ).rejects.toMatchObject({
      baseStatus: PromptErrorStatus.NOT_FOUND_RECENT_TICKET,
    });

    expect(reportRepository.findOne).toHaveBeenNthCalledWith(2, {
      select: { maskingReportId: true },
      where: {
        maskingReportId: recentTicket,
        memberId: '42',
      },
    });
  });

  it('요청자 소유의 DONE 보고서를 정책이 결합된 상세 결과로 조회한다', async () => {
    reportRepository.findOne.mockResolvedValueOnce(createReport({
      status: MaskingReportStatus.DONE,
      originalText,
    }));
    detailRepository.find.mockResolvedValueOnce([
      {
        maskingDetailId: '7',
        originalText: '010-1234-5678',
        startIdx: 6,
        endIdx: 19,
        maskingReportId: ticket,
        policyId: '101',
        policy: {
          policyId: '101',
          maskingContent: 'PHONE',
          maskingClass: MaskingClass.PRIVATE,
          isActive: true,
        },
      } as MaskingDetailDAO,
    ]);

    await expect(repository.findAnalyzeResult(ticket, 42)).resolves.toEqual({
      status: MaskingReportStatus.DONE,
      originalText,
      details: [
        {
          originalText: '010-1234-5678',
          startIdx: 6,
          endIdx: 19,
          maskingContent: 'PHONE',
          maskingClass: MaskingClass.PRIVATE,
        },
      ],
    });

    expect(reportRepository.findOne).toHaveBeenCalledWith({
      select: {
        status: true,
        originalText: true,
      },
      where: {
        maskingReportId: ticket,
        memberId: '42',
      },
    });
    expect(detailRepository.find).toHaveBeenCalledWith({
      relations: { policy: true },
      where: { maskingReportId: ticket },
      order: { maskingDetailId: 'ASC' },
    });
  });

  it.each([
    {
      description: '존재하지 않는 티켓',
      memberId: 42,
    },
    {
      description: '다른 사용자가 소유한 티켓',
      memberId: 99,
    },
  ])('$description은 null을 반환하고 상세를 조회하지 않는다', async ({
    memberId,
  }) => {
    reportRepository.findOne.mockResolvedValueOnce(null);

    await expect(repository.findAnalyzeResult(ticket, memberId))
      .resolves.toBeNull();

    expect(reportRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          maskingReportId: ticket,
          memberId: String(memberId),
        },
      }),
    );
    expect(detailRepository.find).not.toHaveBeenCalled();
  });

  it('PENDING 보고서는 상세를 조회하지 않고 현재 상태만 반환한다', async () => {
    reportRepository.findOne.mockResolvedValueOnce(createReport({
      status: MaskingReportStatus.PENDING,
      originalText,
    }));

    await expect(repository.findAnalyzeResult(ticket, 42)).resolves.toEqual({
      status: MaskingReportStatus.PENDING,
      originalText,
      details: [],
    });

    expect(detailRepository.find).not.toHaveBeenCalled();
  });

  it('정규식 상세를 bulk insert하고 NER가 DONE이면 전체 상태를 DONE으로 전이한다', async () => {
    transactionReportRepository.findOne.mockResolvedValueOnce(createReport({
      nerStatus: MaskingReportStatus.DONE,
    }));
    const detections: PromptData.RegexDetection[] = [
      {
        originalText: '010-1234-5678',
        startIdx: 3,
        endIdx: 16,
        maskingText: '[ 전화번호 ]',
        policyId: '101',
      },
      {
        originalText: 'member@example.com',
        startIdx: 20,
        endIdx: 38,
        maskingText: '[ 이메일 ]',
        policyId: '104',
      },
    ];

    await expect(
      repository.saveRegexDetections(ticket, detections),
    ).resolves.toBe(true);

    const expectedDetails: PromptData.CreateMaskingDetail[] = [
      {
        originalText: '010-1234-5678',
        startIdx: 3,
        endIdx: 16,
        fileUrl: null,
        maskingText: '[ 전화번호 ]',
        maskingReportId: ticket,
        policyId: '101',
      },
      {
        originalText: 'member@example.com',
        startIdx: 20,
        endIdx: 38,
        fileUrl: null,
        maskingText: '[ 이메일 ]',
        maskingReportId: ticket,
        policyId: '104',
      },
    ];
    expect(promptMapper.toMaskingDetailDAO.mock.calls.map(([detail]) => detail))
      .toEqual(expectedDetails);
    expect(transactionDetailRepository.insert).toHaveBeenCalledTimes(1);
    expect(transactionDetailRepository.insert).toHaveBeenCalledWith(
      expectedDetails,
    );
    expect(transactionReportRepository.update).toHaveBeenCalledWith(
      { maskingReportId: ticket },
      {
        regexStatus: MaskingReportStatus.DONE,
        status: MaskingReportStatus.DONE,
      },
    );
    expectLockedReportLookup();
  });

  it('NER가 PENDING이면 정규식 완료 후에도 전체 상태를 PENDING으로 유지한다', async () => {
    transactionReportRepository.findOne.mockResolvedValueOnce(createReport());

    await expect(repository.saveRegexDetections(ticket, [])).resolves.toBe(true);

    expect(transactionDetailRepository.insert).not.toHaveBeenCalled();
    expect(transactionReportRepository.update).toHaveBeenCalledWith(
      { maskingReportId: ticket },
      {
        regexStatus: MaskingReportStatus.DONE,
        status: MaskingReportStatus.PENDING,
      },
    );
  });

  it('NER 상세는 원문과 인덱스를 null로 만들고 영구 파일 URL과 함께 bulk insert한다', async () => {
    transactionReportRepository.findOne.mockResolvedValueOnce(createReport({
      regexStatus: MaskingReportStatus.DONE,
    }));

    await expect(repository.saveNerDetections(ticket, fileUrl, [
      { policyId: '101' },
      { policyId: '105' },
    ])).resolves.toBe(true);

    const expectedDetails: PromptData.CreateMaskingDetail[] = [
      {
        originalText: null,
        startIdx: null,
        endIdx: null,
        fileUrl,
        maskingText: null,
        maskingReportId: ticket,
        policyId: '101',
      },
      {
        originalText: null,
        startIdx: null,
        endIdx: null,
        fileUrl,
        maskingText: null,
        maskingReportId: ticket,
        policyId: '105',
      },
    ];
    expect(promptMapper.toMaskingDetailDAO.mock.calls.map(([detail]) => detail))
      .toEqual(expectedDetails);
    expect(transactionDetailRepository.insert).toHaveBeenCalledWith(
      expectedDetails,
    );
    expect(transactionReportRepository.update).toHaveBeenCalledWith(
      { maskingReportId: ticket },
      {
        nerStatus: MaskingReportStatus.DONE,
        status: MaskingReportStatus.DONE,
      },
    );
    expect(transactionDetailRepository.insert.mock.invocationCallOrder[0])
      .toBeLessThan(transactionReportRepository.update.mock.invocationCallOrder[0]!);
  });

  it('NER 상세 저장이 실패하면 NER와 전체 상태를 DONE으로 변경하지 않는다', async () => {
    transactionReportRepository.findOne.mockResolvedValueOnce(createReport({
      regexStatus: MaskingReportStatus.DONE,
    }));
    transactionDetailRepository.insert.mockRejectedValueOnce(
      new Error('masking_detail insert failed'),
    );

    await expect(repository.saveNerDetections(ticket, fileUrl, [
      { policyId: '101' },
    ])).rejects.toThrow('masking_detail insert failed');

    expect(transactionDetailRepository.insert).toHaveBeenCalledTimes(1);
    expect(transactionReportRepository.update).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: '정규식 취소',
      branch: 'regexStatus',
      execute: () => repository.cancelRegex(ticket),
    },
    {
      description: 'NER 취소',
      branch: 'nerStatus',
      execute: () => repository.cancelNer(ticket),
    },
  ] as const)('$description 시 전체 상태를 CANCEL로 전이한다', async ({
    branch,
    execute,
  }) => {
    transactionReportRepository.findOne.mockResolvedValueOnce(createReport());

    await expect(execute()).resolves.toBe(true);

    expect(transactionDetailRepository.insert).not.toHaveBeenCalled();
    expect(transactionReportRepository.update).toHaveBeenCalledWith(
      { maskingReportId: ticket },
      {
        [branch]: MaskingReportStatus.CANCEL,
        status: MaskingReportStatus.CANCEL,
      },
    );
  });

  it('이미 완료된 분기를 다시 완료하면 쓰기 없이 false를 반환한다', async () => {
    transactionReportRepository.findOne.mockResolvedValueOnce(createReport({
      regexStatus: MaskingReportStatus.DONE,
    }));

    await expect(repository.saveRegexDetections(ticket, [{
      originalText: '010-1234-5678',
      startIdx: 0,
      endIdx: 13,
      maskingText: '[ 전화번호 ]',
      policyId: '101',
    }])).resolves.toBe(false);

    expect(promptMapper.toMaskingDetailDAO).not.toHaveBeenCalled();
    expect(transactionDetailRepository.insert).not.toHaveBeenCalled();
    expect(transactionReportRepository.update).not.toHaveBeenCalled();
  });

  it('잠금 조회한 report가 없으면 PROM404_1을 반환한다', async () => {
    transactionReportRepository.findOne.mockResolvedValueOnce(null);

    await expect(repository.saveNerDetections(ticket, fileUrl, []))
      .rejects.toMatchObject({
        baseStatus: PromptErrorStatus.NOT_FOUND_ANAL_REQ,
      });

    expectLockedReportLookup();
    expect(transactionDetailRepository.insert).not.toHaveBeenCalled();
    expect(transactionReportRepository.update).not.toHaveBeenCalled();
  });

  function expectLockedReportLookup(): void {
    expect(transactionReportRepository.findOne).toHaveBeenCalledWith({
      where: { maskingReportId: ticket },
      lock: { mode: 'pessimistic_write' },
    });
  }
});

function createReport(
  overrides: Partial<MaskingReportDAO> = {},
): MaskingReportDAO {
  return {
    maskingReportId: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
    status: MaskingReportStatus.PENDING,
    regexStatus: MaskingReportStatus.PENDING,
    nerStatus: MaskingReportStatus.PENDING,
    memberId: '42',
    originalText: '원본 텍스트',
    ...overrides,
  } as MaskingReportDAO;
}
