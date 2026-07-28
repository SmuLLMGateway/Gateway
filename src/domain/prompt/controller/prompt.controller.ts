import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GeneralResponse } from '../../../global/apiPayload/general.response.js';
import { PromptSuccessStatus } from '../code/prompt.status.js';
import { PromptReqDTO } from '../dto/prompt.request.dto.js';
import { PromptResDTO } from '../dto/prompt.response.dto.js';
import { PromptService } from '../service/prompt.service.js';
import { ParsePrePromptJsonPipe } from '../pipe/parse-pre-prompt-json.pipe.js';
import { ParseOptionalPromptFileFieldPipe } from '../pipe/parse-optional-prompt-file-field.pipe.js';
import { CurrentUser } from '../../../global/security/decorator/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';
import { PromptFileExceptionInterceptor } from '../interceptor/prompt-file-exception.interceptor.js';
import { PromptStagedFileCleanupInterceptor } from '../interceptor/prompt-staged-file-cleanup.interceptor.js';
import type { StoredPromptFile } from '../type/stored-prompt-file.type.js';
import { ParseAnalyzeQueryPipe } from '../pipe/parse-analyze-query.pipe.js';
import {
  ParseFileDownloadBodyPipe as ParseFileDownloadQueryPipe,
} from '../pipe/parse-file-download-body.pipe.js';
import type { Response } from 'express';
import {
  AnalysisStatusCheckDocs,
  ChatRoomListDocs,
  FileDownloadDocs,
  LlmResultCheckDocs,
  LlmSendDocs,
  MaskingElementDetectionRequestDocs,
  ModelListDocs,
  PromptListDocs,
  PromptControllerDocs,
  RecentMaskingElementDetectionDocs,
} from './docs/prompt.controller.docs.js';

@PromptControllerDocs()
@Controller()
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @MaskingElementDetectionRequestDocs()
  @Post('/api/v1/analyze')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    PromptStagedFileCleanupInterceptor,
    PromptFileExceptionInterceptor,
    FileInterceptor('file'),
  )
  async requestMaskingElementDetection(
    @UploadedFile() file: StoredPromptFile | undefined,
    @Body('file', ParseOptionalPromptFileFieldPipe) _emptyFileField: undefined,
    @Body('json', ParsePrePromptJsonPipe) dto: PromptReqDTO.PrePrompt,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<PromptResDTO.AnalyzeRequest>> {
    const result = await this.promptService.requestAnalyze(
      dto,
      file,
      authentication,
    );
    return GeneralResponse.onSuccess(PromptSuccessStatus.PREPROMPT_REQUEST, result);
  }

  @AnalysisStatusCheckDocs()
  @Get('/api/v1/analyze')
  async checkAnalysisStatus(
    @Query(ParseAnalyzeQueryPipe) dto: PromptReqDTO.Analyze,
    @CurrentUser() authentication: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GeneralResponse<PromptResDTO.Analyze | null>> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    const analyze = await this.promptService.getAnalyze(dto, authentication);
    if (analyze.pending) {
      response.status(PromptSuccessStatus.BEFORE_ANALYZE.httpStatus);
      return GeneralResponse.onSuccess(
        PromptSuccessStatus.BEFORE_ANALYZE,
        null,
      );
    }

    return GeneralResponse.onSuccess(
      PromptSuccessStatus.ANALYZE,
      analyze.result,
    );
  }

  @LlmSendDocs()
  @Post('/api/v1/prompt')
  @HttpCode(HttpStatus.OK)
  async sendToLlm(
    @Body() dto: PromptReqDTO.LlmRequest,
  ): Promise<GeneralResponse<PromptResDTO.Empty>> {
    const result = await this.promptService.requestLlm(dto);
    return GeneralResponse.onSuccess(PromptSuccessStatus.LLM_REQUEST, result);
  }

  @LlmResultCheckDocs()
  @Get('/api/v1/prompt')
  async checkLlmResult(
    @Query() dto: PromptReqDTO.LlmResponse,
  ): Promise<GeneralResponse<PromptResDTO.LlmResponse>> {
    const llmResponse = await this.promptService.getLlmResponse(dto);
    if (llmResponse.pending) {
      return GeneralResponse.onSuccess(
        PromptSuccessStatus.BEFORE_LLM_RESPONSE,
        null,
      );
    }

    return GeneralResponse.onSuccess(
      PromptSuccessStatus.LLM_RESPONSE,
      llmResponse.result,
    );
  }

  @ChatRoomListDocs()
  @Get('/api/v1/chat-rooms')
  async getChatRoomList(
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<PromptResDTO.RecentPromptList>> {
    const result = await this.promptService.getRecentPrompts(authentication);
    return GeneralResponse.onSuccess(PromptSuccessStatus.RECENT_PROMPT_LIST, result);
  }

  @ModelListDocs()
  @Get('/api/v1/models')
  async getModelList(
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<PromptResDTO.ModelList>> {
    const result = await this.promptService.getModels(authentication);
    return GeneralResponse.onSuccess(PromptSuccessStatus.MODEL_LIST, result);
  }

  @RecentMaskingElementDetectionDocs()
  @Get('/api/v1/chat-rooms/:chatRoomId/recent-analyze')
  async getRecentMaskingElementDetection(
    @Param('chatRoomId', new ParseUUIDPipe({ version: '4' }))
    chatRoomId: string,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<PromptResDTO.RecentAnalyze>> {
    const result = await this.promptService.getRecentAnalyze(
      chatRoomId,
      authentication,
    );
    return GeneralResponse.onSuccess(
      PromptSuccessStatus.RECENT_ANALYZE,
      result,
    );
  }

  @PromptListDocs()
  @Get('/api/v1/chat-rooms/:chatRoomId/prompts')
  async getPromptList(
    @Param('chatRoomId', new ParseUUIDPipe({ version: '4' }))
    chatRoomId: string,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<PromptResDTO.PromptList>> {
    const result = await this.promptService.getPromptList(chatRoomId, authentication);
    return GeneralResponse.onSuccess(PromptSuccessStatus.PROMPT_LIST, result);
  }

  @FileDownloadDocs()
  @Get('/api/v1/download')
  async downloadFile(
    @Query(ParseFileDownloadQueryPipe) dto: PromptReqDTO.FileDownload,
    @CurrentUser() authentication: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GeneralResponse<PromptResDTO.FileDownload>> {
    const result = await this.promptService.downloadFile(dto, authentication);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    return GeneralResponse.onSuccess(PromptSuccessStatus.FILE_DOWNLOAD, result);
  }

}
