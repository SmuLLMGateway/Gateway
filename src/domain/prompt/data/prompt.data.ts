import type { MaskingClass } from '../../admin/dao/policy.dao.js';
import type { MaskingContent } from '../type/masking-content.type.js';
import type { MaskingReportStatus } from '../type/masking-report-status.enum.js';
import type { PromptLogStatus } from '../type/prompt-log-status.enum.js';

export namespace PromptData {
  export interface CreatePromptRoom {
    promptRoomId: string;
    startedAt: Date;
    lastCommunicatedAt: Date;
    promptRoomTitle: string;
    memberId: string;
  }

  export interface CreatePromptLog {
    status: PromptLogStatus;
    communicatedAt: Date | null;
    modelType: string | null;
    responseText: string | null;
    usage: string | null;
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
    maskingText: string;
    recentMaskingReportId: string | null;
  }

  interface MaskingDetailReference {
    maskingReportId: string;
    departmentPolicyId: string;
  }

  export type CreateMaskingDetail = MaskingDetailReference & (
    | {
      originalText: string;
      startIdx: number;
      fileUrl: null;
      maskingText: string;
    }
    | {
      originalText: null;
      startIdx: null;
      fileUrl: string;
      maskingText: null;
    }
  );

  export interface RegexDetection {
    originalText: string;
    startIdx: number;
    endIdx: number;
    maskingText: string;
    departmentPolicyId: string;
  }

  export interface NerDetection {
    departmentPolicyId: string;
  }

  export interface NerTextDetection {
    originalText: string;
    startIdx: number;
    maskingText: string;
    departmentPolicyId: string;
  }

  export interface AnalyzeDetail {
    originalText: string | null;
    startIdx: number | null;
    endIdx: number | null;
    fileUrl: string | null;
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
