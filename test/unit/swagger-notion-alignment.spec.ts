import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { AdminController } from '../../src/domain/admin/controller/admin.controller.js';
import { AdminService } from '../../src/domain/admin/service/admin.service.js';
import { AuthController } from '../../src/domain/auth/controller/auth.controller.js';
import { AuthService } from '../../src/domain/auth/service/auth.service.js';
import { PromptController } from '../../src/domain/prompt/controller/prompt.controller.js';
import { PromptReqDTO } from '../../src/domain/prompt/dto/prompt.request.dto.js';
import { PromptFileExceptionInterceptor } from '../../src/domain/prompt/interceptor/prompt-file-exception.interceptor.js';
import { PromptStagedFileCleanupInterceptor } from '../../src/domain/prompt/interceptor/prompt-staged-file-cleanup.interceptor.js';
import { ParseAnalyzeQueryPipe } from '../../src/domain/prompt/pipe/parse-analyze-query.pipe.js';
import { ParseFileDownloadBodyPipe } from '../../src/domain/prompt/pipe/parse-file-download-body.pipe.js';
import { ParseOptionalPromptFileFieldPipe } from '../../src/domain/prompt/pipe/parse-optional-prompt-file-field.pipe.js';
import { ParsePromptListQueryPipe } from '../../src/domain/prompt/pipe/parse-prompt-list-query.pipe.js';
import { ParsePrePromptJsonPipe } from '../../src/domain/prompt/pipe/parse-pre-prompt-json.pipe.js';
import { PromptService } from '../../src/domain/prompt/service/prompt.service.js';
import { UserController } from '../../src/domain/user/controller/user.controller.js';
import { UserService } from '../../src/domain/user/service/user.service.js';
import { RefreshTokenGuard } from '../../src/global/security/guard/refresh-token.guard.js';
import { ROLES_KEY } from '../../src/global/security/decorator/roles.decorator.js';
import { JwtTokenService } from '../../src/global/security/service/jwt-token.service.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

type HttpMethod = 'delete' | 'get' | 'patch' | 'post' | 'put';

interface ExpectedOperation {
  readonly method: HttpMethod;
  readonly path: string;
  readonly summary: string;
  readonly operationId: string;
  readonly tag: '관리자' | '마이페이지' | '인증' | '프롬프트';
}

