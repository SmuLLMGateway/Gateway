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
      usage: data.usage,
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
      fileUrl: data.fileUrl,
      maskingText: data.maskingText,
      maskingReportId: data.maskingReportId,
      departmentPolicyId: data.departmentPolicyId,
    });
  }

  static toMaskingFile(
    fileOriginalName: string,
    fileUrl: string,
    maskingCategory: string | null,
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
      // DB와 내부 탐지 범위는 [startIdx, endIdx)로 유지한다. API는 사용자가
      // 바로 문자 범위를 해석할 수 있도록 종료 문자의 인덱스를 반환한다.
      endIdx: endIdx - 1,
      maskingCategory,
      detailCategory,
    };
  }

  static toMasking(
    file: PromptResDTO.MaskingFile | null,
    text: PromptResDTO.MaskingText[],
  ): PromptResDTO.Masking {
    return { file, text: text.length === 0 ? null : [...text] };
  }

  static toAnalyze(
    originText: string,
    masking: PromptResDTO.Masking,
    recentDetectCnt: number,
  ): PromptResDTO.Analyze {
    return { originText, recentDetectCnt, masking };
  }

  static toAnalyzeResult(
    report: Readonly<PromptData.AnalyzeReport>,
    promptFiles: readonly Readonly<{ fileOriginalName: string; fileUrl: string }>[] = [],
  ): PromptResDTO.AnalyzeResult {
    if (report.details.length === 0) {
      return { recentDetectCnt: 0 };
    }

    const masking = this.toAnalyzeMasking(report, promptFiles);
    return this.toAnalyze(report.originalText, masking, report.details.length);
  }

  static toRecentAnalyze(
    report: Readonly<PromptData.RecentAnalyzeReport>,
    promptFiles: readonly Readonly<{ fileOriginalName: string; fileUrl: string }>[] = [],
  ): PromptResDTO.RecentAnalyze {
    return {
      ticket: report.ticket,
      recentTicket: report.recentTicket,
      originText: report.originalText,
      masking: this.toAnalyzeMasking(report, promptFiles),
    };
  }

  private static toAnalyzeMasking(
    report: Readonly<PromptData.AnalyzeReport>,
    promptFiles: readonly Readonly<{ fileOriginalName: string; fileUrl: string }>[],
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
      this.toAnalyzeFiles(promptFiles, fileDetections),
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

  private static toAnalyzeFiles(
    promptFiles: readonly Readonly<{ fileOriginalName: string; fileUrl: string }>[],
    detections: readonly PromptData.AnalyzeDetail[],
  ): PromptResDTO.MaskingFile | null {
    // 분석 요청은 FileInterceptor로 단일 파일만 허용한다. 과거 데이터에 파일이
    // 여러 개 남아 있더라도 v3 계약의 단일 file 객체에는 첫 파일만 반영한다.
    const [promptFile] = promptFiles;
    if (promptFile === undefined) {
      if (detections.length > 0) {
        throw new Error('파일 탐지 결과에 연결된 프롬프트 파일이 없습니다.');
      }
      return null;
    }

    const { fileOriginalName, fileUrl } = promptFile;
    this.validateAnalyzeFileReference(fileOriginalName, fileUrl);
    const fileDetections = detections.filter((detection) => {
      if (detection.fileUrl === null) {
        throw new Error('파일 탐지 결과의 파일 URL이 올바르지 않습니다.');
      }
      return detection.fileUrl === fileUrl;
    });
    const maskingClass = [MaskingClass.SENSITIVE, MaskingClass.PRIVATE]
      .find((candidate) => fileDetections.some(
        (detection) => detection.maskingClass === candidate,
      ));

    return this.toMaskingFile(
      fileOriginalName,
      fileUrl,
      maskingClass === undefined ? null : this.toMaskingCategory(maskingClass),
      fileDetections.length,
    );
  }

  private static validateAnalyzeFileReference(
    fileOriginalName: string,
    fileUrl: string,
  ): void {
    if (fileUrl.length === 0 || fileUrl.length > 1_024 || fileUrl.trim() !== fileUrl) {
      throw new Error('프롬프트 파일 URL이 올바르지 않습니다.');
    }
    if (fileOriginalName.length === 0 || fileOriginalName.length > 1_024 || fileOriginalName.trim() !== fileOriginalName) {
      throw new Error('프롬프트 파일 원본 이름이 올바르지 않습니다.');
    }
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
        return 'API 키';
    }
  }
}
