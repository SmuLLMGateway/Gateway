import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { AdminReqDTO } from '../../dto/admin.request.dto.js';
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

const localLlmDeploymentIdParam = () =>
  ApiParam({
    name: 'deploymentId',
    type: String,
    example: 'local-qwen3:8b',
    description: 'LPL Registry local-* LLM Deployment ID',
  });

const localNerDeploymentIdParam = () =>
  ApiParam({
    name: 'deploymentId',
    type: String,
    example: 'local-ner-gliner-multi',
    description: 'LPL Registry local-* NER Deployment ID',
  });

const promptIdParam = () =>
  ApiParam({
    name: 'promptId',
    type: Number,
    example: 101,
    description: '프롬프트 로그 ID(prompt_log_id)',
  });

const adminTag = () => ApiTags('관리자');

export const AdminControllerDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiExtraModels(
      AdminResDTO.DepartmentListItem,
      AdminResDTO.DepartmentList,
      AdminReqDTO.CreateUser,
      AdminReqDTO.CreateDepartment,
      AdminResDTO.CreateUser,
      AdminResDTO.CreateDepartment,
      AdminResDTO.RegisterApiKey,
      AdminReqDTO.RegisterLocalLlm,
      AdminReqDTO.RegisterLocalNer,
      AdminReqDTO.UpdateLocalDeploymentStatus,
      AdminResDTO.RegisterLocalLlm,
      AdminResDTO.RegisterLocalNer,
      AdminResDTO.LocalDeployment,
      AdminResDTO.LocalLlmList,
      AdminResDTO.UpdateLocalLlmStatus,
      AdminResDTO.UpdateLocalNerStatus,
      AdminResDTO.DepartmentApiKey,
      AdminReqDTO.LinkDepartmentUsers,
      AdminResDTO.LinkDepartmentUsers,
      AdminResDTO.LinkedDepartmentUser,
      AdminResDTO.SystemHealth,
      AdminResDTO.LlmHealth,
      AdminResDTO.SyncPolicies,
      AdminResDTO.PolicyPreset,
      AdminReqDTO.SyncGlobalPolicies,
      AdminResDTO.Dashboard,
      AdminReqDTO.DashboardTrends,
      AdminResDTO.DashboardTrend,
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
      summary: '회원 생성',
      description: '사용자를 생성합니다. 부서 관리자가 생성한 USER는 해당 관리자의 소속 부서에 자동 배정되며, 총괄 관리자가 생성한 사용자는 부서 미지정 상태로 생성됩니다.',
    }),
    ApiBody({
      required: true,
      type: AdminReqDTO.CreateUser,
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.CREATE_USER,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.CreateUser)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.DUPLICATE_EMAIL,
      AdminErrorStatus.NOT_MANAGED_DEPARTMENT,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const CreateDepartmentDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서 생성',
      description: '부서 기본 설정과 지정한 부서 관리자를 생성합니다. 부서별 Local LLM 연결(api_key는 NULL)은 자동 생성되며, 외부 LLM API 키와 보안 정책은 별도 API로 설정합니다.',
    }),
    ApiBody({
      required: true,
      type: AdminReqDTO.CreateDepartment,
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.CREATE_DEPARTMENT,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.CreateDepartment)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.DUPLICATE_DEPARTMENT,
      AdminErrorStatus.INVALID_DEPARTMENT_NAME,
      AdminErrorStatus.INVALID_DEPARTMENT_ADMIN,
      AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      AuthErrorStatus.USER_NOT_FOUND,
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
      description: '총 관리자는 전체 부서를, 부서 관리자는 자신의 부서만 부서명 조건으로 페이지 조회합니다. 조회 결과가 없으면 result는 null입니다.',
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

export const RegisterLocalLlmDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '로컬 LLM 등록',
      description: '총 관리자가 전역 LPL Provider에 로컬 LLM Deployment를 활성 상태로 등록합니다. Deployment ID는 local-* 형식이며, openai_compatible은 modelName을 정규화한 llm_detail_model.llm_name과 정확히 같아야 합니다. adapterType은 mock 또는 openai_compatible을 지원하며, openai_compatible에는 baseUrl·modelName·timeoutMs가 필요합니다. 등록 후 LPL의 활성 Deployment 상세 modelName을 동기화하여 모든 부서에서 로컬 모델을 사용할 수 있게 합니다. 비활성화는 상태 변경 API를 사용합니다.',
    }),
    ApiBody({ required: true, type: AdminReqDTO.RegisterLocalLlm }),
    ApiSuccessResponse(
      AdminSuccessStatus.REGISTER_LOCAL_LLM,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.RegisterLocalLlm)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
      AdminErrorStatus.DUPLICATE_LOCAL_DEPLOYMENT,
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
      AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const RegisterLocalNerDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '로컬 NER 등록',
      description: '총 관리자가 전역 LPL Provider에 local-* 형식의 NER Deployment를 활성 상태로 등록합니다. adapterType은 gliner_http, hf_inference_token_classification, http_ner, mock을 지원하며 mock 외 어댑터에는 baseUrl·timeoutMs가 필요합니다. 등록된 NER Deployment는 전 부서의 분석 흐름에서 공통으로 사용됩니다. 비활성화는 상태 변경 API를 사용합니다.',
    }),
    ApiBody({ required: true, type: AdminReqDTO.RegisterLocalNer }),
    ApiSuccessResponse(
      AdminSuccessStatus.REGISTER_LOCAL_NER,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.RegisterLocalNer)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
      AdminErrorStatus.DUPLICATE_LOCAL_DEPLOYMENT,
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
      AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const LocalLlmListDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '로컬 LLM 목록 조회',
      description: '총 관리자가 LPL Provider의 GET /deployments/llm 결과를 조회합니다. LPL 목록의 deployments 배열을 상세 설정 조회나 활성화 여부 필터링 없이 그대로 반환합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.LOCAL_LLM_LIST,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.LocalLlmList)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const UpdateLocalLlmStatusDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '로컬 LLM 활성화 상태 변경',
      description: '총 관리자가 전역 LPL Provider의 로컬 LLM Deployment를 활성화 또는 비활성화합니다. 비활성화하면 llm_detail_model 카탈로그는 보존하고 Local LLM 전용 active_llm 연결만 제거해 전 부서에서 사용할 수 없게 합니다. 다시 활성화하면 부서별 Local LLM 연결을 복구합니다.',
    }),
    localLlmDeploymentIdParam(),
    ApiBody({ required: true, type: AdminReqDTO.UpdateLocalDeploymentStatus }),
    ApiSuccessResponse(
      AdminSuccessStatus.UPDATE_LOCAL_LLM_STATUS,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UpdateLocalLlmStatus)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_STATE,
      AdminErrorStatus.LOCAL_DEPLOYMENT_NOT_FOUND,
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
      AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const UpdateLocalNerStatusDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '로컬 NER 활성화 상태 변경',
      description: '총 관리자가 전역 LPL Provider의 NER Deployment를 활성화 또는 비활성화합니다. 성공 시 LPL Provider가 반환한 변경된 Deployment 상세를 반환합니다.',
    }),
    localNerDeploymentIdParam(),
    ApiBody({ required: true, type: AdminReqDTO.UpdateLocalDeploymentStatus }),
    ApiSuccessResponse(
      AdminSuccessStatus.UPDATE_LOCAL_NER_STATUS,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.UpdateLocalNerStatus)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT,
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_STATE,
      AdminErrorStatus.LOCAL_DEPLOYMENT_NOT_FOUND,
      AdminErrorStatus.INVALID_LOCAL_DEPLOYMENT_CONFIGURATION,
      AdminErrorStatus.LOCAL_DEPLOYMENT_PROVIDER_UNAVAILABLE,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const DepartmentApiKeyDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '특정 부서 API 키 조회',
      description: '총 관리자가 지정한 부서에 등록된 LLM API 키를 복호화하여 조회합니다. 조회 사실은 관리자 활동 로그에 남기며, 부서 관리자는 호출할 수 없습니다.',
    }),
    departmentIdParam(),
    ApiQuery({
      name: 'service',
      required: true,
      enum: ['Claude', 'GPT', 'Gemini'],
      example: 'GPT',
      description: '조회할 LLM 서비스. 대소문자를 구분하지 않습니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.DEPARTMENT_API_KEY,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.DepartmentApiKey)),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_API_KEY,
      AdminErrorStatus.API_KEY_NOT_FOUND,
      AdminErrorStatus.DEPARTMENT_NOT_FOUND,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const LinkDepartmentUsersDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서-사용자 연동',
      description: '총 관리자가 부서 미소속·활성 사용자만 대상 부서에 연동합니다. 존재하지 않거나 비활성화됐거나 이미 부서에 소속된 사용자는 건너뛰며, 새로 연동된 사용자만 반환합니다. 연동 후에는 현재 부서 소속 인원 수를 기준으로 부서 한도를 1/N로 재배분합니다.',
    }),
    departmentIdParam(),
    ApiBody({ required: true, type: AdminReqDTO.LinkDepartmentUsers }),
    ApiSuccessResponse(
      AdminSuccessStatus.LINK_DEPARTMENT_USERS,
      SwaggerResultSchema.model(
        getSchemaPath(AdminResDTO.LinkDepartmentUsers),
      ),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.INVALID_USER_IDS,
      AdminErrorStatus.NO_LINKABLE_USERS,
      AdminErrorStatus.DEPARTMENT_NOT_FOUND,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

const notImplementedError = () =>
  ApiErrorResponses([
    AdminErrorStatus.NOT_IMPLEMENTED,
    AuthErrorStatus.TOKEN_EXPIRED,
    AuthErrorStatus.FORBIDDEN,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

export const PolicyCatalogDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '보안 정책 목록 조회',
      description: '저장된 모든 보안 정책 프리셋별 이름, 활성 여부와 포함된 보안 정책 한글 표시명 목록을 조회합니다. 저장된 프리셋이 없으면 result는 null입니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.POLICY_CATALOG,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.PolicyPreset), true),
    ),
    ...commonErrors(),
  );

export const SyncGlobalPoliciesDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '보안 정책 동기화',
      description: '총 관리자가 보안 정책 프리셋을 생성하거나 활성화합니다. policies를 전달하면 해당 구성으로 프리셋을 동기화하고, 생략하면 기존 프리셋을 활성화합니다. 이때 프리셋에 없는 활성 부서 정책은 비활성화하고, 프리셋에 포함된 비활성 부서 정책만 다시 활성화합니다.',
    }),
    ApiBody({ required: true, type: AdminReqDTO.SyncGlobalPolicies }),
    ApiSuccessResponse(
      AdminSuccessStatus.SYNC_GLOBAL_POLICIES,
      SwaggerResultSchema.stringArray(),
    ),
    ...ApiErrorResponses([
      AdminErrorStatus.DUPLICATE_POLICY,
      AdminErrorStatus.INVALID_POLICY,
      AdminErrorStatus.POLICY_NOT_FOUND,
      AuthErrorStatus.TOKEN_EXPIRED,
      AuthErrorStatus.FORBIDDEN,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const CreateUsersBatchDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '사용자 일괄 생성 (구현 중)',
      description: 'CSV 파일로 사용자를 일괄 생성합니다. CSV 열 구성이 미정이므로 현재 호출 시 501을 반환합니다.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'string', format: 'binary', description: '사용자 목록 CSV 파일' },
        },
      },
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.CREATE_USERS_BATCH,
      SwaggerResultSchema.objectArray(),
    ),
    ...notImplementedError(),
  );

