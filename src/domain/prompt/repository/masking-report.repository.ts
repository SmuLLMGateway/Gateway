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
    requestNer = false,
  ): Promise<void> {
    const report = this.promptMapper.toMaskingReportDAO({
      maskingReportId: ticket,
      status: MaskingReportStatus.PENDING,
      regexStatus: MaskingReportStatus.PENDING,
      // NER 배포 ID가 모두 설정된 요청만 응답 대기 상태로 생성합니다.
      nerStatus: requestNer
        ? MaskingReportStatus.PENDING
        : MaskingReportStatus.DONE,
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
        fileUrl: null,
        maskingText: detection.maskingText,
        maskingReportId: ticket,
        departmentPolicyId: detection.departmentPolicyId,
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
      relations: { departmentPolicy: { policy: true } },
      where: { maskingReportId: ticket },
      order: { maskingDetailId: 'ASC' },
    });

    return {
      status: report.status,
      originalText: report.originalText,
      details: details.map((detail) => {
        const maskingContent = normalizeMaskingContent(
          detail.departmentPolicy.policy.maskingContent,
        );
        if (maskingContent === null) {
          throw new Error('지원하지 않는 마스킹 정책이 분석 결과에 포함되어 있습니다.');
        }

        return {
          originalText: detail.originalText,
          startIdx: detail.startIdx,
          endIdx: this.toDerivedEndIdx(detail.originalText, detail.startIdx),
          fileUrl: detail.fileUrl,
          maskingContent,
          maskingClass: detail.departmentPolicy.policy.maskingClass,
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
        fileUrl,
        maskingText: null,
        maskingReportId: ticket,
        departmentPolicyId: detection.departmentPolicyId,
      })),
    );
  }

  async saveNerTextDetections(
    ticket: string,
    detections: readonly Readonly<PromptData.NerTextDetection>[],
  ): Promise<boolean> {
    return this.completeBranch(
      ticket,
      'nerStatus',
      detections.map((detection) => ({
        originalText: detection.originalText,
        startIdx: detection.startIdx,
        fileUrl: null,
        maskingText: detection.maskingText,
        maskingReportId: ticket,
        departmentPolicyId: detection.departmentPolicyId,
      })),
    );
  }

  /** 텍스트·파일 NER 결과를 하나의 NER 완료 트랜잭션으로 저장합니다. */
  async saveNerTextAndFileDetections(
    ticket: string,
    textDetections: readonly Readonly<PromptData.NerTextDetection>[],
    fileUrl: string,
    fileDetections: readonly Readonly<PromptData.NerDetection>[],
  ): Promise<boolean> {
    return this.completeBranch(
      ticket,
      'nerStatus',
      [
        ...textDetections.map((detection) => ({
          originalText: detection.originalText,
          startIdx: detection.startIdx,
          fileUrl: null,
          maskingText: detection.maskingText,
          maskingReportId: ticket,
          departmentPolicyId: detection.departmentPolicyId,
        })),
        ...fileDetections.map((detection) => ({
          originalText: null,
          startIdx: null,
          fileUrl,
          maskingText: null,
          maskingReportId: ticket,
          departmentPolicyId: detection.departmentPolicyId,
        })),
      ],
    );
  }

  async cancelNer(ticket: string): Promise<boolean> {
    return this.cancelBranch(ticket, 'nerStatus');
  }

  async cancelForMember(ticket: string, memberId: number): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const report = await manager.getRepository(MaskingReportDAO).findOne({
        where: {
          maskingReportId: ticket,
          memberId: String(memberId),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (report === null) {
        return false;
      }

      const promptLogRepository = manager.getRepository(PromptLogDAO);
      const maskingLogs = await promptLogRepository.find({
        select: { promptLogId: true },
        where: {
          maskingReportId: ticket,
          status: PromptLogStatus.MASKING,
          promptRoom: { memberId: String(memberId) },
        },
      });
      if (maskingLogs.length > 0) {
        await promptLogRepository.delete(
          maskingLogs.map(({ promptLogId }) => promptLogId),
        );
      }

      // 취소 이후 비동기 콜백이 리포트를 다시 완료로 전환하지 않도록 모든
      // 분석 분기와 최종 상태를 함께 CANCEL로 고정합니다.
      report.regexStatus = MaskingReportStatus.CANCEL;
      report.nerStatus = MaskingReportStatus.CANCEL;
      report.status = MaskingReportStatus.CANCEL;

      await manager.getRepository(MaskingReportDAO).update(
        { maskingReportId: ticket },
        {
          regexStatus: report.regexStatus,
          nerStatus: report.nerStatus,
          status: report.status,
        },
      );

      return true;
    });
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

  /**
   * v3 스키마는 end_idx를 저장하지 않습니다. 기존 API의 반열림 범위 표현을
   * 유지하기 위해 텍스트 탐지 원문 길이로 끝 위치를 복원합니다.
   */
  private toDerivedEndIdx(
    originalText: string | null,
    startIdx: number | null,
  ): number | null {
    if (originalText === null || startIdx === null) {
      return null;
    }

    return startIdx + originalText.length;
  }
}
