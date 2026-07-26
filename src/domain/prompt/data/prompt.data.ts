import type { MaskingClass } from '../../admin/dao/policy.dao.js';
import type { MaskingContent } from '../type/masking-content.type.js';
import type { MaskingReportStatus } from '../type/masking-report-status.enum.js';

export namespace PromptData {
  export interface CreatePromptRoom {
    promptRoomId: string;
    startedAt: Date;
    lastCommunicatedAt: Date;
    promptRoomTitle: string;
    memberId: string;
  }

  export interface CreatePromptLog {
    status: MaskingReportStatus | null;
    communicatedAt: Date;
    modelType: string;
    responseText: string | null;
    promptSummary: string;
    promptRoomId: string;
    maskingReportId: string;
  }

  export interface CreateMaskingReport {
    maskingReportId: string;
    status: MaskingReportStatus;
    regexStatus: MaskingReportStatus;
    nerStatus: MaskingReportStatus;
    memberId: string;
    originalText: string;
    recentMaskingReportId: string | null;
  }

  interface MaskingDetailReference {
    maskingReportId: string;
    policyId: string;
  }

  export type CreateMaskingDetail = MaskingDetailReference & (
    | {
      originalText: string;
      startIdx: number;
      endIdx: number;
      fileUrl: null;
      maskingText: string;
    }
    | {
      originalText: null;
      startIdx: null;
      endIdx: null;
      fileUrl: string;
      maskingText: null;
    }
  );

  export interface RegexDetection {
    originalText: string;
    startIdx: number;
    endIdx: number;
    maskingText: string;
    policyId: string;
  }

  export interface NerDetection {
    policyId: string;
  }

  export interface AnalyzeDetail {
    originalText: string | null;
    startIdx: number | null;
    endIdx: number | null;
    maskingContent: MaskingContent;
    maskingClass: MaskingClass;
  }

  export interface AnalyzeReport {
    status: MaskingReportStatus;
    originalText: string;
    details: AnalyzeDetail[];
  }

  export interface RecentAnalyzeReport extends AnalyzeReport {
    ticket: string;
    recentTicket: string | null;
  }

  /** 프롬프트 과거 기록 조회 결과의 원본 데이터 */
  export interface RecentPrompt {
    chatRoomId: string;
    title: string;
    createdAt: Date | string;
  }
}
