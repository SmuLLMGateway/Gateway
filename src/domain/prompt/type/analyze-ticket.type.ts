import type { PromptResDTO } from '../dto/prompt.response.dto.js';

interface AnalyzeTicketRecordBase {
  version: 1;
  fingerprint: string;
  operationId: string;
}

export interface AnalyzeTicketProcessingRecord extends AnalyzeTicketRecordBase {
  status: 'PROCESSING';
  createdAt: string;
}

export interface AnalyzeTicketCompletedRecord extends AnalyzeTicketRecordBase {
  status: 'COMPLETED';
  completedAt: string;
  result: PromptResDTO.Analyze;
}

export interface AnalyzeTicketFailedRecord extends AnalyzeTicketRecordBase {
  status: 'FAILED';
  failedAt: string;
  errorCode: string;
}

export type AnalyzeTicketRecord =
  | AnalyzeTicketProcessingRecord
  | AnalyzeTicketCompletedRecord
  | AnalyzeTicketFailedRecord;

export type AnalyzeTicketAcquireResult =
  | {
      type: 'ACQUIRED';
      operationId: string;
    }
  | {
      type: 'REPLAY';
      record: AnalyzeTicketRecord;
    }
  | {
      type: 'CONFLICT';
    };
