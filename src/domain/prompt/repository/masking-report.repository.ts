import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { MaskingDetailDAO } from '../dao/masking-detail.dao.js';
import { MaskingReportDAO } from '../dao/masking-report.dao.js';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { PromptRoomDAO } from '../dao/prompt-room.dao.js';
import type { PromptData } from '../data/prompt.data.js';
import { PromptException } from '../exception/prompt.exception.js';
import { PromptMapper } from '../mapper/prompt.mapper.js';
import {
  normalizeMaskingContent,
} from '../type/masking-content.type.js';
import { MaskingReportStatus } from '../type/masking-report-status.enum.js';
import { PromptLogStatus } from '../type/prompt-log-status.enum.js';

@Injectable()
export class MaskingReportRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly promptMapper: PromptMapper,
  ) {}

  async create(
    ticket: string,
    memberId: number,
    originalText: string,
    recentTicket: string | null,
  ): Promise<void> {
    const report = this.promptMapper.toMaskingReportDAO({
      maskingReportId: ticket,
      status: MaskingReportStatus.PENDING,
      regexStatus: MaskingReportStatus.PENDING,
      // NER 요청이 비활성화된 동안에는 미처리 상태로 남기지 않습니다.
      nerStatus: MaskingReportStatus.DONE,
      memberId: String(memberId),
      originalText,
      recentMaskingReportId: recentTicket,
    });

    try {
      await this.dataSource.getRepository(MaskingReportDAO).insert(report);
    } catch (error: unknown) {
      if (this.isDuplicateKey(error)) {
        throw new PromptException(PromptErrorStatus.DUPLICATED_TICKET);
      }

      throw error;
    }
  }

  async validateRequestTickets(
    ticket: string,
    recentTicket: string | null,
    memberId: number,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(MaskingReportDAO);
    const existingReport = await repository.findOne({
      select: { maskingReportId: true },
      where: { maskingReportId: ticket },
    });
    if (existingReport !== null) {
      throw new PromptException(PromptErrorStatus.DUPLICATED_TICKET);
    }

    if (recentTicket === null) {
      return;
    }

    const recentReport = await repository.findOne({
      select: { maskingReportId: true },
      where: {
        maskingReportId: recentTicket,
        memberId: String(memberId),
      },
    });
    if (recentReport === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_RECENT_TICKET);
    }
  }

  async saveRegexDetections(
    ticket: string,
    detections: readonly Readonly<PromptData.RegexDetection>[],
  ): Promise<boolean> {
    return this.completeBranch(
      ticket,
      'regexStatus',
      detections.map((detection) => ({
        originalText: detection.originalText,
        startIdx: detection.startIdx,
        endIdx: detection.endIdx,
        fileUrl: null,
        maskingText: detection.maskingText,
        maskingReportId: ticket,
        policyId: detection.policyId,
      })),
    );
  }

  async cancelRegex(ticket: string): Promise<boolean> {
    return this.cancelBranch(ticket, 'regexStatus');
  }

  async findMemberId(ticket: string): Promise<string | null> {
    const report = await this.dataSource.getRepository(MaskingReportDAO).findOne({
      select: { memberId: true },
      where: { maskingReportId: ticket },
    });

    return report?.memberId ?? null;
  }

  async findAnalyzeResult(
    ticket: string,
    memberId: number,
  ): Promise<PromptData.AnalyzeReport | null> {
    const report = await this.dataSource.getRepository(MaskingReportDAO).findOne({
      select: {
        status: true,
        originalText: true,
      },
      where: {
        maskingReportId: ticket,
        memberId: String(memberId),
      },
    });

    if (report === null) {
      return null;
    }

    if (report.status !== MaskingReportStatus.DONE) {
      return {
        status: report.status,
        originalText: report.originalText,
        details: [],
      };
    }

    const details = await this.dataSource.getRepository(MaskingDetailDAO).find({
      relations: { policy: true },
      where: { maskingReportId: ticket },
      order: { maskingDetailId: 'ASC' },
    });

    return {
      status: report.status,
      originalText: report.originalText,
      details: details.map((detail) => {
        const maskingContent = normalizeMaskingContent(
          detail.policy.maskingContent,
        );
        if (maskingContent === null) {
          throw new Error('지원하지 않는 마스킹 정책이 분석 결과에 포함되어 있습니다.');
        }

        return {
          originalText: detail.originalText,
          startIdx: detail.startIdx,
          endIdx: detail.endIdx,
          fileUrl: detail.fileUrl,
          maskingContent,
          maskingClass: detail.policy.maskingClass,
        };
      }),
    };
  }

  async findRecentAnalyzeResult(
    chatRoomId: string,
    memberId: number,
  ): Promise<PromptData.RecentAnalyzeReport | null> {
    const promptLog = await this.dataSource.getRepository(PromptLogDAO).findOne({
      select: { maskingReportId: true },
      where: {
        promptRoomId: chatRoomId,
        status: PromptLogStatus.MASKING,
      },
      order: {
        promptLogId: 'DESC',
      },
    });
    if (promptLog === null) {
      return null;
    }

    const promptRoom = await this.dataSource.getRepository(PromptRoomDAO).findOne({
      select: { promptRoomId: true },
      where: {
        promptRoomId: chatRoomId,
        memberId: String(memberId),
      },
    });
    if (promptRoom === null) {
      return null;
    }

    const report = await this.findAnalyzeResult(
      promptLog.maskingReportId,
      memberId,
    );
    if (report === null || report.status !== MaskingReportStatus.DONE) {
      return null;
    }

    const reportReference = await this.dataSource
      .getRepository(MaskingReportDAO)
      .findOne({
        select: {
          maskingReportId: true,
          recentMaskingReportId: true,
        },
        where: { maskingReportId: promptLog.maskingReportId },
      });
    if (reportReference === null) {
      return null;
    }

    return {
      ...report,
      ticket: reportReference.maskingReportId,
      recentTicket: reportReference.recentMaskingReportId,
    };
  }

  async saveNerDetections(
    ticket: string,
    fileUrl: string,
    detections: readonly Readonly<PromptData.NerDetection>[],
  ): Promise<boolean> {
    return this.completeBranch(
      ticket,
      'nerStatus',
      detections.map((detection) => ({
        originalText: null,
        startIdx: null,
        endIdx: null,
        fileUrl,
        maskingText: null,
        maskingReportId: ticket,
        policyId: detection.policyId,
      })),
    );
  }

  async cancelNer(ticket: string): Promise<boolean> {
    return this.cancelBranch(ticket, 'nerStatus');
  }

  private async completeBranch(
    ticket: string,
    branch: 'regexStatus' | 'nerStatus',
    details: readonly Readonly<PromptData.CreateMaskingDetail>[],
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const report = await this.findForUpdate(manager, ticket);

      if (report[branch] !== MaskingReportStatus.PENDING) {
        return false;
      }

      if (details.length > 0) {
        const detailEntities = details.map((detail) =>
          this.promptMapper.toMaskingDetailDAO(detail),
        );
        await manager.getRepository(MaskingDetailDAO).insert(detailEntities);
      }

      report[branch] = MaskingReportStatus.DONE;
      report.status = this.resolveOverallStatus(
        report.regexStatus,
        report.nerStatus,
      );
      await manager.getRepository(MaskingReportDAO).update(
        { maskingReportId: ticket },
        {
          [branch]: MaskingReportStatus.DONE,
          status: report.status,
        },
      );

      return true;
    });
  }

  private async cancelBranch(
    ticket: string,
    branch: 'regexStatus' | 'nerStatus',
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const report = await this.findForUpdate(manager, ticket);

      if (report[branch] !== MaskingReportStatus.PENDING) {
        return false;
      }

      report[branch] = MaskingReportStatus.CANCEL;
      report.status = this.resolveOverallStatus(
        report.regexStatus,
        report.nerStatus,
      );
      await manager.getRepository(MaskingReportDAO).update(
        { maskingReportId: ticket },
        {
          [branch]: MaskingReportStatus.CANCEL,
          status: report.status,
        },
      );

      return true;
    });
  }

  private async findForUpdate(
    manager: EntityManager,
    ticket: string,
  ): Promise<MaskingReportDAO> {
    const report = await manager.getRepository(MaskingReportDAO).findOne({
      where: { maskingReportId: ticket },
      lock: { mode: 'pessimistic_write' },
    });

    if (report === null) {
      throw new PromptException(PromptErrorStatus.NOT_FOUND_ANAL_REQ);
    }

    return report;
  }

  private resolveOverallStatus(
    regexStatus: MaskingReportStatus,
    nerStatus: MaskingReportStatus,
  ): MaskingReportStatus {
    if (
      regexStatus === MaskingReportStatus.CANCEL
      || nerStatus === MaskingReportStatus.CANCEL
    ) {
      return MaskingReportStatus.CANCEL;
    }

    if (
      regexStatus === MaskingReportStatus.DONE
      && nerStatus === MaskingReportStatus.DONE
    ) {
      return MaskingReportStatus.DONE;
    }

    return MaskingReportStatus.PENDING;
  }

  private isDuplicateKey(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      readonly code?: unknown;
      readonly errno?: unknown;
    };

    return driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062;
  }
}
