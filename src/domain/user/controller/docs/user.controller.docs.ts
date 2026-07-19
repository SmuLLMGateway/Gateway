import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
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
import { UserSuccessStatus } from '../../code/user.status.js';
import { UserResDTO } from '../../dto/user.response.dto.js';

const commonErrors = () =>
  ApiErrorResponses([
    AuthErrorStatus.TOKEN_EXPIRED,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

export const UserControllerDocs = () =>
  applyDecorators(
    ApiTags('사용자'),
    ApiBearerAuth(),
    ApiExtraModels(UserResDTO.MessageSummary),
  );

export const MessageSummaryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '대화 기록 요약 조회 API' }),
    ApiSuccessResponse(
      UserSuccessStatus.MESSAGE_SUMMARY,
      SwaggerResultSchema.model(getSchemaPath(UserResDTO.MessageSummary)),
    ),
    ...commonErrors(),
  );

export const MessageListDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '대화 기록 조회 API' }),
    ApiSuccessResponse(UserSuccessStatus.MESSAGE_LIST, SwaggerResultSchema.unknown()),
    ...commonErrors(),
  );
