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
        departmentUserCnt?: number;

        @ApiProperty({ type: [String], example: ['Local LLM'] })
        canUseLLMModel?: string[];

        @ApiProperty({ example: '표준' })
        policyType?: string;

        @ApiProperty({ example: 9 })
        policyCnt?: number;

        @ApiProperty({ example: '허용' })
        outbound?: string;

        @ApiProperty({ example: 59 })
        departLimitPercent?: number;

        @ApiProperty({ example: 200000 })
        departLimitToken?: number;

        @ApiProperty({ example: 118000 })
        departUseToken?: number;
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

        @ApiProperty({ example: 'OpenAI' })
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
            example: ['전화번호', 'API 키']
        })
        policies!: unknown[];
    }

    export class Dashboard {
        @ApiProperty({ example: '2026-07-19T20:55:00Z', format: 'date-time' })
        updatedAt!: string;

        @ApiProperty({ example: 128 })
        userCnt!: number;

        @ApiProperty({ example: 6 })
        userRate!: number;

        @ApiProperty({ example: 3842 })
        chatCnt!: number;

        @ApiProperty({ example: 200 })
        chatRate!: number;

        @ApiProperty({ example: 715 })
        filterDetect!: number;

        @ApiProperty({ example: 2.1 })
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

        @ApiProperty({ example: 14.5 })
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

        @ApiProperty({ example: 263 })
        llmRequestCnt!: number;

        @ApiProperty({ example: 6 })
        userCnt!: number;

        @ApiProperty({ example: 43.3 })
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
        @ApiProperty({ example: 1 })
        userId!: number;

        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: 'seoyun.kim@organization.go.kr' })
        email!: string;

        @ApiProperty({ example: '정책기획팀' })
        department!: string;

        @ApiProperty({ example: '일반 사용자' })
        authorize!: string;

        @ApiProperty({ example: '2026-07-19T21:49:17Z', format: 'date-time' })
        lastLoginAt!: string;

        @ApiProperty({ example: '활성' })
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
            format: 'date-time'
        })
        updatedAt!: string;

        @ApiProperty({ example: 9 })
        totalDepartmentCnt!: number;

        @ApiProperty({ example: 102 })
        totalUserCnt!: number;

        @ApiProperty({ example: 4 })
        outboundDepartmentCnt!: number;

        @ApiProperty({ example: 42 })
        averageUsePercent!: number;

        @ApiProperty({ example: 14.4 })
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

        @ApiProperty({ example: '장우진' })
        departmentAdminName!: string;

        @ApiProperty({ example: '감사담당관' })
        departmentAdminRole!: string;

        @ApiProperty({ example: '부서 관리자' })
        departmentAdminAuthorize!: string;

        @ApiProperty({ example: 'woojinjang@organization.go.kr' })
        email!: string;

        @ApiProperty({ example: 9 })
        userCnt!: number;

        @ApiProperty({ example: 16 })
        usePercent!: number;

        @ApiProperty({ example: 12400 })
        useToken!: number;

        @ApiProperty({ example: 80000 })
        limitToken!: number;

        @ApiProperty({ example: 67600 })
        remainToken!: number;

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
    export type AdminLogs = AdminLog[];
    export type PolicyDetectList = PolicyDetect[];
    export type DepartmentRiskList = DepartmentRisk[];
    export type UpdateUser = unknown;
    export type LogDetail = unknown;
}
