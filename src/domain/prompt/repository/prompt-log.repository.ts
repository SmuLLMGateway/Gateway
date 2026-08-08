import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { MaskingReportDAO } from '../dao/masking-report.dao.js';
import { MaskingReportStatus } from '../type/masking-report-status.enum.js';
import { PromptLogStatus } from '../type/prompt-log-status.enum.js';

const MASKING_LOG_RETENTION_MS = 24 * 60 * 60 * 1_000;

export interface PromptLogHistoryItem {
  readonly promptId: number;
  readonly maskingReportId: string;
  readonly request: string;
  readonly sendText: string;
  readonly response: string | null;
  readonly communicatedAt: Date;
}

export interface PromptLogHistoryPage {
  readonly items: readonly PromptLogHistoryItem[];
  readonly hasNext: boolean;
}

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
    modelType: string,
    modelName: string,
  ): Promise<void> {
    await this.repository.delete({
      promptRoomId,
      status: PromptLogStatus.MASKING,
    });

    await this.repository.insert(this.repository.create({
      status: PromptLogStatus.MASKING,
      communicatedAt: null,
      modelType,
      modelName,
      responseText: null,
      usage: null,
      promptSummary,
      promptRoomId,
      maskingReportId,
      activeApiKeyId: null,
    }));
  }

  /**
   * 24시간 동안 LLM 전송으로 이어지지 않은 MASKING 로그를 만료 처리합니다.
   *
   * 탐지 결과(masking_report/masking_detail)는 감사 목적으로 보존하되, 해당
   * 보고서의 최종 상태만 CANCEL로 바꾼 뒤 대기 로그를 제거합니다. 행 잠금으로
   * 동시에 시작한 LLM 전송이 만료 로그를 다시 PENDING으로 바꾸지 못하게 합니다.
   */
  async deleteExpiredMasking(now = new Date()): Promise<number> {
    const expiredBefore = new Date(now.getTime() - MASKING_LOG_RETENTION_MS);

    return this.repository.manager.transaction(async (manager) => {
      const promptLogRepository = manager.getRepository(PromptLogDAO);
      const maskingReportRepository = manager.getRepository(MaskingReportDAO);
      const expiredLogs = await promptLogRepository.find({
        select: { promptLogId: true, maskingReportId: true },
        relations: { maskingReport: true },
        where: {
          status: PromptLogStatus.MASKING,
          maskingReport: { createdAt: LessThan(expiredBefore) },
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (expiredLogs.length === 0) {
        return 0;
      }

      const promptLogIds = expiredLogs.map(({ promptLogId }) => promptLogId);
      const reportIds = [...new Set(
        expiredLogs.map(({ maskingReportId }) => maskingReportId),
      )];
      await maskingReportRepository.update(
        { maskingReportId: In(reportIds) },
        { status: MaskingReportStatus.CANCEL },
      );
      const result = await promptLogRepository.delete({
        promptLogId: In(promptLogIds),
        status: PromptLogStatus.MASKING,
      });

      return result.affected ?? 0;
    });
  }

  async deleteByMaskingReportId(maskingReportId: string): Promise<void> {
    await this.repository.delete({ maskingReportId });
  }

  async findHistoryPageByPromptRoomId(
    promptRoomId: string,
    cursor: Date | undefined,
    pageSize: number,
  ): Promise<PromptLogHistoryPage> {
    const logs = await this.repository.find({
      select: {
        promptLogId: true,
        maskingReportId: true,
        communicatedAt: true,
        responseText: true,
        maskingReport: { originalText: true, maskingText: true },
      },
      relations: { maskingReport: true },
      where: {
        promptRoomId,
        communicatedAt: cursor === undefined
          ? Not(IsNull())
          : LessThan(cursor),
        maskingReport: { status: Not(MaskingReportStatus.CANCEL) },
      },
      order: { communicatedAt: 'DESC', promptLogId: 'DESC' },
      take: pageSize + 1,
    });

    let hasNext = logs.length > pageSize;
    let pageLogs = hasNext ? logs.slice(0, pageSize) : logs;

    if (hasNext) {
      const boundaryLog = pageLogs[pageLogs.length - 1]!;
      const overflowLog = logs[pageSize]!;
      const boundaryAt = boundaryLog.communicatedAt;
      const overflowAt = overflowLog.communicatedAt;
      if (boundaryAt === null || overflowAt === null) {
        throw new Error('프롬프트 이력의 communicatedAt이 올바르지 않습니다.');
      }

      // cursor는 명세상 UNIX ms만 전달할 수 있습니다. 같은 timestamp의 로그를
      // pageSize 경계에서 나누면 다음 요청의 `< cursor` 조건으로 일부 이력이
      // 누락되므로, 경계 timestamp 그룹은 한 페이지에서 모두 반환합니다.
      if (boundaryAt.getTime() === overflowAt.getTime()) {
        const boundaryLogs = await this.repository.find({
          select: {
            promptLogId: true,
            maskingReportId: true,
            communicatedAt: true,
            responseText: true,
            maskingReport: { originalText: true, maskingText: true },
          },
          relations: { maskingReport: true },
          where: {
            promptRoomId,
            communicatedAt: boundaryAt,
            maskingReport: { status: Not(MaskingReportStatus.CANCEL) },
          },
          order: { communicatedAt: 'DESC', promptLogId: 'DESC' },
        });
        const newerLogs = pageLogs.filter(
          (log) => log.communicatedAt !== null
            && log.communicatedAt.getTime() > boundaryAt.getTime(),
        );
        pageLogs = [...newerLogs, ...boundaryLogs];

        const olderLogs = await this.repository.find({
          select: { promptLogId: true },
          where: {
            promptRoomId,
            communicatedAt: LessThan(boundaryAt),
            maskingReport: { status: Not(MaskingReportStatus.CANCEL) },
          },
          take: 1,
        });
        hasNext = olderLogs.length > 0;
      }
    }

    return {
      hasNext,
      items: pageLogs.map((log) => {
        if (log.communicatedAt === null) {
          throw new Error('프롬프트 이력의 communicatedAt이 올바르지 않습니다.');
        }

        return {
          promptId: Number(log.promptLogId),
          maskingReportId: log.maskingReportId,
          request: log.maskingReport.originalText,
          sendText: log.maskingReport.maskingText,
          response: log.responseText,
          communicatedAt: log.communicatedAt,
        };
      }),
    };
  }
}
