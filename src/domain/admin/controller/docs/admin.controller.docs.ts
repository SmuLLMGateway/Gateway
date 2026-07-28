import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
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
import { PromptErrorStatus } from '../../../prompt/code/prompt.status.js';

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

const departmentIdParam = () =>
  ApiParam({ name: 'departmentId', type: Number, example: 1, description: '부서 ID' });

const promptIdParam = () =>
  ApiParam({
    name: 'promptId',
    type: String,
    format: 'uuid',
    example: '8e88c068-722e-4c04-93c5-906cea400be2',
    description: '프롬프트 ID',
  });

const adminTag = () => ApiTags('관리자');

export const AdminControllerDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiExtraModels(
      AdminResDTO.DepartmentListItem,
      AdminResDTO.DepartmentList,
      AdminResDTO.RegisterApiKey,
      AdminResDTO.SyncPolicies,
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
      AdminResDTO.UserPromptOverviewItem,
      AdminResDTO.UserPromptOverview,
      AdminResDTO.UserPromptListItem,
      AdminResDTO.UserPromptList,
      AdminResDTO.PromptDetection,
      AdminResDTO.PromptDetail,
      AdminResDTO.DepartmentManagementSummary,
      AdminResDTO.DepartmentLlmModel,
      AdminResDTO.DepartmentPolicy,
      AdminResDTO.DepartmentDetail,
    ),
  );

export const CreateUserDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '회원 생성 (구현 중)',
      description: '회원 생성 요청·응답 상세 계약은 노션에서 아직 확정되지 않았습니다.',
    }),
    ApiBody({
      required: true,
      description: '노션 명세 확정 전 회원 생성 요청 본문',
      schema: { type: 'object', additionalProperties: true },
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.CREATE_USER,
      SwaggerResultSchema.unknown(),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.DUPLICATE_EMAIL,
      AdminErrorStatus.DEPARTMENT_NOT_FOUND,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const CreateDepartmentDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서 생성 (구현 중)',
      description: '부서 생성 요청·응답 상세 계약은 노션에서 아직 확정되지 않았습니다.',
    }),
    ApiBody({
      required: true,
      description: '노션 명세 확정 전 부서 생성 요청 본문',
      schema: { type: 'object', additionalProperties: true },
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.CREATE_DEPARTMENT,
      SwaggerResultSchema.unknown(),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.DUPLICATE_DEPARTMENT,
      AdminErrorStatus.INVALID_DEPARTMENT_NAME,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const DepartmentListDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서 목록 조회',
      description: '부서명을 선택적으로 검색하여 이름순으로 페이지 조회합니다. 조회 결과가 없으면 result는 null입니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.DEPARTMENT_LIST,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.DepartmentList), true),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_DEPARTMENT_LIST_QUERY,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const RegisterApiKeyDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: 'LLM API 키 검증 및 등록',
      description: '부서의 LLM API 키를 검증하고 등록합니다.',
    }),
    departmentIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.REGISTER_API_KEY,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.RegisterApiKey)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_API_KEY,
      AdminErrorStatus.DEPARTMENT_NOT_FOUND,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const SyncPoliciesDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서 정책 전체 교체',
      description: '총괄 관리자가 부서의 기존 정책 연결을 삭제하고 요청한 정책 목록으로 다시 생성합니다.',
    }),
    departmentIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.SYNC_POLICIES,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.SyncPolicies)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.DUPLICATE_POLICY,
      AdminErrorStatus.INVALID_POLICY,
      AdminErrorStatus.DEPARTMENT_NOT_FOUND,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const DashboardDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '운영 현황 조회',
      description: '운영 현황을 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.DASHBOARD,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.Dashboard)),
    ),
    ...commonErrors(),
  );

export const TrendsDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: 'LLM 이용 및 필터 감지 추이 조회 (구현 중)',
      description: 'LLM 이용 및 필터 감지 추이를 조회합니다.',
    }),
    ApiSuccessResponse(AdminSuccessStatus.TRENDS, SwaggerResultSchema.unknown()),
    ...commonErrors(),
  );

export const AdminLogsDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '최근 관리자 활동 조회',
      description: '최근 관리자 활동을 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.ADMIN_LOGS,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.AdminLog), true),
    ),
    ...commonErrors(),
  );

