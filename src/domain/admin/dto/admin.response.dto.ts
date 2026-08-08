import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";

export namespace AdminResDTO {
    @ApiSchema({ name: 'AdminCreateUserResponse' })
    export class CreateUser {
        @ApiProperty({ example: 42, description: '생성된 member.member_id' })
        id!: number;

        @ApiProperty({ example: '김서윤' })
        name!: string;
    }

    @ApiSchema({ name: 'AdminCreateDepartmentResponse' })
    export class CreateDepartment {
        @ApiProperty({ example: 4, description: '생성된 부서 ID' })
        departmentId!: number;

        @ApiProperty({ example: '정책기획팀', description: '생성된 부서명' })
        departmentName!: string;

        @ApiProperty({ example: '2026-07-20T15:18:39Z', format: 'date-time' })
        createdAt!: string;
    }

    export class DepartmentListItem {
        @ApiProperty({ example: 21 })
        departmentId!: number;

        @ApiProperty({ example: '감사담당팀' })
        departmentName!: string;

        @ApiProperty({ example: 119 })
        departmentUserCnt!: number;

        @ApiProperty({
            type: [String],
            example: ['Local LLM', 'Gemini', 'GPT'],
            description: 'active_llm 연결이 있고 부서의 activeLocalLLM이 true인 Local LLM 및 등록된 외부 LLM 서비스 목록'
        })
        canUseLLMModel!: string[];

        @ApiProperty({
            example: '표준',
            enum: ['표준', '커스텀'],
            description: '전체 보안 정책이 활성화되면 표준, 그 외에는 커스텀'
        })
        policyType!: '표준' | '커스텀';

        @ApiProperty({ example: 9 })
        policyCnt!: number;

        @ApiProperty({
            example: '조건부',
            enum: ['허용', '조건부'],
            description: '외부 LLM 전송 정책. mustFiltering=false는 항상 허용, true는 탐지 요소가 없을 때만 허용'
        })
        outbound!: '허용' | '조건부';

        @ApiProperty({
            example: 59,
            description: '부서 월 한도 사용률(%). 무제한 또는 한도 정보가 없으면 100'
        })
        departLimitPercent!: number;

        @ApiProperty({
            type: Number,
            example: 200000,
            description: '부서 공통 한도(USD). 무제한이면 0 반환'
        })
        departLimitUsd!: number;

        @ApiProperty({
            type: Number,
            example: 118000,
            description: '부서 공통 사용량(USD)'
        })
        departUseUsd!: number;

        @ApiProperty({
            example: true,
            description: '부서의 LPL(Local NER·LLM) 호출 허용 여부'
        })
        activeLocalLLM!: boolean;
    }

    @ApiSchema({ name: 'AdminDepartmentListResponse' })
    export class DepartmentList {
        @ApiProperty({ type: () => [DepartmentListItem] })
        data!: DepartmentListItem[];

        @ApiProperty({ example: 20 })
        totalCnt!: number;

        @ApiProperty({ example: 7 })
        dataCnt!: number;

        @ApiProperty({ example: 1 })
        pageNumber!: number;
    }

