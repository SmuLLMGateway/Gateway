import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptData } from '../data/prompt.data.js';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { PromptMaskingDAO } from '../dao/prompt-masking.dao.js';
import { PromptRoomDAO } from '../dao/prompt-room.dao.js';

@Injectable()
export class PromptMapper {
  constructor(
    @InjectRepository(PromptRoomDAO)
    private readonly promptRoomRepository: Repository<PromptRoomDAO>,
    @InjectRepository(PromptLogDAO)
    private readonly promptLogRepository: Repository<PromptLogDAO>,
    @InjectRepository(PromptMaskingDAO)
    private readonly promptMaskingRepository: Repository<PromptMaskingDAO>,
  ) {}

  toPromptRoomDAO(data: Readonly<PromptData.CreatePromptRoom>): PromptRoomDAO {
    return this.promptRoomRepository.create({
      startedAt: data.startedAt,
      lastCommunicatedAt: data.lastCommunicatedAt,
      promptRoomTitle: data.promptRoomTitle,
      memberId: data.memberId,
    });
  }

  toPromptLogDAO(data: Readonly<PromptData.CreatePromptLog>): PromptLogDAO {
    return this.promptLogRepository.create({
      originalText: data.originalText,
      fileUrl: data.fileUrl,
      maskingText: data.maskingText,
      communicatedAt: data.communicatedAt,
      modelType: data.modelType,
      responseText: data.responseText,
      promptRoomId: data.promptRoomId,
    });
  }

  toPromptMaskingDAO(
    data: Readonly<PromptData.CreatePromptMasking>,
  ): PromptMaskingDAO {
    return this.promptMaskingRepository.create({
      maskingText: data.maskingText,
      promptLogId: data.promptLogId,
      policyId: data.policyId,
    });
  }

  static toMaskingFile(
    fileObjectId: number,
    maskingCategory: string,
    detectCnt: number,
  ): PromptResDTO.MaskingFile {
    return { fileObjectId, maskingCategory, detectCnt };
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

  static toRecentPrompt(
    data: Readonly<PromptData.RecentPrompt>,
  ): PromptResDTO.RecentPrompt {
    return {
      promptId: data.promptId,
      title: data.title,
      createdAt: data.createdAt instanceof Date
        ? data.createdAt.toISOString()
        : data.createdAt,
    };
  }

  static toRecentPromptList(
    data: readonly PromptData.RecentPrompt[],
  ): PromptResDTO.RecentPromptList {
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
}