export const SystemHealthDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '시스템 상태 요약 조회',
      description: '1시간마다 비동기로 적재되는 health_history의 서비스별 최신 상태를 통합해 조회합니다. LLM 상태 이력이 없으면 점검으로 표시합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.SYSTEM_HEALTH,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.SystemHealth)),
    ),
    ...commonErrors(),
  );

export const LlmHealthDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '모델 상태 조회',
      description: 'GPT·Gemini·Claude·Local LLM의 최신 상태, 최근 25개 상태 이력 기준 가용률, P95 지연시간과 차트용 이력을 조회합니다. currentStatus는 가장 최근 health_history 상태를 그대로 반환합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.LLM_HEALTH,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.LlmHealth)),
    ),
    ...commonErrors(),
  );

export const SyncPoliciesDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '부서 정책 전체 교체',
      description: '총괄 관리자가 활성 프리셋에 포함된 전역 활성 정책만 부서에 적용합니다. 요청 목록에 있어도 전역/프리셋에서 비활성인 정책은 무시하며, 요청에서 빠진 기존 부서 정책은 비활성화합니다.',
    }),
    departmentIdParam(),
    ApiBody({ required: true, type: AdminReqDTO.SyncPolicies }),
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
      description: '총 관리자는 전사 운영 현황을, 부서 관리자는 자신의 부서 운영 현황만 조회합니다.',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.DASHBOARD,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.Dashboard)),
    ),
    ...commonErrors(),
  );

