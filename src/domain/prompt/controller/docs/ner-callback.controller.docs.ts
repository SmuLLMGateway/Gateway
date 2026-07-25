import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiExcludeController,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorStatus } from '../../../../global/apiPayload/code/status.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  SwaggerResultSchema,
} from '../../../../global/config/swagger.response.js';
import { SecurityErrorStatus } from '../../../../global/security/code/security.status.js';
import { PromptErrorStatus, PromptSuccessStatus } from '../../code/prompt.status.js';
import { NerCallbackRequestDTO } from '../../dto/ner-callback.request.dto.js';

export const NerCallbackControllerDocs = () =>
  applyDecorators(
    ApiExcludeController(),
    ApiTags('NER 내부 연동'),
  );

export const NerCallbackDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'NER 마스킹 탐지 결과 콜백 API' }),
    ApiHeader({
      name: 'x-ner-callback-secret',
      required: true,
      description: 'Gateway와 NER 서버가 공유하는 내부 인증 값',
    }),
    ApiBody({ type: NerCallbackRequestDTO }),
    ApiSuccessResponse(
      PromptSuccessStatus.NER_CALLBACK,
      SwaggerResultSchema.null(),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.INVALID_NER_CALLBACK,
      PromptErrorStatus.NOT_FOUND_ANAL_REQ,
      SecurityErrorStatus.TOKEN_INVALID,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
