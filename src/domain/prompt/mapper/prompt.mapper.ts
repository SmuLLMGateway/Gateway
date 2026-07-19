import { PromptResDTO } from '../dto/prompt.response.dto.js';

export class PromptMapper {
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
    promptId: number,
    title: string,
    createdAt: string,
  ): PromptResDTO.RecentPrompt {
    return { promptId, title, createdAt };
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