    @ApiSchema({ name: 'AdminRegisterApiKeyResponse' })
    export class RegisterApiKey {
        @ApiProperty({ example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({
            example: 'GPT',
            enum: ['Claude', 'GPT', 'Gemini'],
            description: '등록된 LLM 서비스: Claude, GPT, Gemini'
        })
        service!: string;

        @ApiProperty({ example: '2026-07-20T15:45:39Z', format: 'date-time' })
        createdAt!: string;
    }

    @ApiSchema({ name: 'AdminRegisterLocalLlmResponse' })
    export class RegisterLocalLlm {
        @ApiProperty({ example: 'local-qwen3:8b', description: 'LPL Provider에 등록된 Deployment ID. llm_detail_model.llm_name과 동일한 local-* 값입니다.' })
        deploymentId!: string;

        @ApiProperty({ example: '2026-08-03T10:30:00+09:00', format: 'date-time', description: 'Gateway가 등록을 완료한 시각(KST)' })
        createdAt!: string;
    }

    @ApiSchema({ name: 'AdminRegisterLocalNerResponse' })
    export class RegisterLocalNer {
        @ApiProperty({ example: 'local-ner-gliner-multi', description: 'LPL Provider에 등록된 local-* Deployment ID' })
        deploymentId!: string;

        @ApiProperty({ example: '2026-08-03T10:30:00+09:00', format: 'date-time', description: 'Gateway가 등록을 완료한 시각(KST)' })
        createdAt!: string;
    }

    @ApiSchema({ name: 'AdminLocalDeploymentSummary' })
    export class LocalDeployment {
        @ApiProperty({ example: 'local-qwen3:8b', description: 'LPL Provider Deployment ID' })
        deploymentId!: string;

        @ApiProperty({ example: true, description: 'LPL Registry 활성화 여부. 비활성 Deployment도 목록에 포함됩니다.' })
        enabled!: boolean;
    }

    @ApiSchema({ name: 'AdminLocalLlmListResponse' })
    export class LocalLlmList {
        @ApiProperty({
            type: () => [LocalDeployment],
            description: 'LPL Provider GET /deployments/llm 응답의 deployments 배열',
        })
        deployments!: LocalDeployment[];
    }

    @ApiSchema({ name: 'AdminUpdateLocalLlmStatusResponse' })
    export class UpdateLocalLlmStatus {
        @ApiProperty({ example: 'local-qwen3:8b', description: 'LPL Provider Deployment ID' })
        deploymentId!: string;

        @ApiProperty({ example: false, description: 'LPL에서 변경된 활성화 상태' })
        enabled!: boolean;

        @ApiProperty({ example: 'openai_compatible', description: 'LPL Deployment 어댑터 타입' })
        adapterType!: string;

        @ApiPropertyOptional({ example: 'http://ollama:11434/v1', format: 'uri' })
        baseUrl?: string;

        @ApiPropertyOptional({ example: 'qwen3:8b', description: '로컬 LLM 모델명' })
        modelName?: string;

        @ApiPropertyOptional({ example: 300000, type: Number, minimum: 1 })
        timeoutMs?: number;
    }

    @ApiSchema({ name: 'AdminUpdateLocalNerStatusResponse' })
    export class UpdateLocalNerStatus {
        @ApiProperty({ example: 'local-ner-gliner-multi', description: 'LPL Provider Deployment ID' })
        deploymentId!: string;

        @ApiProperty({ example: false, description: 'LPL에서 변경된 활성화 상태' })
        enabled!: boolean;

        @ApiProperty({ example: 'gliner_http', description: 'LPL Deployment 어댑터 타입' })
        adapterType!: string;

        @ApiPropertyOptional({ example: 'http://ner-server:8008/ner', format: 'uri' })
        baseUrl?: string;

        @ApiPropertyOptional({ example: 30000, type: Number, minimum: 1 })
        timeoutMs?: number;
    }

    @ApiSchema({ name: 'AdminDepartmentApiKeyResponse' })
    export class DepartmentApiKey {
        @ApiProperty({ example: 12, description: '조회 대상 부서 ID' })
        departmentId!: number;

        @ApiProperty({ example: '정책기획팀', description: '조회 대상 부서명' })
        departmentName!: string;

        @ApiProperty({
            example: 'GPT',
            enum: ['Claude', 'GPT', 'Gemini'],
            description: '조회된 LLM 서비스'
        })
        service!: string;

        @ApiProperty({
            example: 'sk-...',
            description: '해당 부서가 등록한 복호화된 API 키'
        })
        apiKey!: string;
    }

    export class LinkedDepartmentUser {
        @ApiProperty({ example: 23, description: '새로 연동된 사용자 ID' })
        userId!: number;

        @ApiProperty({ example: '박안녕', description: '새로 연동된 사용자 이름' })
        userName!: string;
    }

    @ApiSchema({ name: 'AdminLinkDepartmentUsersResponse' })
    export class LinkDepartmentUsers {
        @ApiProperty({ example: 4, description: '대상 부서 ID' })
        departmentId!: number;

        @ApiProperty({ example: '정책기획팀', description: '대상 부서명' })
        departmentName!: string;

        @ApiProperty({ type: () => [LinkedDepartmentUser] })
        users!: LinkedDepartmentUser[];
    }

    @ApiSchema({ name: 'AdminSystemHealthResponse' })
    export class SystemHealth {
        @ApiProperty({ example: '정상', enum: ['정상', '지연', '오류', '점검'], description: '전체 시스템 상태' })
        totalSystemHealth!: '정상' | '지연' | '오류' | '점검';

        @ApiProperty({ example: '정상', enum: ['정상', '지연', '오류', '점검'], description: '외부 LLM 상태' })
        outboundLLM!: '정상' | '지연' | '오류' | '점검';

        @ApiProperty({ example: '정상', enum: ['정상', '지연', '오류', '점검'], description: '내부 LLM 상태' })
        inboundLLM!: '정상' | '지연' | '오류' | '점검';

        @ApiProperty({ example: '정상', enum: ['정상', '지연', '오류', '점검'], description: '보안 필터링 상태' })
        securityFiltering!: '정상' | '지연' | '오류' | '점검';

        @ApiProperty({ example: '정상', enum: ['정상', '지연', '오류', '점검'], description: '데이터베이스 상태' })
        database!: '정상' | '지연' | '오류' | '점검';

        @ApiProperty({ example: '정상', enum: ['정상', '지연', '오류', '점검'], description: '저장소 상태' })
        storage!: '정상' | '지연' | '오류' | '점검';

        @ApiProperty({ example: '정상', enum: ['정상', '지연', '오류', '점검'], description: '모니터링 상태' })
        monitoring!: '정상' | '지연' | '오류' | '점검';
    }

    @ApiSchema({ name: 'AdminLlmHealthResponse' })
    export class LlmHealth {
        @ApiProperty({ example: 'GPT', description: 'LLM 서비스명' })
        service!: string;

        @ApiProperty({
            example: 'OK',
            enum: ['OK', 'DELAY', 'ERROR', 'CHECK'],
            description: '가장 최근 health_history에 기록된 모델 상태'
        })
        currentStatus!: 'OK' | 'DELAY' | 'ERROR' | 'CHECK';

        @ApiProperty({ example: 96, minimum: 0, maximum: 100, description: '최근 25개 상태 이력 중 정상(OK) 비율(%)' })
        availability!: number;

        @ApiProperty({ example: 842, minimum: 0, description: '최근 25개 상태 이력의 P95 지연시간(ms)' })
        averageResponse!: number;

        @ApiProperty({
            type: [Number],
            example: [0, 0, 1, 0, 2],
            minItems: 25,
            maxItems: 25,
            description: '오래된 순서의 최근 25개 상태 이력(0: 정상, 1: 지연, 2: 오류, 3: 점검)'
        })
        history!: number[];
    }

    export class Policy {
        @ApiProperty({ example: 7 })
        policyId!: number;

        @ApiProperty({ example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({ example: '전화번호', description: '정책 한글 표시명' })
        maskingContent!: string;

        @ApiProperty({ example: '개인 정보', description: '정책 등급 한글 표시명' })
        maskingClass!: string;

        @ApiProperty({ example: '2026-07-22T16:30:00Z', format: 'date-time' })
        changedAt!: string;
    }

    export class PolicyListItem {
        @ApiProperty({ example: 7 })
        policyId!: number;

        @ApiProperty({ example: '전화번호', description: '정책 한글 표시명' })
        maskingContent!: string;

        @ApiProperty({ example: '개인 정보', description: '정책 등급 한글 표시명' })
        maskingClass!: string;
    }

    export class PolicyList {
        @ApiProperty({ example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({ type: () => [PolicyListItem] })
        policies!: PolicyListItem[];

        @ApiProperty({ example: 3 })
        totalCnt!: number;
    }

    @ApiSchema({ name: 'AdminPolicyPresetResponse' })
    export class PolicyPreset {
        @ApiProperty({ example: '기본 보안 정책', description: '보안 정책 프리셋 이름' })
        presetName!: string;

        @ApiProperty({
            example: true,
            description: '현재 전역으로 활성화된 보안 정책 프리셋 여부'
        })
        isActive!: boolean;

        @ApiProperty({
            type: [String],
            example: ['보안 인프라 정보', '행정 운영 정보'],
            description: '프리셋에 포함된 보안 정책 한글 표시명 목록',
        })
        policies!: string[];
    }

    @ApiSchema({ name: 'AdminSyncPoliciesResponse' })
    export class SyncPolicies {
        @ApiProperty({ example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({
            type: [String],
            example: ['전화번호', 'API 키'],
            description: '최종 적용된 부서 정책 한글 표시명 목록'
        })
        policies!: string[];
    }

    export class Dashboard {
        @ApiProperty({ example: '2026-07-19T20:55:00Z', format: 'date-time' })
        updatedAt!: string;

        @ApiProperty({ example: 128 })
        userCnt!: number;

        @ApiProperty({ example: 6, description: '최근 30일 내 생성된 사용자 수' })
        userRate!: number;

        @ApiProperty({ example: 3842 })
        chatCnt!: number;

        @ApiProperty({ example: 200, description: '최근 30일 내 외부·내부 전송된 프롬프트 수' })
        chatRate!: number;

        @ApiProperty({ example: 715 })
        filterDetect!: number;

        @ApiProperty({ example: 200, description: '최근 30일 내 필터가 감지된 전송 프롬프트 수' })
        filterDetectRate!: number;

        @ApiProperty({ example: 241, description: '마스킹 후 GPT로 전송한 횟수. ERROR 상태는 제외' })
        maskingToGpt!: number;

        @ApiProperty({ example: 201 })
        maskingToClaude!: number;

        @ApiProperty({ example: 94 })
        maskingToGemini!: number;

        @ApiProperty({ example: 1540 })
        totalGpt!: number;

        @ApiProperty({ example: 980 })
        totalClaude!: number;

        @ApiProperty({ example: 1218 })
        totalGemini!: number;

        @ApiProperty({ example: 104 })
        local!: number;

        @ApiProperty({ example: 14.5, description: '최근 30일과 직전 30일의 로컬 LLM 전송 비율 차이(%p)' })
        localRate!: number;
    }

    export class DashboardTrend {
        @ApiProperty({ example: '2026-08-08', format: 'date', description: 'KST 기준 집계 일자' })
        date!: string;

        @ApiProperty({ example: 21, description: '해당 일에 LLM 전송을 예약하거나 완료한 프롬프트 수' })
        llmRequestCnt!: number;

        @ApiProperty({ example: 8, description: '마스킹 요소가 하나 이상 탐지된 프롬프트 수' })
        filterDetectCnt!: number;

        @ApiProperty({ example: 6, description: '로컬 LLM으로 전송한 프롬프트 수' })
        localLlmCnt!: number;

        @ApiProperty({ example: 5, description: '탐지 요소가 있으면서 외부 LLM으로 전송한 프롬프트 수' })
        maskedExternalLlmCnt!: number;
    }

    export class AdminLog {
        @ApiProperty({ example: '박지민 사용자 계정이 생성되었습니다.' })
        title!: string;

        @ApiProperty({ example: '2026-07-19T21:14:45Z', format: 'date-time' })
        activityAt!: string;

        @ApiProperty({ example: '시스템 관리자' })
        adminName!: string;
    }

    export class PolicyDetect {
        @ApiProperty({ example: '민감정보' })
        category!: string;

        @ApiProperty({ example: '조달 및 계약 정보' })
        detailCategory!: string;

        @ApiProperty({ example: 168 })
        count!: number;
    }

    export class DepartmentRisk {
        @ApiProperty({ example: '감사팀', description: '부서명' })
        departmentName!: string;

        @ApiProperty({ example: 263, description: '선택 기간 내 내·외부 LLM 요청 수' })
        llmRequestCnt!: number;

        @ApiProperty({ example: 6 })
        userCnt!: number;

        @ApiProperty({ example: 43.3, description: '선택 기간 내 LLM 요청 중 보안 정책 감지 비율(%)' })
        detectRate!: number;
    }

    export class UserSummary {
        @ApiProperty({ example: '2026-07-19T21:31:50Z', format: 'date-time', description: '조회 시점의 현재 시각' })
        updatedAt!: string;

        @ApiProperty({ example: 132, description: '총 사용자 수' })
        totalUserCnt!: number;

        @ApiProperty({ example: 128, description: '활성 상태(disabled_at이 null) 사용자 수' })
        activateUserCnt!: number;

        @ApiProperty({ example: 4, description: '비활성 상태(disabled_at이 null이 아님) 사용자 수' })
        disabledUserCnt!: number;

        @ApiProperty({ example: 6, description: '이번 달 1일 00:00 UTC 이후 생성된 사용자 수' })
        newUserCnt!: number;
    }

    export class UserListItem {
        @ApiProperty({ example: 1, description: 'member.member_id' })
        userId!: number;

        @ApiProperty({ example: '김서윤', description: 'member.member_name' })
        name!: string;

        @ApiProperty({ example: 'seoyun.kim@organization.go.kr', description: 'member.email' })
        email!: string;

        @ApiProperty({ example: '정책기획팀', nullable: true, description: 'department.department_name. 소속 부서가 없으면 null' })
        department!: string | null;

        @ApiProperty({
            example: '일반 사용자',
            enum: ['일반 사용자', '부서 관리자', '총 관리자'],
            description: 'member.authorize를 한글 권한명으로 변환'
        })
        authorize!: string;

        @ApiProperty({
            example: '활성',
            enum: ['활성', '비활성'],
            description: 'member.disabled_at이 NULL이면 활성, 아니면 비활성'
        })
        status!: string;
    }

    @ApiSchema({ name: 'AdminUserListResponse' })
    export class UserList {
        @ApiProperty({ type: () => [UserListItem] })
        data!: UserListItem[];

        @ApiProperty({ example: 1204 })
        totalCnt!: number;

        @ApiProperty({ example: 7 })
        dataCnt!: number;

        @ApiProperty({ example: 132, nullable: true })
        filteringCnt!: number | null;

        @ApiProperty({ example: 1 })
        pageNumber!: number;
    }

    export class UserDetail {
        @ApiProperty({ example: '김서윤', description: '사용자명' })
        name!: string;

        @ApiProperty({ example: 'seoyun.kim@organization.go.kr', description: '사용자 이메일' })
        email!: string;

        @ApiProperty({ example: '정책기획팀', nullable: true, description: '사용자 부서명. 소속 부서가 없으면 null' })
        department!: string | null;

        @ApiProperty({ example: '일반 사용자', enum: ['일반 사용자', '부서 관리자', '총 관리자'], description: '사용자 권한의 한글 표시명' })
        role!: string;

        @ApiProperty({ example: '2026-07-19T12:34:56Z', format: 'date-time', description: '생성 시각' })
        createdAt!: string;

        @ApiProperty({ example: '신정보', description: '생성자' })
        createdBy!: string;

        @ApiProperty({ example: 120000, description: '사용자 개인 한도량. 0은 무제한' })
        limit!: number;

        @ApiProperty({ example: 42000, description: '사용자 개인 사용량' })
        usage!: number;

        @ApiProperty({ example: 42, description: '사전 마스킹 요소 탐지를 제외한 프롬프트 입력 횟수' })
        chatCnt!: number;

        @ApiProperty({ example: 17, description: '보안 정책이 감지된 프롬프트 수. 복수 정책 감지는 한 건으로 집계' })
        filterDetectCnt!: number;

        @ApiProperty({ example: 31, description: '외부 LLM 전송 전 프롬프트를 마스킹한 횟수' })
        masking!: number;

        @ApiProperty({ example: 6, description: '로컬 LLM 전송 횟수' })
        local!: number;
    }

    export class DisableUser {
        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: '2026-07-19T22:18:05Z', format: 'date-time' })
        disabledAt!: string;
    }

    export class RestoreUser {
        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: '2026-07-19T22:18:05Z', format: 'date-time' })
        restoredAt!: string;
    }

    export class LogsSummary {
        @ApiProperty({ example: '2026-07-19T22:34:17Z', format: 'date-time' })
        updatedAt!: string;

        @ApiProperty({ example: 3842 })
        totalChatCnt!: number;

        @ApiProperty({ example: 715 })
        filterDetectCnt!: number;

        @ApiProperty({ example: 611 })
        masking!: number;

        @ApiProperty({ example: 104 })
        local!: number;

        @ApiProperty({ example: 14.5, description: '보안 정책 감지 프롬프트 대비 로컬 LLM 전송 비율(%)' })
        localRate!: number;
    }

    export class UserPromptOverviewItem {
        @ApiProperty({ example: 32 })
        userId!: number;

        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: '정책기획팀' })
        department!: string;

        @ApiProperty({ example: 12.4, description: '사용자 현재 사용량' })
        usage!: number;

        @ApiProperty({ example: 200, description: '사용자 할당 한도. 0은 무제한' })
        limit!: number;
    }

    @ApiSchema({ name: 'AdminUserPromptOverviewResponse' })
    export class UserPromptOverview {
        @ApiProperty({ type: () => [UserPromptOverviewItem] })
        data!: UserPromptOverviewItem[];

        @ApiProperty({ example: 14 })
        totalCnt!: number;

        @ApiProperty({ example: 7 })
        dataCnt!: number;

        @ApiProperty({ example: 1 })
        pageNumber!: number;
    }

    export class UserPromptListItem {
        @ApiProperty({
            type: Number,
            example: 101,
            description: '프롬프트 로그 ID(prompt_log_id)'
        })
        promptId!: number;

        @ApiProperty({
            example: '8e46e2d4-b1d0-4e20-8d3b-3c7d71821d65',
            format: 'uuid',
            description: '마스킹 분석 요청 식별자(masking_report_id). 상세 조회 path에는 사용하지 않습니다.'
        })
        ticket!: string;

        @ApiProperty({ example: '계약 검토 내용 요약' })
        promptSummary!: string;

        @ApiProperty({
            example: '2026-08-01T13:00:59Z',
            format: 'date-time'
        })
        promptedAt!: string;

        @ApiProperty({ example: 'GPT', description: '외부 LLM은 active_api_key.service_type, 로컬 LLM은 Local LLM' })
        model!: string;

        @ApiProperty({ example: 4800, description: '해당 프롬프트로 소모된 외부 LLM 사용량. 내부 LLM은 0' })
        usage!: number;
    }

    @ApiSchema({ name: 'AdminUserPromptListResponse' })
    export class UserPromptList {
        @ApiProperty({ type: () => [UserPromptListItem] })
        data!: UserPromptListItem[];

        @ApiProperty({ example: 8 })
        totalCnt!: number;

        @ApiProperty({ example: 7 })
        dataCnt!: number;

        @ApiProperty({ example: 1 })
        pageNumber!: number;
    }

    export class PromptDetection {
        @ApiProperty({ example: 'A사와 체결 예정인 미공개 계약' })
        targetText!: string;

        @ApiProperty({ example: 5 })
        startIdx!: number;

        @ApiProperty({ example: 22 })
        endIdx!: number;

        @ApiProperty({ example: '민감정보' })
        maskingCategory!: string;

        @ApiProperty({ example: '조달 및 계약 정보' })
        detailCategory!: string;

        @ApiProperty({ example: '거래처 A' })
        maskingText!: string;

        @ApiProperty({ example: 5 })
        maskingStartIdx!: number;

        @ApiProperty({ example: 10 })
        maskingEndIdx!: number;
    }

    export class PromptDetail {
        @ApiProperty({ type: Number, example: 101, description: '프롬프트 로그 ID(prompt_log_id)' })
        promptId!: number;

        @ApiProperty({ example: '8e46e2d4-b1d0-4e20-8d3b-3c7d71821d65', format: 'uuid', description: '마스킹 분석 요청 식별자(masking_report_id)' })
        ticket!: string;

        @ApiProperty({ example: '김서윤', description: '프롬프트 요청자 이름' })
        name!: string;

        @ApiProperty({ example: '정책기획팀', description: '프롬프트 요청자의 소속 부서명' })
        department!: string;

        @ApiProperty({ example: 'seoyun.kim@organization.go.kr' })
        email!: string;

        @ApiProperty({ example: 200000, description: '사용자 한도' })
        limit!: number;

        @ApiProperty({ example: 12400, description: '사용자 사용량' })
        usage!: number;

        @ApiProperty({ example: 6.2, description: '사용자 한도 사용률(%)' })
        usagePercent!: number;

        @ApiProperty({
            example: '2026-07-25T15:09:05Z',
            format: 'date-time'
        })
        promptedAt!: string;

        @ApiProperty({ example: 4 })
        detectCnt!: number;

        @ApiProperty({ example: 4 })
        maskingCnt!: number;

        @ApiProperty({ example: '다음 주 A사와 체결 예정인...' })
        originalText!: string;

        @ApiProperty({ example: '다음 주 거래처 A와 체결 예정인...' })
        sendText!: string;

        @ApiProperty({ type: () => [PromptDetection] })
        detect!: PromptDetection[];
    }

    export class DepartmentManagementSummary {
        @ApiProperty({
            example: '2026-07-25T15:16:31Z',
            description: '조회 시점의 현재 시각',
            format: 'date-time'
        })
        updatedAt!: string;

        @ApiProperty({ example: 9, description: '총 부서 수' })
        totalDepartmentCnt!: number;

        @ApiProperty({ example: 102, description: '총 사용자 수' })
        totalUserCnt!: number;

        @ApiProperty({
            example: 4,
            description: '외부 전송 허용 부서 수(must_filtering=false)'
        })
        outboundDepartmentCnt!: number;

        @ApiProperty({
            example: 42.5,
            description: '부서 공통 한도·사용량으로 계산한 월 사용률의 평균(%)'
        })
        averageUsePercent!: number;

        @ApiProperty({
            example: 14.4,
            description: '현재 평균 사용률에서 직전 평균 사용률을 뺀 증감값(%p)'
        })
        averageRate!: number;
    }

    export class DepartmentLlmModel {
        @ApiProperty({ example: 'Local LLM' })
        modelName!: string;

        @ApiProperty({ example: true })
        hasApiKey!: boolean;
    }

    export class DepartmentPolicy {
        @ApiProperty({ example: 1 })
        policyId!: number;

        @ApiProperty({ example: '보안 인프라 정보' })
        maskingContent!: string;

        @ApiProperty({ example: '민감 정보' })
        maskingClass!: string;

        @ApiProperty({ example: true })
        isActive!: boolean;
    }

    export class DepartmentDetail {
        @ApiProperty({ example: '감사담당팀' })
        departmentName!: string;

        @ApiProperty({ example: '장우진', nullable: true, description: '해당 부서 DEPART_ADMIN 이름' })
        departmentAdminName!: string | null;

        @ApiProperty({ example: '부서 관리자', nullable: true, description: 'DEPART_ADMIN의 권한명' })
        departmentAdminAuthorize!: string | null;

        @ApiProperty({ example: 'woojinjang@organization.go.kr', nullable: true, description: '부서 관리자 이메일' })
        email!: string | null;

        @ApiProperty({ example: 9 })
        userCnt!: number;

        @ApiProperty({ example: 16, description: '부서 공통 한도 사용률(%). 한도 0은 100으로 계산' })
        usePercent!: number;

        @ApiProperty({
            type: Number,
            example: 12400,
            description: '부서 공통 사용량(USD)'
        })
        useUsd!: number;

        @ApiProperty({
            type: Number,
            example: 80000,
            description: '부서 공통 한도(USD). 한도 0은 무제한'
        })
        limitUsd!: number;

        @ApiProperty({
            type: Number,
            example: 67600,
            description: '부서 공통 잔여 한도(USD). 무제한이면 0'
        })
        remainUsd!: number;

        @ApiProperty({ type: () => [DepartmentLlmModel] })
        llmModel!: DepartmentLlmModel[];

        @ApiProperty({ example: false })
        mustFiltering!: boolean;

        @ApiProperty({
            example: true,
            description: '부서의 LPL(Local NER·LLM) 호출 허용 여부'
        })
        activeLocalLLM!: boolean;

        @ApiProperty({
            type: () => [DepartmentPolicy],
            nullable: true,
            description: '부서 정책. 등록된 정책이 없으면 null'
        })
        policies!: DepartmentPolicy[] | null;
    }

    export type AdminLogs = AdminLog[] | null;
    export type PolicyDetectList = PolicyDetect[];
    export type DepartmentRiskList = DepartmentRisk[];
}
