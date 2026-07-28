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
      description: '현재 로그인한 사용자의 정보를 조회합니다.',
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
      description: '조회 기간에 전송된 대화 기록을 프롬프트 단위로 조회합니다.',
    }),
    ApiQuery({
      name: 'recent',
      type: String,
      required: true,
      enum: ['7일전', '30일전', '90일전', '전체'],
      description: '불러올 대화 기록의 기간',
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
      name: 'orderBy',
      type: String,
      required: false,
      enum: ['claude', 'gpt', 'local'],
      description: '정렬 기준. query와 동시에 사용할 수 없습니다.',
    }),
    ApiQuery({
      name: 'query',
      type: String,
      required: false,
      description: '검색 키워드. orderBy와 동시에 사용할 수 없습니다.',
    }),
    ApiSuccessResponse(
      UserSuccessStatus.MESSAGE_LIST,
      SwaggerResultSchema.model(
        getSchemaPath(UserResDTO.MessageHistory),
        true,
      ),
    ),
    ...commonErrors(),
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
