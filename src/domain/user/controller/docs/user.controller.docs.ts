import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AdminErrorStatus } from '../../../admin/code/admin.status.js';
import { ErrorStatus } from '../../../../global/apiPayload/code/status.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  SwaggerResultSchema,
} from '../../../../global/config/swagger.response.js';
import {
  UserErrorStatus,
  UserSuccessStatus,
} from '../../code/user.status.js';
import { UserReqDTO } from '../../dto/user.request.dto.js';
import { UserResDTO } from '../../dto/user.response.dto.js';

const commonErrors = () =>
  ApiErrorResponses([
    UserErrorStatus.TOKEN_EXPIRED,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

export const UserControllerDocs = () =>
  applyDecorators(
    ApiTags('마이페이지'),
    ApiBearerAuth(),
    ApiExtraModels(
      UserReqDTO.MessageList,
      UserResDTO.MessageHistoryItem,
      UserResDTO.MessageHistory,
      UserResDTO.MessageSummary,
      UserResDTO.DepartmentPolicyItem,
      UserResDTO.DepartmentPolicyList,
      UserResDTO.UserInfo,
    ),
  );

export const MessageHistorySummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '대화 기록 요약 조회',
      description: '현재 사용자의 대화 기록 집계 요약을 조회합니다.',
    }),
    ApiSuccessResponse(
      UserSuccessStatus.MESSAGE_SUMMARY,
      SwaggerResultSchema.model(getSchemaPath(UserResDTO.MessageSummary)),
    ),
    ...commonErrors(),
  );

export const UserInfoDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '사용자 정보 조회',
      description: '현재 로그인한 사용자의 정보를 조회합니다. 부서 미소속 총 관리자의 department는 null, departmentLimitRate는 0으로 반환합니다.',
    }),
    ApiSuccessResponse(
      UserSuccessStatus.USER_INFO,
      SwaggerResultSchema.model(getSchemaPath(UserResDTO.UserInfo)),
    ),
    ...commonErrors(),
  );

export const MessageHistoryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '대화 기록 조회',
      description: '조회 기간에 전송된 대화 기록을 프롬프트 단위로 조회합니다. promptId는 숫자 prompt_log_id이고, 분석 UUID는 ticket으로 별도 반환합니다. model·query·sort는 함께 사용할 수 있습니다.',
    }),
    ApiQuery({
      name: 'recent',
      required: true,
      schema: {
        type: 'string',
        example: '7d',
        enum: ['7d', '30d', '90d', 'all'],
      },
      description: '불러올 대화 기록의 기간: 7d, 30d, 90d, all',
    }),
    ApiQuery({
      name: 'pageSize',
      type: Number,
      required: true,
      description: '불러올 데이터 수',
    }),
    ApiQuery({
      name: 'pageNumber',
      type: Number,
      required: true,
      description: '현재 페이지 번호(1부터 시작)',
    }),
    ApiQuery({
      name: 'model',
      type: String,
      required: false,
      enum: ['claude', 'gpt', 'gemini', 'local'],
      description: 'LLM 서비스 또는 로컬 LLM 필터',
    }),
    ApiQuery({
      name: 'query',
      type: String,
      required: false,
      description: '프롬프트 요약 또는 원문 검색 키워드',
    }),
    ApiQuery({
      name: 'sort',
      type: String,
      required: false,
      enum: ['recent', 'oldest'],
      description: '정렬 방향. 생략 시 recent(최신순)',
    }),
    ApiSuccessResponse(
      UserSuccessStatus.MESSAGE_LIST,
      SwaggerResultSchema.model(
        getSchemaPath(UserResDTO.MessageHistory),
        true,
      ),
    ),
    ...ApiErrorResponses([
      UserErrorStatus.INVALID_MESSAGE_LIST,
      UserErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const DepartmentPolicyListDocs = () =>
  applyDecorators(
    ApiTags('마이페이지'),
    ApiExtraModels(
      UserResDTO.DepartmentPolicyItem,
      UserResDTO.DepartmentPolicyList,
    ),
    ApiOperation({
      summary: '부서 정책 목록 조회',
      description: '현재 사용자가 소속된 부서의 정책 목록을 조회합니다.',
    }),
    ApiSuccessResponse(
      UserSuccessStatus.POLICY_LIST,
      SwaggerResultSchema.model(
        getSchemaPath(UserResDTO.DepartmentPolicyList),
        true,
      ),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.DEPARTMENT_NOT_FOUND,
      UserErrorStatus.FORBIDDEN,
      UserErrorStatus.TOKEN_EXPIRED,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