export const DashboardTrendsDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '운영 추이 조회',
      description: 'KST 일자별 LLM 전송·보안 정책 탐지 추이를 조회합니다. 총 관리자는 departmentId로 특정 부서를 선택하거나 생략하여 전사를 조회할 수 있고, 부서 관리자는 자신의 부서만 조회할 수 있습니다.',
    }),
    ApiQuery({
      name: 'recent',
      required: true,
      enum: ['7d', '30d', '90d'],
      example: '30d',
      description: '오늘을 포함한 집계 기간',
    }),
    ApiQuery({
      name: 'departmentId',
      required: false,
      type: Number,
      example: 12,
      description: '총 관리자만 지정 가능한 대상 부서 ID',
    }),
    ApiSuccessResponse(
      AdminSuccessStatus.DASHBOARD_TRENDS,
      SwaggerResultSchema.array(getSchemaPath(AdminResDTO.DashboardTrend)),
    ),
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
      description: '총 관리자는 전사 정책별 감지 건수를, 부서 관리자는 자신의 부서 정책별 감지 건수만 조회합니다.',
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
      description: '총 관리자는 모든 부서의 사용자 수, 내·외부 LLM 요청 수와 보안 정책 감지 비율을 조회합니다. 부서 관리자는 자신의 부서 한 건만 조회합니다.',
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
      summary: '사용자 계정 요약 조회',
      description: '총·활성·비활성 사용자 수와 이번 달 신규 사용자 수를 조회합니다.',
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
      description: '사용자 계정 목록을 조회합니다. 조회 결과가 없으면 result는 null입니다.',
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
      summary: '사용자 계정 상세 조회',
      description: '사용자 기본 정보, 개인 한도·사용량 및 프롬프트 이용 통계를 조회합니다.',
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
      summary: '사용자 계정 비활성화',
      description: '사용자 계정을 물리 삭제하지 않고 disabled_at에 현재 시각을 기록해 비활성화합니다.',
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
      summary: '사용자 계정 복구',
      description: 'Soft Delete된 사용자 계정의 disabled_at을 NULL로 변경해 복구합니다.',
    }),
    userIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.RESTORE_USER,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.RestoreUser)),
    ),
    ...userErrors(),
  );

