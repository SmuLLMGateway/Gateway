import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace AdminResDTO {
    @ApiSchema({ name: 'AdminCreateUserResponse' })
    export class CreateUser {
        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: '일반 사용자' })
        role!: string;

        @ApiProperty({ example: '2026-07-20T15:11:39Z', format: 'date-time' })
        createdAt!: string;
    }

    @ApiSchema({ name: 'AdminCreateDepartmentResponse' })
    export class CreateDepartment {
        @ApiProperty({ example: '정책기획팀' })
        name!: string;

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
            example: ['Gemini', 'GPT'],
            nullable: true,
            description: '등록된 active_api_key.service_type 목록. 등록된 키가 없으면 null'
        })
        canUseLLMModel!: string[] | null;

        @ApiProperty({
            example: '표준',
            enum: ['표준', '커스텀'],
            description: '전체 보안 정책이 활성화되면 표준, 그 외에는 커스텀'
        })
        policyType!: '표준' | '커스텀';

        @ApiProperty({ example: 9 })
        policyCnt!: number;

        @ApiProperty({
            example: '허용',
            enum: ['허용', '불가'],
            description: '마스킹 후 외부 전송 허용 여부 (mustFiltering=true면 허용)'
        })
        outbound!: '허용' | '불가';

        @ApiProperty({
            example: 59,
            description: '부서 월 한도 사용률(%). 무제한 또는 한도 정보가 없으면 100'
        })
        departLimitPercent!: number;

        @ApiProperty({
            type: Number,
            example: 200000,
            description: '부서 활성 서비스 한도 합계(USD). 하나라도 0이면 무제한으로 0 반환'
        })
        departLimitUsd!: number;

        @ApiProperty({
            type: Number,
            example: 118000,
            description: '부서 활성 서비스 사용량 합계(USD)'
        })
        departUseUsd!: number;
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

    export class Policy {
        @ApiProperty({ example: 7 })
        policyId!: number;

        @ApiProperty({ example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({ example: 'PHONE' })
        maskingContent!: string;

        @ApiProperty({ example: 'PRIVATE' })
        maskingClass!: string;

        @ApiProperty({ example: '2026-07-22T16:30:00Z', format: 'date-time' })
        changedAt!: string;
    }

    export class PolicyListItem {
        @ApiProperty({ example: 7 })
        policyId!: number;

        @ApiProperty({ example: 'PHONE' })
        maskingContent!: string;

        @ApiProperty({ example: 'PRIVATE' })
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

    @ApiSchema({ name: 'AdminSyncPoliciesResponse' })
    export class SyncPolicies {
        @ApiProperty({ example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({
            type: [String],
            example: ['PHONE', 'API_KEY'],
            description: '최종 적용된 부서 정책 코드 목록'
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

        @ApiProperty({ example: 241 })
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
        @ApiProperty({ example: '감사 담당관' })
        departmentName!: string;

        @ApiProperty({ example: 263, description: '선택 기간 내 내·외부 LLM 요청 수' })
        llmRequestCnt!: number;

        @ApiProperty({ example: 6 })
        userCnt!: number;

        @ApiProperty({ example: 43.3, description: '선택 기간 내 LLM 요청 중 보안 정책 감지 비율(%)' })
        detectRate!: number;
    }

    export class UserSummary {
        @ApiProperty({ example: '2026-07-19T21:31:50Z', format: 'date-time' })
        updatedAt!: string;

        @ApiProperty({ example: 132 })
        totalUserCnt!: number;

        @ApiProperty({ example: 128 })
        activateUserCnt!: number;

        @ApiProperty({ example: 4 })
        disabledUserCnt!: number;

        @ApiProperty({ example: 6 })
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
            enum: ['일반 사용자', '부서 관리자', '총괄 관리자'],
            description: 'member.authorize를 한글 권한명으로 변환'
        })
        authorize!: string;

        @ApiProperty({
            example: '2026-07-19T21:49:17Z',
            description: 'member.login_at',
            format: 'date-time'
        })
        lastLoginAt!: string;

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
        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: 'seoyun.kim@organization.go.kr' })
        email!: string;

        @ApiProperty({ example: '정책기획팀' })
        department!: string;

        @ApiProperty({ example: '일반 사용자' })
        role!: string;

        @ApiProperty({ example: '2026-07-19' })
        createdAt!: string;

        @ApiProperty({ example: '신정보' })
        createdBy!: string;

        @ApiProperty({ example: '2026-07-19T22:00:50Z', format: 'date-time' })
        lastLoginAt!: string;

        @ApiProperty({ example: 42 })
        chatCnt!: number;

        @ApiProperty({ example: 17 })
        filterDetectCnt!: number;

        @ApiProperty({ example: 31 })
        masking!: number;

        @ApiProperty({ example: 6 })
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
    }

    export class UserPromptOverviewItem {
        @ApiProperty({ example: 32 })
        userId!: number;

        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: '정책기획팀' })
        department!: string;

        @ApiProperty({ example: '사원' })
        role!: string;

        @ApiProperty({
            type: [String],
            example: [
                'cbc9dacd-1788-4f7a-81c8-1df5d0d30cbf',
                'abf1bff0-6b7e-40f4-a1d3-c49e80dc4ab5'
            ]
        })
        promptTicket!: string[];

        @ApiProperty({ example: 8 })
        promptCnt!: number;
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
            example: '8e88c068-722e-4c04-93c5-906cea400be2',
            format: 'uuid'
        })
        promptId!: string;

        @ApiProperty({ example: '계약 검토 내용 요약' })
        promptSummary!: string;

        @ApiProperty({
            example: '2026-07-25T13:18:17Z',
            format: 'date-time'
        })
        startedAt!: string;

        @ApiProperty({
            example: '2026-07-25T13:22:42Z',
            format: 'date-time'
        })
        endedAt!: string;

        @ApiProperty({ example: 'Local LLM' })
        model!: string;
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
        @ApiProperty({ example: '계약 검토 내용 요약' })
        promptSummary!: string;

        @ApiProperty({ example: '김서윤/정책기획팀' })
        nameDepartment!: string;

        @ApiProperty({ example: 'seoyun.kim@organization.go.kr' })
        email!: string;

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
            description: '부서별 활성 API 키 한도·사용량으로 계산한 월 사용률의 평균(%)'
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

        @ApiProperty({ example: '감사담당관', nullable: true, description: 'member_department.role' })
        departmentAdminRole!: string | null;

        @ApiProperty({ example: '부서 관리자', nullable: true, description: 'DEPART_ADMIN의 권한명' })
        departmentAdminAuthorize!: string | null;

        @ApiProperty({ example: 'woojinjang@organization.go.kr', nullable: true, description: '부서 관리자 이메일' })
        email!: string | null;

        @ApiProperty({ example: 9 })
        userCnt!: number;

        @ApiProperty({ example: 16, description: '서비스별 사용률 평균(%). 한도 0은 100으로 계산' })
        usePercent!: number;

        @ApiProperty({
            type: Number,
            example: 12400,
            description: '서비스별 사용량 평균(USD)'
        })
        useUsd!: number;

        @ApiProperty({
            type: Number,
            example: 80000,
            description: '서비스별 한도 평균(USD). 한도 0은 무제한'
        })
        limitUsd!: number;

        @ApiProperty({
            type: Number,
            example: 67600,
            description: '서비스별 잔여 한도 평균(USD). 무제한 서비스는 0'
        })
        remainUsd!: number;

        @ApiProperty({ type: () => [DepartmentLlmModel] })
        llmModel!: DepartmentLlmModel[];

        @ApiProperty({ example: false })
        mustFiltering!: boolean;

        @ApiProperty({ type: () => [DepartmentPolicy] })
        policies!: DepartmentPolicy[];
    }

    export class Detecting {
        @ApiProperty({ example: 2 })
        sensitiveCnt!: number;

        @ApiProperty({ example: 2 })
        privateCnt!: number;
    }

    export class LogListItem {
        @ApiProperty({ example: 1 })
        logId!: number;

        @ApiProperty({ example: '계약 검토 내용 요약' })
        title!: string;

        @ApiProperty({ example: '김서윤/정책기획팀' })
        userDepartment!: string;

        @ApiProperty({ example: '2026-07-19T22:46:12', format: 'date-time' })
        chatStartedAt!: string;

        @ApiProperty({ example: '2026-07-19T22:48:12', format: 'date-time' })
        chatEndedAt!: string;

        @ApiProperty({ example: 'GPT' })
        model!: string;

        @ApiProperty({ type: () => Detecting, nullable: true })
        detecting!: Detecting | null;

        @ApiProperty({ example: '마스킹 전송' })
        process!: string;
    }

    @ApiSchema({ name: 'AdminLegacyLogListResponse' })
    export class LogList {
        @ApiProperty({ type: () => [LogListItem] })
        data!: LogListItem[];

        @ApiProperty({ example: 1204 })
        totalCnt!: number;

        @ApiProperty({ example: 7 })
        dataCnt!: number;

        @ApiProperty({ example: 1204, nullable: true })
        filteringCnt!: number | null;

        @ApiProperty({ example: 1 })
        pageNumber!: number;
    }

    export type Trends = unknown;
    export type AdminLogs = AdminLog[] | null;
    export type PolicyDetectList = PolicyDetect[];
    export type DepartmentRiskList = DepartmentRisk[];
    export type UpdateUser = unknown;
    export type LogDetail = unknown;
}
