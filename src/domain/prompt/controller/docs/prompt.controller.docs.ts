import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthErrorStatus } from '../../../auth/code/auth.status.js';
import { ErrorStatus } from '../../../../global/apiPayload/code/status.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  SwaggerResultSchema,
} from '../../../../global/config/swagger.response.js';
import { PromptErrorStatus, PromptSuccessStatus } from '../../code/prompt.status.js';
import { PromptResDTO } from '../../dto/prompt.response.dto.js';

const multipartBody = (example: string) =>
  ApiBody({
    schema: {
      type: 'object',
      required: ['json'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '선택 파일(.pdf, .jpeg, .jpg, .png, 최대 10MB)',
        },
        json: {
          type: 'string',
          description: 'JSON 문자열',
          example,
        },
      },
    },
  });

const requestErrors = () =>
  ApiErrorResponses([
    PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    PromptErrorStatus.INVALID_FILE_FORM,
    PromptErrorStatus.DUPLICATED_TICKET,
    AuthErrorStatus.TOKEN_EXPIRED,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

const analyzeRequestErrors = () =>
  ApiErrorResponses([
    PromptErrorStatus.INVALID_FILE_FORM,
    PromptErrorStatus.DUPLICATED_TICKET,
    PromptErrorStatus.INVALID_ANALYZE_REQUEST,
    PromptErrorStatus.NER_SERVER_ERROR,
    PromptErrorStatus.ANALYZE_SERVICE_UNAVAILABLE,
    AuthErrorStatus.TOKEN_EXPIRED,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

export const PromptControllerDocs = () =>
  applyDecorators(
    ApiTags('프롬프트'),
    ApiBearerAuth(),
    ApiExtraModels(
      PromptResDTO.Analyze,
      PromptResDTO.Masking,
      PromptResDTO.MaskingFile,
      PromptResDTO.MaskingText,
      PromptResDTO.RecentPrompt,
    ),
  );

export const PrePromptDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '마스킹 요소 탐지 요청 API' }),
    ApiConsumes('multipart/form-data'),
    multipartBody('{"model":"Claude Sonnet 5","text":"원본 텍스트","ticket":"UUID"}'),
    ApiSuccessResponse(PromptSuccessStatus.PREPROMPT_REQUEST, SwaggerResultSchema.null()),
    ...analyzeRequestErrors(),
  );

export const AnalyzeDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '분석 여부 확인 API' }),
    ApiSuccessResponse(
      PromptSuccessStatus.ANALYZE,
      SwaggerResultSchema.model(getSchemaPath(PromptResDTO.Analyze), true),
    ),
    ApiResponse({
      status: PromptSuccessStatus.BEFORE_ANALYZE.httpStatus,
      description: PromptSuccessStatus.BEFORE_ANALYZE.message,
    }),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_ANAL_REQ,
      AuthErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const LlmRequestDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'LLM 전송 API' }),
    ApiConsumes('multipart/form-data'),
    multipartBody('{"model":"Claude Sonnet 5","text":"수정한 텍스트","ticket":"UUID"}'),
    ApiSuccessResponse(PromptSuccessStatus.LLM_REQUEST, SwaggerResultSchema.null()),
    ...requestErrors(),
  );

export const LlmResponseDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'LLM 결과 확인 API' }),
    ApiSuccessResponse(PromptSuccessStatus.LLM_RESPONSE, SwaggerResultSchema.string()),
    ApiResponse({
      status: PromptSuccessStatus.BEFORE_LLM_RESPONSE.httpStatus,
      description: PromptSuccessStatus.BEFORE_LLM_RESPONSE.message,
    }),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_ANAL_REQ,
      AuthErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const RecentPromptListDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '프롬프트 과거 기록 조회 API' }),
    ApiSuccessResponse(
      PromptSuccessStatus.RECENT_PROMPT_LIST,
      SwaggerResultSchema.array(getSchemaPath(PromptResDTO.RecentPrompt), true),
    ),
    ...ApiErrorResponses([
      AuthErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const FileDownloadDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '파일 다운로드 URL 생성 API' }),
    ApiSuccessResponse(
      PromptSuccessStatus.FILE_DOWNLOAD,
      SwaggerResultSchema.string('uri'),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_FILE,
      PromptErrorStatus.FORBIDDEN_FILE_DOWNLOAD,
      AuthErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const SearchPromptDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '대화 검색 API' }),
    ApiSuccessResponse(PromptSuccessStatus.SEARCH_PROMPT, SwaggerResultSchema.unknown()),
    ...ApiErrorResponses([
      AuthErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
