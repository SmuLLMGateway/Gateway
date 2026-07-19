import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
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
import { AdminErrorStatus, AdminSuccessStatus } from '../../code/admin.status.js';
import { AdminResDTO } from '../../dto/admin.response.dto.js';

const commonErrors = () =>
  ApiErrorResponses([
    AuthErrorStatus.TOKEN_EXPIRED,
    AuthErrorStatus.FORBIDDEN,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

const userErrors = () =>
  ApiErrorResponses([
    AuthErrorStatus.USER_NOT_FOUND,
    AuthErrorStatus.TOKEN_EXPIRED,
    AuthErrorStatus.FORBIDDEN,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

const userIdParam = () =>
  ApiParam({ name: 'userId', type: Number, example: 1, description: '사용자 ID' });

export const AdminControllerDocs = () =>
  applyDecorators(
    ApiTags('관리자'),
    ApiBearerAuth(),
    ApiExtraModels(
      AdminResDTO.Dashboard,
      AdminResDTO.AdminLog,
      AdminResDTO.PolicyDetect,
      AdminResDTO.DepartmentRisk,
      AdminResDTO.UserSummary,
      AdminResDTO.UserListItem,
      AdminResDTO.UserList,
      AdminResDTO.UserDetail,
      AdminResDTO.DisableUser,
      AdminResDTO.RestoreUser,
      AdminResDTO.LogsSummary,
      AdminResDTO.Detecting,
      AdminResDTO.LogListItem,
      AdminResDTO.LogList,
    ),
  );

export const DashboardDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '운영 현황 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.DASHBOARD,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.Dashboard)),
    ),
    ...commonErrors(),
  );

export const TrendsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'LLM 이용 및 필터 감지 추이 조회 API' }),
    ApiSuccessResponse(AdminSuccessStatus.TRENDS, SwaggerResultSchema.unknown()),
    ...commonErrors(),
  );

export const AdminLogsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '최근 관리자 활동 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.ADMIN_LOGS,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.AdminLog)),
    ),
    ...commonErrors(),
  );

export const PolicyDetectDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '정책별 감지 건수 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.POLICY_DETECT,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.PolicyDetect)),
    ),
    ...commonErrors(),
  );

export const DepartmentRisksDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '부서별 위험 분포 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.DEPARTMENT_RISKS,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.DepartmentRisk)),
    ),
    ...commonErrors(),
  );

export const UserSummaryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '사용자 계정 요약 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_SUMMARY,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UserSummary)),
    ),
    ...commonErrors(),
  );

export const UserListDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '사용자 계정 목록 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_LIST,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UserList)),
    ),
    ...commonErrors(),
  );

export const UserDetailDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '사용자 계정 상세 조회 API' }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_DETAIL,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UserDetail)),
    ),
    ...userErrors(),
  );

export const DisableUserDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '사용자 계정 비활성화 API' }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.DISABLE_USER,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.DisableUser)),
    ),
    ...userErrors(),
  );

export const RestoreUserDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '사용자 계정 복구 API' }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.RESTORE_USER,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.RestoreUser)),
    ),
    ...userErrors(),
  );

export const UpdateUserDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '사용자 정보 수정 API' }),
    userIdParam(),
    ApiBody({
      required: false,
      description: '화면 및 수정 항목 확정 후 스키마 추가 예정',
      schema: { type: 'object', additionalProperties: true },
    }),
    ApiSuccessResponse(AdminSuccessStatus.UPDATE_USER, SwaggerResultSchema.unknown()),
    ...userErrors(),
  );

export const LogsSummaryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '감사 및 이용 로그 요약 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.LOGS_SUMMARY,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.LogsSummary)),
    ),
    ...commonErrors(),
  );

export const LogListDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '이용 기록 목록 조회 API' }),
    ApiSuccessResponse(
      AdminSuccessStatus.LOG_LIST,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.LogList)),
    ),
    ...commonErrors(),
  );

export const LogDetailDocs = () =>
  applyDecorators(
    ApiOperation({ summary: '이용 기록 상세 조회 API' }),
    ApiParam({ name: 'logId', type: Number, example: 1, description: '이용 기록 ID' }),
    ApiSuccessResponse(AdminSuccessStatus.LOG_DETAIL, SwaggerResultSchema.unknown()),
    ...ApiErrorResponses([
      AdminErrorStatus.LOG_NOT_FOUND,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
