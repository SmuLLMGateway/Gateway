import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptData } from '../data/prompt.data.js';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { PromptRoomDAO } from '../dao/prompt-room.dao.js';
import { MaskingDetailDAO } from '../dao/masking-detail.dao.js';
import { MaskingReportDAO } from '../dao/masking-report.dao.js';
import { MaskingClass } from '../../admin/dao/policy.dao.js';
import {
  MASKING_CONTENT,
  type MaskingContent,
} from '../type/masking-content.type.js';

@Injectable()
export class PromptMapper {
  constructor(
    @InjectRepository(PromptRoomDAO)
    private readonly promptRoomRepository: Repository<PromptRoomDAO>,
    @InjectRepository(PromptLogDAO)
    private readonly promptLogRepository: Repository<PromptLogDAO>,
    @InjectRepository(MaskingReportDAO)
    private readonly maskingReportRepository: Repository<MaskingReportDAO>,
    @InjectRepository(MaskingDetailDAO)
    private readonly maskingDetailRepository: Repository<MaskingDetailDAO>,
  ) {}

  toPromptRoomDAO(data: Readonly<PromptData.CreatePromptRoom>): PromptRoomDAO {
    return this.promptRoomRepository.create({
      promptRoomId: data.promptRoomId,
      startedAt: data.startedAt,
      lastCommunicatedAt: data.lastCommunicatedAt,
      promptRoomTitle: data.promptRoomTitle,
      memberId: data.memberId,
    });
  }

  toPromptLogDAO(data: Readonly<PromptData.CreatePromptLog>): PromptLogDAO {
    return this.promptLogRepository.create({
      status: data.status,
      communicatedAt: data.communicatedAt,
      modelType: data.modelType,
      responseText: data.responseText,
      promptSummary: data.promptSummary,
      promptRoomId: data.promptRoomId,
      maskingReportId: data.maskingReportId,
    });
  }

  toMaskingReportDAO(
    data: Readonly<PromptData.CreateMaskingReport>,
  ): MaskingReportDAO {
    return this.maskingReportRepository.create({
      maskingReportId: data.maskingReportId,
      status: data.status,
      regexStatus: data.regexStatus,
      nerStatus: data.nerStatus,
      memberId: data.memberId,
      originalText: data.originalText,
      recentMaskingReportId: data.recentMaskingReportId,
    });
  }

  toMaskingDetailDAO(
    data: Readonly<PromptData.CreateMaskingDetail>,
  ): MaskingDetailDAO {
    return this.maskingDetailRepository.create({
      originalText: data.originalText,
      startIdx: data.startIdx,
      endIdx: data.endIdx,
      fileUrl: data.fileUrl,
      maskingText: data.maskingText,
      maskingReportId: data.maskingReportId,
      policyId: data.policyId,
    });
  }

  static toMaskingFile(
    fileOriginalName: string,
    fileUrl: string,
    maskingCategory: string,
    detectCnt: number,
  ): PromptResDTO.MaskingFile {
    return { fileOriginalName, fileUrl, maskingCategory, detectCnt };
  }

  static toMaskingText(
    targetText: string,
    startIdx: number,
    endIdx: number,
    maskingCategory: string,
    detailCategory: string,
  ): PromptResDTO.MaskingText {
    return {
      targetText,
      startIdx,
      endIdx,
      maskingCategory,
      detailCategory,
    };
  }

  static toMasking(
    file: PromptResDTO.MaskingFile | null,
    text: PromptResDTO.MaskingText[],
  ): PromptResDTO.Masking {
    return { file, text: [...text] };
  }

  static toAnalyze(
    originText: string,
    masking: PromptResDTO.Masking,
  ): PromptResDTO.Analyze {
    return { originText, masking };
  }

  static toAnalyzeResult(
    report: Readonly<PromptData.AnalyzeReport>,
    promptFile?: Readonly<{ fileOriginalName: string; fileUrl: string }>,
  ): PromptResDTO.Analyze | null {
    const masking = this.toAnalyzeMasking(report, promptFile);
    if (masking.text.length === 0 && masking.file === null) {
      return null;
    }

    return this.toAnalyze(report.originalText, masking);
  }

  static toRecentAnalyze(
    report: Readonly<PromptData.RecentAnalyzeReport>,
    promptFile?: Readonly<{ fileOriginalName: string; fileUrl: string }>,
  ): PromptResDTO.RecentAnalyze {
    return {
      ticket: report.ticket,
      recentTicket: report.recentTicket,
      originText: report.originalText,
      masking: this.toAnalyzeMasking(report, promptFile),
    };
  }

