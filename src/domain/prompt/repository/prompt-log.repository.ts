import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { PromptLogStatus } from '../type/prompt-log-status.enum.js';

const MASKING_LOG_RETENTION_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class PromptLogRepository {
  constructor(
    @InjectRepository(PromptLogDAO)
    private readonly repository: Repository<PromptLogDAO>,
  ) {}

  async replaceMasking(
    promptRoomId: string,
    maskingReportId: string,
    promptSummary: string,
  ): Promise<void> {
    await this.repository.delete({
      promptRoomId,
      status: PromptLogStatus.MASKING,
    });

    await this.repository.insert(this.repository.create({
      status: PromptLogStatus.MASKING,
      communicatedAt: null,
      modelType: null,
      responseText: null,
      promptSummary,
      promptRoomId,
      maskingReportId,
    }));
  }

  /** 24시간이 지난 마스킹 대기 로그만 제거하고, 나머지 채팅 기록은 보존합니다. */
  async deleteExpiredMasking(now = new Date()): Promise<number> {
    const expiredLogs = await this.repository.find({
      select: { promptLogId: true },
      relations: { maskingReport: true },
      where: {
        status: PromptLogStatus.MASKING,
        maskingReport: {
          createdAt: LessThan(new Date(now.getTime() - MASKING_LOG_RETENTION_MS)),
        },
      },
    });
    if (expiredLogs.length === 0) {
      return 0;
    }

    const result = await this.repository.delete({
      promptLogId: In(expiredLogs.map(({ promptLogId }) => promptLogId)),
    });
    return result.affected ?? 0;
  }

  async deleteByMaskingReportId(maskingReportId: string): Promise<void> {
    await this.repository.delete({ maskingReportId });
  }

  async findHistoryByPromptRoomId(promptRoomId: string): Promise<readonly {
    maskingReportId: string;
    request: string;
    response: string | null;
  }[]> {
    const logs = await this.repository.find({
      select: {
        maskingReportId: true,
        responseText: true,
        maskingReport: { originalText: true },
      },
      relations: { maskingReport: true },
      where: { promptRoomId },
      order: { promptLogId: 'ASC' },
    });

    return logs.map((log) => ({
      maskingReportId: log.maskingReportId,
      request: log.maskingReport.originalText,
      response: log.responseText,
    }));
  }
}
