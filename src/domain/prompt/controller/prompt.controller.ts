import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GeneralResponse } from '../../../global/apiPayload/general.response.js';
import { PromptSuccessStatus } from '../code/prompt.status.js';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptService } from '../service/prompt.service.js';
import {
  AnalyzeDocs,
  FileDownloadDocs,
  LlmRequestDocs,
  LlmResponseDocs,
  PrePromptDocs,
  PromptControllerDocs,
  RecentPromptListDocs,
  SearchPromptDocs,
} from './docs/prompt.controller.docs.js';

@PromptControllerDocs()
@Controller()
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @PrePromptDocs()
  @Post('/api/v1/analyze')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async requestAnalyze(
    @UploadedFile() file: unknown,
    @Body('json') dto: PromptReqDTO.PrePrompt,
  ): Promise<GeneralResponse<PromptResDTO.Empty>> {
    const result = await this.promptService.requestAnalyze(dto, file);
    return GeneralResponse.onSuccess(PromptSuccessStatus.PREPROMPT_REQUEST, result);
  }

  @AnalyzeDocs()
  @Get('/api/v1/analyze')
  async getAnalyze(
    @Body() dto: PromptReqDTO.Analyze,
  ): Promise<GeneralResponse<PromptResDTO.Analyze | null>> {
    const result = await this.promptService.getAnalyze(dto);
    return GeneralResponse.onSuccess(PromptSuccessStatus.ANALYZE, result);
  }

  @LlmRequestDocs()
  @Post('/api/v1/prompt')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async requestLlm(
    @UploadedFile() file: unknown,
    @Body('json') dto: PromptReqDTO.LlmRequest,
  ): Promise<GeneralResponse<PromptResDTO.Empty>> {
    const result = await this.promptService.requestLlm(dto, file);
    return GeneralResponse.onSuccess(PromptSuccessStatus.LLM_REQUEST, result);
  }

  @LlmResponseDocs()
  @Get('/api/v1/prompt')
  async getLlmResponse(
    @Body() dto: PromptReqDTO.LlmResponse,
  ): Promise<GeneralResponse<PromptResDTO.LlmResponse>> {
    const result = await this.promptService.getLlmResponse(dto);
    return GeneralResponse.onSuccess(PromptSuccessStatus.LLM_RESPONSE, result);
  }

  @RecentPromptListDocs()
  @Get('/api/v1/prompts')
  async getRecentPrompts(): Promise<GeneralResponse<PromptResDTO.RecentPromptList>> {
    const result = await this.promptService.getRecentPrompts();
    return GeneralResponse.onSuccess(PromptSuccessStatus.RECENT_PROMPT_LIST, result);
  }

  @FileDownloadDocs()
  @Get('/api/v1/download')
  async downloadFile(
    @Body() dto: PromptReqDTO.FileDownload,
  ): Promise<GeneralResponse<PromptResDTO.FileDownload>> {
    const result = await this.promptService.downloadFile(dto);
    return GeneralResponse.onSuccess(PromptSuccessStatus.FILE_DOWNLOAD, result);
  }

  @SearchPromptDocs()
  @Get('/api/v1/prompts/search')
  async searchPrompts(
    @Query() dto: PromptReqDTO.Search,
  ): Promise<GeneralResponse<PromptResDTO.Search>> {
    const result = await this.promptService.searchPrompts(dto);
    return GeneralResponse.onSuccess(PromptSuccessStatus.SEARCH_PROMPT, result);
  }
}