export const PolicyDetectDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '정책별 감지 건수 조회',
      description: '정책별 감지 건수를 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.POLICY_DETECT,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.PolicyDetect)),
    ),
    ...commonErrors(),
  );

export const DepartmentRisksDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서별 위험 분포 조회',
      description: '부서별 위험 분포를 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.DEPARTMENT_RISKS,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.DepartmentRisk)),
    ),
    ...commonErrors(),
  );

export const UserSummaryDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 계정 요약 조회 (구현 중)',
      description: '사용자 계정 요약을 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_SUMMARY,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UserSummary)),
    ),
    ...commonErrors(),
  );

export const UserListDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 계정 목록 조회',
      description: '사용자 계정 목록을 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_LIST,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UserList), true),
    ),
    ...commonErrors(),
  );

export const UserDetailDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 계정 상세 조회 (구현 중)',
      description: '사용자 계정 상세 정보를 조회합니다.',
    }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_DETAIL,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UserDetail)),
    ),
    ...userErrors(),
  );

export const DisableUserDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 계정 비활성화 (구현 중)',
      description: '사용자 계정을 비활성화합니다.',
    }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.DISABLE_USER,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.DisableUser)),
    ),
    ...userErrors(),
  );

export const RestoreUserDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 계정 복구 (구현 중)',
      description: '사용자 계정을 복구합니다.',
    }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.RESTORE_USER,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.RestoreUser)),
    ),
    ...userErrors(),
  );

export const UpdateUserDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 정보 수정 (구현 중)',
      description: '사용자 정보를 수정합니다.',
    }),
    userIdParam(),
    ApiBody({
      required: true,
      description: '화면 확정 전 사용자 수정 요청 본문',
      schema: { type: 'object', additionalProperties: true },
    }),
    ApiSuccessResponse(AdminSuccessStatus.UPDATE_USER, SwaggerResultSchema.unknown()),
    ...userErrors(),
  );

export const LogsSummaryDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '전체 채팅 기록 요약 조회 (구현 중)',
      description: '전체 채팅 기록 요약을 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.LOGS_SUMMARY,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.LogsSummary)),
    ),
    ...commonErrors(),
  );

export const UserPromptOverviewDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '전체 채팅 기록 - 사용자 목록 조회 (구현 중)',
      description: '사용자 또는 부서 검색어로 사용자별 프롬프트 목록을 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_PROMPT_OVERVIEW,
      SwaggerResultSchema.model(
        getSchemaPath(AdminResDTO.UserPromptOverview),
        true,
      ),
    ),
    ...commonErrors(),
  );

export const UserPromptListDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 프롬프트 목록 조회 (구현 중)',
      description: '사용자의 프롬프트 목록을 최신순으로 조회합니다.',
    }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.USER_PROMPT_LIST,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UserPromptList)),
    ),
    ...commonErrors(),
  );

export const PromptDetailDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '프롬프트 상세 조회 (구현 중)',
      description: '프롬프트의 원문, 전송문 및 탐지 상세를 조회합니다.',
    }),
    promptIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.PROMPT_DETAIL,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.PromptDetail)),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_PROMPT,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const DepartmentManagementSummaryDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서 관리 요약 조회',
      description: '부서 수, 사용자 수, 외부 전송 허용 부서 수 및 평균 사용률 요약을 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.DEPARTMENT_SUMMARY,
      SwaggerResultSchema.model(
        getSchemaPath(AdminResDTO.DepartmentManagementSummary),
      ),
    ),
    ...commonErrors(),
  );

export const DepartmentDetailDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서 상세 조회',
      description: '부서 관리자, 사용량, LLM 모델 및 정책 상세를 조회합니다.',
    }),
    departmentIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.DEPARTMENT_DETAIL,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.DepartmentDetail)),
    ),
    ...commonErrors(),
  );

export const DepartmentRolesDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '직책 조회(대체될 가능성 높음) (구현 중)',
      description: 'URI와 HTTP Method만 확정되었으며 응답 계약은 미확정입니다.',
    }),
    departmentIdParam(),
  );

export const LogListDocs = () =>
  applyDecorators(ApiExcludeEndpoint());

export const LogDetailDocs = () =>
  applyDecorators(ApiExcludeEndpoint());