const EXPECTED_OPERATIONS: readonly ExpectedOperation[] = [
  {
    method: 'post',
    path: '/auth/v1/login',
    summary: '로그인',
    operationId: 'AuthController_login',
    tag: '인증',
  },
  {
    method: 'post',
    path: '/auth/v1/token',
    summary: '토큰 갱신',
    operationId: 'AuthController_refreshToken',
    tag: '인증',
  },
  {
    method: 'post',
    path: '/auth/v1/logout',
    summary: '로그아웃',
    operationId: 'AuthController_logout',
    tag: '인증',
  },
  {
    method: 'patch',
    path: '/auth/v1/password',
    summary: '사용자 비밀번호 수정',
    operationId: 'AuthController_updateUserPassword',
    tag: '인증',
  },
  {
    method: 'post',
    path: '/api/v1/analyze',
    summary: '마스킹 요소 탐지 요청',
    operationId: 'PromptController_requestMaskingElementDetection',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/analyze',
    summary: '분석 여부 확인',
    operationId: 'PromptController_checkAnalysisStatus',
    tag: '프롬프트',
  },
  {
    method: 'delete',
    path: '/api/v1/analyze',
    summary: '분석 취소',
    operationId: 'PromptController_cancelAnalysis',
    tag: '프롬프트',
  },
  {
    method: 'post',
    path: '/api/v1/prompt',
    summary: 'LLM 전송',
    operationId: 'PromptController_sendToLlm',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/prompt',
    summary: 'LLM 결과 확인',
    operationId: 'PromptController_checkLlmResult',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/chat-rooms',
    summary: '채팅방 목록 조회',
    operationId: 'PromptController_getChatRoomList',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/models',
    summary: '모델 목록 조회',
    operationId: 'PromptController_getModelList',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/ners',
    summary: '로컬 NER 목록 조회',
    operationId: 'PromptController_getNerList',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/chat-rooms/{chatRoomId}/recent-analyze',
    summary: '직전 마스킹 요소 탐지 요청 조회',
    operationId: 'PromptController_getRecentMaskingElementDetection',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/chat-rooms/{chatRoomId}/prompts',
    summary: '프롬프트 조회',
    operationId: 'PromptController_getPromptList',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/download',
    summary: '파일 다운로드',
    operationId: 'PromptController_downloadFile',
    tag: '프롬프트',
  },
  {
    method: 'get',
    path: '/api/v1/policies',
    summary: '부서 정책 목록 조회',
    operationId: 'AdminController_getDepartmentPolicyList',
    tag: '마이페이지',
  },
  {
    method: 'get',
    path: '/api/v1/messages',
    summary: '대화 기록 조회',
    operationId: 'UserController_getMessageHistory',
    tag: '마이페이지',
  },
  {
    method: 'get',
    path: '/api/v1/users/me',
    summary: '사용자 정보 조회',
    operationId: 'UserController_getUserInfo',
    tag: '마이페이지',
  },
  {
    method: 'get',
    path: '/api/v1/message-summary',
    summary: '대화 기록 요약 조회',
    operationId: 'UserController_getMessageHistorySummary',
    tag: '마이페이지',
  },
  {
    method: 'post',
    path: '/admin/v1/departments/{departmentId}/apis',
    summary: 'LLM API 키 검증 및 등록',
    operationId: 'AdminController_validateAndRegisterLlmApiKey',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/local-llms',
    summary: '로컬 LLM 목록 조회',
    operationId: 'AdminController_getLocalLlmList',
    tag: '관리자',
  },
  {
    method: 'patch',
    path: '/admin/v1/local-llms/{deploymentId}',
    summary: '로컬 LLM 활성화 상태 변경',
    operationId: 'AdminController_updateLocalLlmStatus',
    tag: '관리자',
  },
  {
    method: 'patch',
    path: '/admin/v1/local-ners/{deploymentId}',
    summary: '로컬 NER 활성화 상태 변경',
    operationId: 'AdminController_updateLocalNerStatus',
    tag: '관리자',
  },
  {
    method: 'post',
    path: '/admin/v1/local-llms',
    summary: '로컬 LLM 등록',
    operationId: 'AdminController_registerLocalLlm',
    tag: '관리자',
  },
  {
    method: 'post',
    path: '/admin/v1/local-ners',
    summary: '로컬 NER 등록',
    operationId: 'AdminController_registerLocalNer',
    tag: '관리자',
  },
  {
    method: 'post',
    path: '/admin/v1/departments/{departmentId}/users',
    summary: '부서-사용자 연동',
    operationId: 'AdminController_linkDepartmentUsers',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/departments/me/api-key',
    summary: '부서 API 키 조회',
    operationId: 'AdminController_getDepartmentApiKey',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/policies',
    summary: '보안 정책 목록 조회',
    operationId: 'AdminController_getPolicyCatalog',
    tag: '관리자',
  },
  {
    method: 'put',
    path: '/admin/v1/policies',
    summary: '보안 정책 동기화',
    operationId: 'AdminController_syncGlobalPolicies',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/health',
    summary: '시스템 상태 요약 조회',
    operationId: 'AdminController_getSystemHealth',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/llms/health',
    summary: '모델 상태 조회',
    operationId: 'AdminController_getLlmHealth',
    tag: '관리자',
  },
  {
    method: 'put',
    path: '/admin/v1/departments/{departmentId}/policies',
    summary: '부서 정책 전체 교체',
    operationId: 'AdminController_syncDepartmentPolicies',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/users',
    summary: '사용자 계정 목록 조회',
    operationId: 'AdminController_getUserAccountList',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/users/{userId}',
    summary: '사용자 계정 상세 조회',
    operationId: 'AdminController_getUserAccountDetail',
    tag: '관리자',
  },
  {
    method: 'delete',
    path: '/admin/v1/users/{userId}',
    summary: '사용자 계정 비활성화',
    operationId: 'AdminController_deactivateUserAccount',
    tag: '관리자',
  },
  {
    method: 'post',
    path: '/admin/v1/users/{userId}',
    summary: '사용자 계정 복구',
    operationId: 'AdminController_restoreUserAccount',
    tag: '관리자',
  },
  {
    method: 'patch',
    path: '/admin/v1/users/{userId}',
    summary: '사용자 정보 수정',
    operationId: 'AdminController_updateUserInformation',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/departments',
    summary: '부서 목록 조회',
    operationId: 'AdminController_getDepartmentList',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/departments-summary',
    summary: '부서 관리 요약 조회',
    operationId: 'AdminController_getDepartmentManagementSummary',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/departments/{departmentId}',
    summary: '부서 상세 조회',
    operationId: 'AdminController_getDepartmentDetail',
    tag: '관리자',
  },
  {
    method: 'post',
    path: '/admin/v1/departments',
    summary: '부서 생성',
    operationId: 'AdminController_createDepartment',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/logs-summary',
    summary: '전체 채팅 기록 요약 조회',
    operationId: 'AdminController_getAllChatLogSummary',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/users-prompts',
    summary: '전체 채팅 기록 - 사용자 목록 조회',
    operationId: 'AdminController_getChatLogUserList',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/users/{userId}/prompts',
    summary: '사용자 프롬프트 목록 조회',
    operationId: 'AdminController_getUserPromptList',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/prompts/{promptId}',
    summary: '프롬프트 상세 조회',
    operationId: 'AdminController_getPromptDetail',
    tag: '관리자',
  },
  {
    method: 'post',
    path: '/admin/v1/users',
    summary: '회원 생성',
    operationId: 'AdminController_createUser',
    tag: '관리자',
  },
  {
    method: 'post',
    path: '/admin/v1/users/batch',
    summary: '사용자 일괄 생성',
    operationId: 'AdminController_createUsersBatch',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/department-risks',
    summary: '부서별 위험 분포 조회',
    operationId: 'AdminController_getDepartmentRiskDistribution',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/policy-detect',
    summary: '정책별 감지 건수 조회',
    operationId: 'AdminController_getPolicyDetectionCounts',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/user-summary',
    summary: '사용자 계정 요약 조회',
    operationId: 'AdminController_getUserAccountSummary',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/admin-logs',
    summary: '최근 관리자 활동 조회',
    operationId: 'AdminController_getRecentAdminActivities',
    tag: '관리자',
  },
  {
    method: 'get',
    path: '/admin/v1/dashboard',
    summary: '운영 현황 조회',
    operationId: 'AdminController_getOperationalStatus',
    tag: '관리자',
  },
] as const;

