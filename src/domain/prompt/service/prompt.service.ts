import { Injectable } from '@nestjs/common';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptMapper } from '../mapper/prompt.mapper.js';
import { PromptErrorStatus } from '../code/prompt.status.js';
import { PromptException } from '../exception/prompt.exception.js';
import { RegexMaskingDetectorService } from './regex-masking-detector.service.js';
import { PromptFileValidatorService } from './prompt-file-validator.service.js';
import { NerClient } from '../client/ner.client.js';
import { AnalyzeTicketRepository } from '../repository/analyze-ticket.repository.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { GatewayException } from '../../../global/apiPayload/exception/gateway.exception.js';
import { ErrorStatus } from '../../../global/apiPayload/code/status.js';

@Injectable()
export class PromptService {
  constructor(
    private readonly regexDetector: RegexMaskingDetectorService,
    private readonly fileValidator: PromptFileValidatorService,
    private readonly nerClient: NerClient,
    private readonly analyzeTicketRepository: AnalyzeTicketRepository,
  ) {}

  async requestAnalyze(
    dto: PromptReqDTO.PrePrompt,
    file: Express.Multer.File | undefined,
    authentication: AuthenticatedUser,
  ): Promise<PromptResDTO.Empty> {
    const validatedFile = this.fileValidator.validate(file);
    const fingerprint = this.analyzeTicketRepository.createFingerprint(
      dto.model,
      dto.text,
      validatedFile?.buffer,
    );
    const acquisition = await this.acquireAnalyzeTicket(
      authentication.userId,
      dto.ticket,
      fingerprint,
    );

    if (acquisition.type === 'CONFLICT') {
      throw new PromptException(PromptErrorStatus.DUPLICATED_TICKET);
    }

    if (acquisition.type === 'REPLAY') {
      if (acquisition.record.status === 'FAILED') {
        throw new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
      }

      return null;
    }

    try {
      const textDetections = this.regexDetector.detect(dto.text);
      const fileDetection = validatedFile === undefined
        ? null
        : await this.nerClient.analyzeFile(
            validatedFile,
            dto.ticket,
            `prompt-analyze:${authentication.userId}:${dto.ticket}`,
          );
      const result = PromptMapper.toAnalyze(
        dto.text,
        PromptMapper.toMasking(fileDetection, textDetections),
      );
      const completed = await this.completeAnalyzeTicket(
        authentication.userId,
        dto.ticket,
        acquisition.operationId,
        fingerprint,
        result,
      );

      if (!completed) {
        throw new PromptException(
          PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
        );
      }

      return null;
    } catch (error: unknown) {
      await this.failAnalyzeTicket(
        authentication.userId,
        dto.ticket,
        acquisition.operationId,
        fingerprint,
        this.getErrorCode(error),
      );

      throw error;
    }
  }

  async getAnalyze(dto: PromptReqDTO.Analyze): Promise<PromptResDTO.Analyze | null> {
    void dto;
    return null;
  }

  async requestLlm(
    dto: PromptReqDTO.LlmRequest,
    file: unknown,
  ): Promise<PromptResDTO.Empty> {
    void dto;
    void file;
    return null;
  }

  async getLlmResponse(dto: PromptReqDTO.LlmResponse): Promise<PromptResDTO.LlmResponse> {
    void dto;
    return PromptMapper.toLlmResponse('');
  }

  async getRecentPrompts(): Promise<PromptResDTO.RecentPromptList> {
    return PromptMapper.toRecentPromptList([]);
  }

  async downloadFile(dto: PromptReqDTO.FileDownload): Promise<PromptResDTO.FileDownload> {
    void dto;
    return PromptMapper.toFileDownload('');
  }

  async searchPrompts(dto: PromptReqDTO.Search): Promise<PromptResDTO.Search> {
    void dto;
    return PromptMapper.toSearch(null);
  }

  private async acquireAnalyzeTicket(
    memberId: number,
    ticket: string,
    fingerprint: string,
  ) {
    try {
      return await this.analyzeTicketRepository.acquire(
        memberId,
        ticket,
        fingerprint,
      );
    } catch {
      throw new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
    }
  }

  private async completeAnalyzeTicket(
    memberId: number,
    ticket: string,
    operationId: string,
    fingerprint: string,
    result: PromptResDTO.Analyze,
  ): Promise<boolean> {
    try {
      return await this.analyzeTicketRepository.complete(
        memberId,
        ticket,
        operationId,
        fingerprint,
        result,
      );
    } catch {
      throw new PromptException(PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE);
    }
  }

  private async failAnalyzeTicket(
    memberId: number,
    ticket: string,
    operationId: string,
    fingerprint: string,
    errorCode: string,
  ): Promise<void> {
    try {
      await this.analyzeTicketRepository.fail(
        memberId,
        ticket,
        operationId,
        fingerprint,
        errorCode,
      );
    } catch {
      // 최초 오류를 유지하며 Redis 장애 상세나 민감 데이터를 로그로 남기지 않습니다.
    }
  }

  private getErrorCode(error: unknown): string {
    return error instanceof GatewayException
      ? error.baseStatus.code
      : ErrorStatus.INTERNAL_SERVER_ERROR.code;
  }
}