export const LogsSummaryDocs = () =>
  applyDecorators(
    adminTag(),
    ApiOperation({
      summary: '채팅 기록 요약 조회',
      description: 'MASKING 상태를 제외한 프롬프트 로그를 집계합니다. 총 관리자는 전사를, 부서 관리자는 자신의 부서만 집계합니다. 정책 감지는 프롬프트별로 한 번만 계산하며, localRate는 감지 건수 대비 로컬 LLM 전송 비율입니다.',
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
      summary: '전체 채팅 기록 - 사용자 목록 조회',
      description: '총 관리자는 모든 사용자를 조회합니다. 부서 관리자는 자신의 부서 일반 사용자(USER)만 사용자 또는 부서 검색어로 조회할 수 있습니다.',
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
      summary: '사용자 프롬프트 목록 조회',
      description: '총 관리자는 모든 사용자의 내·외부 LLM 전송 프롬프트를 조회합니다. 부서 관리자는 자신의 부서 일반 사용자(USER)만 조회할 수 있으며, 부서 관리자 프롬프트와 다른 부서 프롬프트는 조회할 수 없습니다. promptId는 숫자 prompt_log_id이고 분석 UUID는 ticket으로 별도 반환합니다. 마스킹 대기 상태 로그는 제외됩니다.',
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
      summary: '프롬프트 상세 조회',
      description: '총 관리자는 모든 프롬프트의 원문, 실제 저장된 전송문(masking_report.masking_text) 및 탐지 상세를 조회합니다. 부서 관리자는 자신의 부서 일반 사용자(USER)의 프롬프트만 조회할 수 있습니다. path의 promptId는 숫자 prompt_log_id이며 분석 UUID는 응답 ticket에 반환됩니다.',
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
      description: '총 관리자는 전사 부서 수·사용자 수·평균 사용률을, 부서 관리자는 자신의 부서 기준 요약을 조회합니다.',
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
      description: '총 관리자는 모든 부서의 상세를, 부서 관리자는 자신의 부서 상세만 조회합니다.',
    }),
    departmentIdParam(),
    ApiSuccessResponse(
      AdminSuccessStatus.DEPARTMENT_DETAIL,
      SwaggerResultSchema.model(getSchemaPath(AdminResDTO.DepartmentDetail)),
    ),
    ...commonErrors(),
  );
