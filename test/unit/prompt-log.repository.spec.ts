import type { Repository } from 'typeorm';
import { MaskingReportDAO } from '../../src/domain/prompt/dao/masking-report.dao.js';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { PromptLogRepository } from '../../src/domain/prompt/repository/prompt-log.repository.js';
import { MaskingReportStatus } from '../../src/domain/prompt/type/masking-report-status.enum.js';
import { PromptLogStatus } from '../../src/domain/prompt/type/prompt-log-status.enum.js';

describe('PromptLogRepository', () => {
  const promptRoomId = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const transactionPromptLogRepository = { find: jest.fn(), delete: jest.fn() };
  const transactionReportRepository = { update: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const repository = {
    find: jest.fn(),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const promptLogRepository = new PromptLogRepository(
    repository as unknown as Repository<PromptLogDAO>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.manager.transaction.mockImplementation(async (work) => work(manager));
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === PromptLogDAO) return transactionPromptLogRepository;
      if (entity === MaskingReportDAO) return transactionReportRepository;
      throw new Error('정의되지 않은 Repository입니다.');
    });
  });

  it('동일 communicatedAt 경계의 모든 이력을 같은 페이지에 포함해 다음 커서에서 누락시키지 않는다', async () => {
    const latestAt = new Date('2026-07-31T00:00:02.000Z');
    const boundaryAt = new Date('2026-07-31T00:00:01.000Z');
    repository.find
      .mockResolvedValueOnce([
        createLog('3', latestAt),
        createLog('2', boundaryAt),
        createLog('1', boundaryAt),
      ])
      .mockResolvedValueOnce([
        createLog('2', boundaryAt),
        createLog('1', boundaryAt),
      ])
      .mockResolvedValueOnce([{ promptLogId: '0' }]);

    const page = await promptLogRepository.findHistoryPageByPromptRoomId(
      promptRoomId,
      undefined,
      2,
    );

    expect(page).toEqual({
      hasNext: true,
      items: [
        {
          promptId: 3,
          maskingReportId: 'report-3',
          request: '요청 3',
          response: '응답 3',
          communicatedAt: latestAt,
        },
        {
          promptId: 2,
          maskingReportId: 'report-2',
          request: '요청 2',
          response: '응답 2',
          communicatedAt: boundaryAt,
        },
        {
          promptId: 1,
          maskingReportId: 'report-1',
          request: '요청 1',
          response: '응답 1',
          communicatedAt: boundaryAt,
        },
      ],
    });
    expect(repository.find).toHaveBeenCalledTimes(3);
    expect(repository.find).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        maskingReport: { status: expect.objectContaining({ _type: 'not' }) },
      }),
    }));
    expect(repository.find).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        promptRoomId,
        communicatedAt: boundaryAt,
        maskingReport: { status: expect.objectContaining({ _type: 'not' }) },
      },
    }));
    expect(repository.find).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: expect.objectContaining({ promptRoomId }),
      take: 1,
    }));

    for (const [options] of repository.find.mock.calls) {
      const status = (options as {
        where?: { maskingReport?: { status?: { value?: unknown } } };
      }).where?.maskingReport?.status;
      expect(status?.value).toBe(MaskingReportStatus.CANCEL);
    }
  });

  it('24시간 동안 전송되지 않은 MASKING 로그는 지우고 탐지 보고서는 CANCEL로 보존한다', async () => {
    const now = new Date('2026-08-08T00:00:00.000Z');
    transactionPromptLogRepository.find.mockResolvedValueOnce([
      { promptLogId: '31', maskingReportId: 'report-1' },
    ]);
    transactionPromptLogRepository.delete.mockResolvedValueOnce({ affected: 1 });

    await expect(promptLogRepository.deleteExpiredMasking(now)).resolves.toBe(1);

    expect(transactionPromptLogRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { promptLogId: true, maskingReportId: true },
        where: expect.objectContaining({
          status: PromptLogStatus.MASKING,
        }),
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(transactionReportRepository.update).toHaveBeenCalledWith(
      { maskingReportId: expect.anything() },
      { status: MaskingReportStatus.CANCEL },
    );
    const reportIds = transactionReportRepository.update.mock.calls[0]?.[0]
      .maskingReportId;
    expect(reportIds.value).toEqual(['report-1']);
    expect(transactionPromptLogRepository.delete).toHaveBeenCalledWith({
      promptLogId: expect.anything(),
      status: PromptLogStatus.MASKING,
    });
  });

  it('LPL이 생성한 제목으로 특정 prompt_log의 prompt_summary를 교체한다', async () => {
    repository.update.mockResolvedValueOnce({ affected: 1 });

    await expect(
      promptLogRepository.updatePromptSummary('31', '문의 내용 요약'),
    ).resolves.toBe(true);

    expect(repository.update).toHaveBeenCalledWith(
      { promptLogId: '31' },
      { promptSummary: '문의 내용 요약' },
    );
  });

  function createLog(promptLogId: string, communicatedAt: Date) {
    return {
      promptLogId,
      maskingReportId: `report-${promptLogId}`,
      communicatedAt,
      responseText: `응답 ${promptLogId}`,
      maskingReport: { originalText: `요청 ${promptLogId}` },
    } as PromptLogDAO;
  }
});
