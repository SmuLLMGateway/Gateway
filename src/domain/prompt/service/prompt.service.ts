import { Injectable } from '@nestjs/common';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptResDTO } from '../dto/prompt.response.dto.js';

@Injectable()
export class PromptService {
  async requestAnalyze(
    dto: PromptReqDTO.PrePrompt,
    file: unknown,
  ): Promise<PromptResDTO.Empty> {
    void dto;
    void file;
    return null;
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
    return '';
  }

  async getRecentPrompts(): Promise<PromptResDTO.RecentPromptList> {
    return [];
  }

  async downloadFile(dto: PromptReqDTO.FileDownload): Promise<PromptResDTO.FileDownload> {
    void dto;
    return '';
  }

  async searchPrompts(dto: PromptReqDTO.Search): Promise<PromptResDTO.Search> {
    void dto;
    return null;
  }
}