  private static toAnalyzeMasking(
    report: Readonly<PromptData.AnalyzeReport>,
    promptFile?: Readonly<{ fileOriginalName: string; fileUrl: string }>,
  ): PromptResDTO.Masking {
    const text: PromptResDTO.MaskingText[] = [];
    const fileDetections: PromptData.AnalyzeDetail[] = [];

    for (const detail of report.details) {
      const isFileDetection = detail.originalText === null
        && detail.startIdx === null
        && detail.endIdx === null;
      if (isFileDetection) {
        fileDetections.push(detail);
        continue;
      }

      if (
        detail.originalText === null
        || detail.startIdx === null
        || detail.endIdx === null
      ) {
        throw new Error('마스킹 텍스트 상세 데이터가 올바르지 않습니다.');
      }

      text.push(this.toMaskingText(
        detail.originalText,
        detail.startIdx,
        detail.endIdx,
        this.toMaskingCategory(detail.maskingClass),
        this.toDetailCategory(detail.maskingContent),
      ));
    }

    return this.toMasking(
      this.toAnalyzeFile(promptFile, fileDetections),
      text,
    );
  }

  static toRecentPrompt(
    data: Readonly<PromptData.RecentPrompt>,
  ): PromptResDTO.RecentPrompt {
    if (data.chatRoomId.length === 0) {
      throw new Error('프롬프트 채팅방 ID가 올바르지 않습니다.');
    }

    return {
      chatRoomId: data.chatRoomId,
      title: data.title,
      createdAt: data.createdAt instanceof Date
        ? data.createdAt.toISOString()
        : data.createdAt,
    };
  }

  static toRecentPromptList(
    data: readonly PromptData.RecentPrompt[],
  ): PromptResDTO.RecentPromptList {
    if (data.length === 0) {
      return null;
    }

    return data.map((item) => this.toRecentPrompt(item));
  }

  static toLlmResponse(response: string): PromptResDTO.LlmResponse {
    return response;
  }

  static toFileDownload(url: string): PromptResDTO.FileDownload {
    return url;
  }

  static toSearch<T>(result: T): T {
    return result;
  }

  private static toAnalyzeFile(
    promptFile:
      | Readonly<{ fileOriginalName: string; fileUrl: string }>
      | undefined,
    detections: readonly PromptData.AnalyzeDetail[],
  ): PromptResDTO.MaskingFile | null {
    if (detections.length === 0) {
      return null;
    }

    if (promptFile === undefined) {
      throw new Error('파일 탐지 결과에 연결된 프롬프트 파일이 없습니다.');
    }

    const { fileOriginalName, fileUrl } = promptFile;
    if (
      fileUrl.length === 0
      || fileUrl.length > 1_024
      || fileUrl.trim() !== fileUrl
    ) {
      throw new Error('프롬프트 파일 URL이 올바르지 않습니다.');
    }
    if (
      fileOriginalName.length === 0
      || fileOriginalName.length > 1_024
      || fileOriginalName.trim() !== fileOriginalName
    ) {
      throw new Error('프롬프트 파일 원본 이름이 올바르지 않습니다.');
    }

    const maskingCategory = detections.some(
      (detection) => detection.maskingClass === MaskingClass.SENSITIVE,
    )
      ? this.toMaskingCategory(MaskingClass.SENSITIVE)
      : this.toMaskingCategory(MaskingClass.PRIVATE);

    return this.toMaskingFile(
      fileOriginalName,
      fileUrl,
      maskingCategory,
      detections.length,
    );
  }

  private static toMaskingCategory(maskingClass: MaskingClass): string {
    switch (maskingClass) {
      case MaskingClass.PRIVATE:
        return '개인정보';
      case MaskingClass.SENSITIVE:
        return '민감정보';
    }
  }

  private static toDetailCategory(maskingContent: MaskingContent): string {
    switch (maskingContent) {
      case MASKING_CONTENT.PHONE:
        return '전화번호';
      case MASKING_CONTENT.RESIDENT:
        return '주민등록번호';
      case MASKING_CONTENT.CARD:
        return '카드번호';
      case MASKING_CONTENT.EMAIL:
        return '이메일';
      case MASKING_CONTENT.API_KEY:
        return 'API Key';
    }
  }
}