const IN_PROGRESS_OPERATION_IDS: ReadonlySet<string> = new Set([
  'PromptController_requestMaskingElementDetection',
  'AdminController_updateUserInformation',
  'AdminController_createUsersBatch',
]);

const HTTP_METHODS: readonly HttpMethod[] = [
  'delete',
  'get',
  'patch',
  'post',
  'put',
];

describe('Swagger와 Notion API 명세 정합성', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AdminController,
        AuthController,
        PromptController,
        UserController,
      ],
      providers: [
        { provide: AdminService, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: JwtTokenService, useValue: {} },
        { provide: MinioObjectStorageService, useValue: {} },
        { provide: PromptService, useValue: {} },
        { provide: UserService, useValue: {} },
        ParseAnalyzeQueryPipe,
        ParseFileDownloadBodyPipe,
        ParseOptionalPromptFileFieldPipe,
        ParsePromptListQueryPipe,
        ParsePrePromptJsonPipe,
        PromptFileExceptionInterceptor,
        PromptStagedFileCleanupInterceptor,
        RefreshTokenGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1').build(),
      { autoTagControllers: false },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(EXPECTED_OPERATIONS)(
    '$method $path는 노션 제목·구현 상태·Controller 메서드명을 사용한다',
    ({ method, path, summary, operationId, tag }) => {
      const operation = document.paths[path]?.[method];
      const expectedSummary = IN_PROGRESS_OPERATION_IDS.has(operationId)
        ? `${summary} (구현 중)`
        : summary;

      expect(operation).toBeDefined();
      expect(operation?.summary).toBe(expectedSummary);
      expect(operation?.operationId).toBe(operationId);
      expect(operation?.tags).toEqual([tag]);
    },
  );

  it('미완성 API만 구현 중으로 표시한다', () => {
    const knownOperationIds = new Set(
      EXPECTED_OPERATIONS.map(({ operationId }) => operationId),
    );

    expect(IN_PROGRESS_OPERATION_IDS.size).toBe(3);
    for (const operationId of IN_PROGRESS_OPERATION_IDS) {
      expect(knownOperationIds.has(operationId)).toBe(true);
    }
  });

  it('Notion v2의 파라미터와 DTO wire field를 동일하게 노출한다', () => {
    const departmentList =
      document.paths['/admin/v1/departments']?.get;
    const departmentQueryNames = (departmentList?.parameters ?? [])
      .map((parameter) => '$ref' in parameter ? parameter.$ref : parameter.name)
      .sort();
    expect(departmentQueryNames).toEqual(['pageNumber', 'pageSize', 'query']);
    const departmentNameQuery = (departmentList?.parameters ?? []).find(
      (parameter) => !('$ref' in parameter) && parameter.name === 'query',
    );
    expect(departmentNameQuery).toMatchObject({
      name: 'query',
      in: 'query',
      required: false,
    });

    const messageHistory = document.paths['/api/v1/messages']?.get;
    const recentQuery = (messageHistory?.parameters ?? []).find(
      (parameter) => !('$ref' in parameter) && parameter.name === 'recent',
    );
    expect(recentQuery).toMatchObject({
      name: 'recent',
      in: 'query',
      required: true,
      schema: {
        example: '7d',
        enum: ['7d', '30d', '90d', 'all'],
      },
    });

    const apiKeyRequest = document.components?.schemas
      ?.AdminRegisterApiKeyRequest as {
        properties?: Record<string, { enum?: string[] }>;
      };
    expect(apiKeyRequest.properties?.service?.enum).toEqual([
      'Claude',
      'GPT',
      'Gemini',
    ]);

    const createUserRequest = document.components?.schemas
      ?.AdminCreateUserRequest as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
    expect(Object.keys(createUserRequest.properties ?? {})).toEqual([
      'name',
      'email',
      'password',
      'authorize',
    ]);
    expect(createUserRequest.required).toEqual([
      'name',
      'email',
      'password',
      'authorize',
    ]);

    const apiKeyResponse = document.components?.schemas
      ?.AdminRegisterApiKeyResponse as {
        properties?: Record<string, { enum?: string[] }>;
      };
    expect(apiKeyResponse.properties?.service?.enum).toEqual([
      'Claude',
      'GPT',
      'Gemini',
    ]);

    const systemHealth = document.components?.schemas
      ?.AdminSystemHealthResponse as {
        properties?: Record<string, { enum?: string[] }>;
        required?: string[];
      };
    expect(Object.keys(systemHealth.properties ?? {})).toEqual([
      'totalSystemHealth',
      'outboundLLM',
      'inboundLLM',
      'securityFiltering',
      'database',
      'storage',
      'monitoring',
    ]);
    expect(systemHealth.required).toEqual([
      'totalSystemHealth',
      'outboundLLM',
      'inboundLLM',
      'securityFiltering',
      'database',
      'storage',
      'monitoring',
    ]);
    expect(systemHealth.properties?.totalSystemHealth?.enum).toEqual([
      '정상', '지연', '오류', '점검',
    ]);

    const policyRequest = document.components?.schemas
      ?.AdminSyncGlobalPoliciesRequest as {
        properties?: Record<string, {
          type?: string;
          enum?: string[];
          items?: { enum?: string[] };
        }>;
        required?: string[];
      };
    expect(Object.keys(policyRequest.properties ?? {})).toEqual([
      'presetName',
      'policies',
    ]);
    expect(policyRequest.required).toEqual(['presetName']);
    expect(policyRequest.properties?.presetName).toMatchObject({
      type: 'string',
    });
    expect(policyRequest.properties?.policies?.type).toBe('array');
    expect(
      policyRequest.properties?.policies?.items?.enum
      ?? policyRequest.properties?.policies?.enum,
    ).toEqual([
      'SECURITY_INFRA',
      'OPERATION',
      'STATE_SECRET',
      'CONTRACT',
      'PERSONAL',
      'CITIZEN',
      'AUDIT',
      'INFO_SYSTEM_ACCESS_LOG',
      'R&D',
      'RESIDENT',
      'PHONE',
      'EMAIL',
      'ACCOUNT',
      'CARD',
      'ADDRESS',
      'API_KEY',
    ]);

    const departmentItem = document.components?.schemas
      ?.DepartmentListItem as {
        properties?: Record<string, { type?: string; description?: string }>;
        required?: string[];
      };
    expect(Object.keys(departmentItem.properties ?? {})).toEqual([
      'departmentId',
      'departmentName',
      'departmentUserCnt',
      'canUseLLMModel',
      'policyType',
      'policyCnt',
      'outbound',
      'departLimitPercent',
      'departLimitUsd',
      'departUseUsd',
    ]);
    expect(departmentItem.required).toEqual([
      'departmentId',
      'departmentName',
      'departmentUserCnt',
      'canUseLLMModel',
      'policyType',
      'policyCnt',
      'outbound',
      'departLimitPercent',
      'departLimitUsd',
      'departUseUsd',
    ]);
    expect(departmentItem.properties?.policyType).toMatchObject({
      enum: ['표준', '커스텀'],
    });
    expect(departmentItem.properties?.outbound).toMatchObject({
      enum: ['허용', '불가'],
    });
    expect(departmentItem.properties?.departLimitUsd).toMatchObject({
      type: 'number',
      description: expect.stringContaining('부서 공통 한도'),
    });
    expect(departmentItem.properties?.departUseUsd).toMatchObject({
      type: 'number',
    });

    const departmentDetail = document.components?.schemas
      ?.DepartmentDetail as {
        properties?: Record<string, { type?: string; nullable?: boolean }>;
        required?: string[];
      };
    expect(Object.keys(departmentDetail.properties ?? {})).toEqual([
      'departmentName',
      'departmentAdminName',
      'departmentAdminAuthorize',
      'email',
      'userCnt',
      'usePercent',
      'useUsd',
      'limitUsd',
      'remainUsd',
      'llmModel',
      'mustFiltering',
      'policies',
    ]);
    expect(departmentDetail.properties?.departmentAdminName).toMatchObject({
      nullable: true,
    });
    expect(departmentDetail.properties?.departmentAdminAuthorize).toMatchObject({
      nullable: true,
    });
    expect(departmentDetail.properties?.email).toMatchObject({
      nullable: true,
    });
    expect(departmentDetail.properties?.policies).toMatchObject({
      nullable: true,
    });
    expect(departmentDetail.properties?.usePercent).toMatchObject({
      type: 'number',
    });
    expect(departmentDetail.properties?.useUsd).toMatchObject({
      type: 'number',
    });
    expect(departmentDetail.properties?.limitUsd).toMatchObject({
      type: 'number',
    });
    expect(departmentDetail.properties?.remainUsd).toMatchObject({
      type: 'number',
    });
    expect(departmentDetail.required).toEqual([
      'departmentName',
      'departmentAdminName',
      'departmentAdminAuthorize',
      'email',
      'userCnt',
      'usePercent',
      'useUsd',
      'limitUsd',
      'remainUsd',
      'llmModel',
      'mustFiltering',
      'policies',
    ]);
    expect(departmentDetail.properties).not.toHaveProperty('monthlyUsagePercent');
    expect(departmentDetail.properties).not.toHaveProperty('monthlyUsageUsd');
    expect(departmentDetail.properties).not.toHaveProperty('monthlyLimitUsd');
    expect(departmentDetail.properties).not.toHaveProperty('monthlyRemainingUsd');
    expect(departmentDetail.properties).not.toHaveProperty('useToken');
    expect(departmentDetail.properties).not.toHaveProperty('limitToken');
    expect(departmentDetail.properties).not.toHaveProperty('remainToken');

    const syncPoliciesResponse = document.components?.schemas
      ?.AdminSyncPoliciesResponse as {
        properties?: Record<string, { type?: string; items?: { type?: string } }>;
        required?: string[];
      };
    expect(Object.keys(syncPoliciesResponse.properties ?? {})).toEqual([
      'targetDepartment',
      'policies',
    ]);
    expect(syncPoliciesResponse.properties?.policies).toMatchObject({
      type: 'array',
      items: { type: 'string' },
    });
    expect(syncPoliciesResponse.required).toEqual([
      'targetDepartment',
      'policies',
    ]);

    const promptDetail = document.components?.schemas
      ?.PromptDetail as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
    expect(Object.keys(promptDetail.properties ?? {})).toEqual([
      'name',
      'department',
      'email',
      'limit',
      'usage',
      'usagePercent',
      'promptedAt',
      'detectCnt',
      'maskingCnt',
      'originalText',
      'sendText',
      'detect',
    ]);
    expect(promptDetail.required).toEqual([
      'name',
      'department',
      'email',
      'limit',
      'usage',
      'usagePercent',
      'promptedAt',
      'detectCnt',
      'maskingCnt',
      'originalText',
      'sendText',
      'detect',
    ]);

    const departmentListResponse = document.components?.schemas
      ?.AdminDepartmentListResponse as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
    expect(Object.keys(departmentListResponse.properties ?? {})).toEqual([
      'data',
      'totalCnt',
      'dataCnt',
      'pageNumber',
    ]);
    expect(departmentListResponse.required).toEqual([
      'data',
      'totalCnt',
      'dataCnt',
      'pageNumber',
    ]);

    const departmentManagementSummary = document.components?.schemas
      ?.DepartmentManagementSummary as {
        properties?: Record<string, { type?: string; format?: string }>;
        required?: string[];
      };
    expect(Object.keys(departmentManagementSummary.properties ?? {})).toEqual([
      'updatedAt',
      'totalDepartmentCnt',
      'totalUserCnt',
      'outboundDepartmentCnt',
      'averageUsePercent',
      'averageRate',
    ]);
    expect(departmentManagementSummary.required).toEqual([
      'updatedAt',
      'totalDepartmentCnt',
      'totalUserCnt',
      'outboundDepartmentCnt',
      'averageUsePercent',
      'averageRate',
    ]);
    expect(departmentManagementSummary.properties?.updatedAt).toMatchObject({
      type: 'string',
      format: 'date-time',
    });

    const userItem = document.components?.schemas?.UserListItem as {
      properties?: Record<string, {
        enum?: string[];
        format?: string;
        nullable?: boolean;
      }>;
      required?: string[];
    };
    expect(Object.keys(userItem.properties ?? {})).toEqual([
      'userId',
      'name',
      'email',
      'department',
      'authorize',
      'status',
    ]);
    expect(userItem.required).toEqual([
      'userId',
      'name',
      'email',
      'department',
      'authorize',
      'status',
    ]);
    expect(userItem.properties?.authorize?.enum).toEqual([
      '일반 사용자',
      '부서 관리자',
      '총 관리자',
    ]);
    expect(userItem.properties?.status?.enum).toEqual(['활성', '비활성']);
    expect(userItem.properties?.department?.nullable).toBe(true);

    const userPromptOverviewItem = document.components?.schemas
      ?.UserPromptOverviewItem as {
        properties?: Record<string, { type?: string }>;
        required?: string[];
      };
    expect(Object.keys(userPromptOverviewItem.properties ?? {})).toEqual([
      'userId',
      'name',
      'department',
      'usage',
      'limit',
    ]);
    expect(userPromptOverviewItem.required).toEqual([
      'userId',
      'name',
      'department',
      'usage',
      'limit',
    ]);

    const userPromptListItem = document.components?.schemas
      ?.UserPromptListItem as {
        properties?: Record<string, { type?: string }>;
        required?: string[];
      };
    expect(Object.keys(userPromptListItem.properties ?? {})).toEqual([
      'promptId',
      'promptSummary',
      'promptedAt',
      'model',
      'usage',
    ]);
    expect(userPromptListItem.required).toEqual([
      'promptId',
      'promptSummary',
      'promptedAt',
      'model',
      'usage',
    ]);

    const userInfo = document.components?.schemas?.UserInfoResponse as {
      properties?: Record<string, { type?: string }>;
      required?: string[];
    };
    expect(Object.keys(userInfo.properties ?? {})).toEqual([
      'email',
      'name',
      'department',
      'authorize',
      'filter',
      'personalLimitRate',
      'departmentLimitRate',
    ]);
    expect(userInfo.required).toEqual([
      'email',
      'name',
      'department',
      'authorize',
      'filter',
      'personalLimitRate',
      'departmentLimitRate',
    ]);

    const messageSummary = document.components?.schemas?.UserMessageSummaryResponse as {
      properties?: Record<string, { type?: string }>;
      required?: string[];
    };
    expect(messageSummary.properties?.filterPercent).toMatchObject({
      type: 'number',
    });
    expect(messageSummary.required).toEqual(expect.arrayContaining([
      'filterPercent',
    ]));
  });

  it('마스킹 요청 DTO는 필수 llmModel, 선택 ner 및 ticket 관계 필드를 노출한다', () => {
    const metadataKey = 'swagger/apiModelProperties';
    const llmModel = Reflect.getMetadata(
      metadataKey,
      PromptReqDTO.PrePrompt.prototype,
      'llmModel',
    ) as { required?: boolean; nullable?: boolean; type?: unknown };
    const ner = Reflect.getMetadata(
      metadataKey,
      PromptReqDTO.PrePrompt.prototype,
      'ner',
    ) as { required?: boolean; nullable?: boolean; type?: unknown };
    const legacyModel = Reflect.getMetadata(
      metadataKey,
      PromptReqDTO.PrePrompt.prototype,
      'model',
    );
    const recentTicket = Reflect.getMetadata(
      metadataKey,
      PromptReqDTO.PrePrompt.prototype,
      'recentTicket',
    ) as { required?: boolean; nullable?: boolean; type?: unknown };
    const chatRoomId = Reflect.getMetadata(
      metadataKey,
      PromptReqDTO.PrePrompt.prototype,
      'chatRoomId',
    ) as { required?: boolean; nullable?: boolean; type?: unknown };

    expect(llmModel).toMatchObject({ type: String });
    expect(llmModel.required).not.toBe(false);
    expect(ner).toMatchObject({ type: String, required: false, nullable: true });
    expect(legacyModel).toBeUndefined();
    expect(recentTicket).toMatchObject({ type: String, nullable: true });
    expect(recentTicket.required).not.toBe(false);
    expect(chatRoomId).toMatchObject({ type: String });
    expect(chatRoomId.nullable).toBeUndefined();
    expect(chatRoomId.required).not.toBe(false);

    const requestBody = document.paths['/api/v1/analyze']?.post?.requestBody as {
      content?: Record<string, {
        schema?: {
          properties?: Record<string, {
            description?: string;
            example?: string;
          }>;
        };
      }>;
    } | undefined;
    const json = requestBody?.content?.['multipart/form-data']?.schema
      ?.properties?.json;

    expect(json?.description).toContain('llmModel, text, ticket은 필수');
    expect(json?.description).toContain('ner');
    expect(json?.example).toContain('"llmModel"');
    expect(json?.example).toContain('"ner"');
    expect(json?.example).not.toContain('"model"');
  });

  it('분석 결과는 탐지 여부별 v3 응답과 단일 파일 객체를 노출한다', () => {
    const analysisOperation = document.paths['/api/v1/analyze']?.get;
    const successResponse = analysisOperation?.responses?.['200'] as {
      content?: Record<string, { schema?: unknown }>;
    } | undefined;
    const responseSchema = successResponse?.content?.['application/json']
      ?.schema as {
        properties?: Record<string, {
          oneOf?: unknown[];
          nullable?: boolean;
        }>;
      };
    const result = responseSchema.properties?.result;

    expect(result).toMatchObject({ nullable: true });
    expect(result?.oneOf).toEqual([
      { $ref: '#/components/schemas/PromptAnalyzeResponse' },
      { $ref: '#/components/schemas/PromptAnalyzeNoDetectionResponse' },
    ]);

    const noDetection = document.components?.schemas
      ?.PromptAnalyzeNoDetectionResponse as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
    expect(Object.keys(noDetection.properties ?? {})).toEqual(['recentDetectCnt']);
    expect(noDetection.required).toEqual(['recentDetectCnt']);

    const masking = document.components?.schemas?.Masking as {
      properties?: Record<string, { type?: string; nullable?: boolean }>;
    };
    expect(masking.properties?.file).toMatchObject({ nullable: true });
    expect(masking.properties?.file?.type).not.toBe('array');
  });

  it('전역 로컬 LLM·NER 관리 및 사용자 로컬 NER 목록 조회 계약을 Swagger에 노출한다', () => {
    const llmRequest = document.components?.schemas
      ?.AdminRegisterLocalLlmRequest as {
        properties?: Record<string, {
          enum?: string[];
          example?: unknown;
          maxLength?: number;
        }>;
        required?: string[];
      };
    expect(Object.keys(llmRequest.properties ?? {})).toEqual([
      'deploymentId',
      'adapterType',
      'baseUrl',
      'modelName',
      'timeoutMs',
    ]);
    expect(llmRequest.required).toEqual([
      'deploymentId',
      'adapterType',
    ]);
    expect(llmRequest.properties?.adapterType?.enum).toEqual([
      'mock',
      'openai_compatible',
    ]);
    expect(llmRequest.properties?.deploymentId).toMatchObject({
      example: 'local-qwen3:8b',
      maxLength: 50,
    });

    const nerRequest = document.components?.schemas
      ?.AdminRegisterLocalNerRequest as {
        properties?: Record<string, {
          enum?: string[];
          example?: unknown;
        }>;
        required?: string[];
      };
    expect(Object.keys(nerRequest.properties ?? {})).toEqual([
      'deploymentId',
      'adapterType',
      'baseUrl',
      'timeoutMs',
    ]);
    expect(nerRequest.required).toEqual([
      'deploymentId',
      'adapterType',
    ]);
    expect(nerRequest.properties?.adapterType?.enum).toEqual([
      'gliner_http',
      'hf_inference_token_classification',
      'http_ner',
      'mock',
    ]);
    expect(nerRequest.properties?.deploymentId).toMatchObject({
      example: 'local-ner-gliner-multi',
    });

    for (const schemaName of [
      'AdminRegisterLocalLlmResponse',
      'AdminRegisterLocalNerResponse',
    ]) {
      const response = document.components?.schemas?.[schemaName] as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      expect(Object.keys(response.properties ?? {})).toEqual([
        'deploymentId',
        'createdAt',
      ]);
      expect(response.required).toEqual(['deploymentId', 'createdAt']);
    }

    const deployment = document.components?.schemas
      ?.AdminLocalDeploymentSummary as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
    expect(Object.keys(deployment.properties ?? {})).toEqual([
      'deploymentId',
      'enabled',
    ]);
    expect(deployment.required).toEqual(['deploymentId', 'enabled']);

    for (const schemaName of [
      'AdminLocalLlmListResponse',
      'PromptNerListResponse',
    ]) {
      const response = document.components?.schemas?.[schemaName] as {
        properties?: Record<string, { type?: string }>;
        required?: string[];
      };
      expect(Object.keys(response.properties ?? {})).toEqual(['deployments']);
      expect(response.properties?.deployments?.type).toBe('array');
      expect(response.required).toEqual(['deployments']);
    }

    const updateRequest = document.components?.schemas
      ?.AdminUpdateLocalDeploymentStatusRequest as {
        properties?: Record<string, { type?: string }>;
        required?: string[];
      };
    expect(Object.keys(updateRequest.properties ?? {})).toEqual(['enabled']);
    expect(updateRequest.properties?.enabled).toMatchObject({ type: 'boolean' });
    expect(updateRequest.required).toEqual(['enabled']);

    const llmStatusResponse = document.components?.schemas
      ?.AdminUpdateLocalLlmStatusResponse as {
        properties?: Record<string, { type?: string }>;
        required?: string[];
      };
    expect(Object.keys(llmStatusResponse.properties ?? {})).toEqual([
      'deploymentId',
      'enabled',
      'adapterType',
      'baseUrl',
      'modelName',
      'timeoutMs',
    ]);
    expect(llmStatusResponse.required).toEqual([
      'deploymentId',
      'enabled',
      'adapterType',
    ]);

    const nerStatusResponse = document.components?.schemas
      ?.AdminUpdateLocalNerStatusResponse as {
        properties?: Record<string, { type?: string }>;
        required?: string[];
      };
    expect(Object.keys(nerStatusResponse.properties ?? {})).toEqual([
      'deploymentId',
      'enabled',
      'adapterType',
      'baseUrl',
      'timeoutMs',
    ]);
    expect(nerStatusResponse.required).toEqual([
      'deploymentId',
      'enabled',
      'adapterType',
    ]);

    for (const path of [
      '/admin/v1/local-llms/{deploymentId}',
      '/admin/v1/local-ners/{deploymentId}',
    ]) {
      const operation = document.paths[path]?.patch;
      const deploymentId = (operation?.parameters ?? []).find(
        (parameter) => !('$ref' in parameter) && parameter.name === 'deploymentId',
      );
      expect(deploymentId).toMatchObject({
        name: 'deploymentId',
        in: 'path',
        required: true,
      });
    }
  });

  it('로컬 LLM·NER 관리 API는 총 관리자에게만 허용하고, 로컬 NER 목록은 모든 로그인 사용자에게 허용한다', () => {
    const llmHandler = Object.getOwnPropertyDescriptor(
      AdminController.prototype,
      'registerLocalLlm',
    )?.value;
    const nerHandler = Object.getOwnPropertyDescriptor(
      AdminController.prototype,
      'registerLocalNer',
    )?.value;
    const llmListHandler = Object.getOwnPropertyDescriptor(
      AdminController.prototype,
      'getLocalLlmList',
    )?.value;
    const promptNerListHandler = Object.getOwnPropertyDescriptor(
      PromptController.prototype,
      'getNerList',
    )?.value;
    const llmStatusHandler = Object.getOwnPropertyDescriptor(
      AdminController.prototype,
      'updateLocalLlmStatus',
    )?.value;
    const nerStatusHandler = Object.getOwnPropertyDescriptor(
      AdminController.prototype,
      'updateLocalNerStatus',
    )?.value;

    expect(Reflect.getMetadata(ROLES_KEY, llmHandler)).toEqual([
      UserRole.TOTAL_ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, nerHandler)).toEqual([
      UserRole.TOTAL_ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, llmListHandler)).toEqual([
      UserRole.TOTAL_ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, promptNerListHandler)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, llmStatusHandler)).toEqual([
      UserRole.TOTAL_ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, nerStatusHandler)).toEqual([
      UserRole.TOTAL_ADMIN,
    ]);
  });

  it('노션에 없는 API를 Swagger에 노출하지 않는다', () => {
    const actualOperations = Object.entries(document.paths)
      .flatMap(([path, pathItem]) =>
        HTTP_METHODS.flatMap((method) =>
          pathItem?.[method] === undefined ? [] : [`${method} ${path}`],
        ),
      )
      .sort();
    const expectedOperations = EXPECTED_OPERATIONS
      .map(({ method, path }) => `${method} ${path}`)
      .sort();

    expect(actualOperations).toEqual(expectedOperations);
    expect(document.paths['/admin/v1/departments/{departmentId}/roles']).toBeUndefined();
    expect(document.paths['/admin/v1/logs']).toBeUndefined();
    expect(document.paths['/admin/v1/logs/{logId}']).toBeUndefined();
    expect(document.paths['/admin/v1/trends']).toBeUndefined();
  });
});
