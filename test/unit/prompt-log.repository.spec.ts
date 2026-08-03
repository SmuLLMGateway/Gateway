import type { Repository } from 'typeorm';
import { PromptLogDAO } from '../../src/domain/prompt/dao/prompt-log.dao.js';
import { PromptLogRepository } from '../../src/domain/prompt/repository/prompt-log.repository.js';
import { MaskingReportStatus } from '../../src/domain/prompt/type/masking-report-status.enum.js';

describe('PromptLogRepository', () => {
  const promptRoomId = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const repository = { find: jest.fn() };
  const promptLogRepository = new PromptLogRepository(
    repository as unknown as Repository<PromptLogDAO>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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
          maskingReportId: 'report-3',
          request: '요청 3',
          response: '응답 3',
          communicatedAt: latestAt,
        },
        {
          maskingReportId: 'report-2',
          request: '요청 2',
          response: '응답 2',
          communicatedAt: boundaryAt,
        },
        {
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
