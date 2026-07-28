import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace UserResDTO {
    @ApiSchema({ name: 'UserInfoResponse' })
    export class UserInfo {
        @ApiProperty({ type: String, example: 'security.kim@organization.go.kr' })
        email!: string;

        @ApiProperty({ type: String, example: '김보안' })
        name!: string;

        @ApiProperty({ type: String, example: '기획 1팀' })
        department!: string;

        @ApiProperty({ type: String, enum: ['일반 사용자', '부서 관리자', '총 관리자'], example: '일반 사용자' })
        role!: string;

        @ApiProperty({ type: Number, example: 17, description: '이번 달 외부·내부 LLM 전송 프롬프트 중 보안 정책 탐지 수' })
        filter!: number;

        @ApiProperty({ type: Number, example: 45.5, description: '이번 달 개인 사용량(member_limit.usage 합계)' })
        personalLimitRate!: number;

        @ApiProperty({ type: Number, example: 61.2, description: '이번 달 부서 사용량(active_api_key.usage 합계)' })
        departmentLimitRate!: number;
    }

    @ApiSchema({ name: 'UserMessageSummaryResponse' })
    export class MessageSummary {
        @ApiProperty({
            example: '2026-07-19T20:17:49Z',
            description: '집계 갱신 시각',
            format: 'date-time'
        })
        updatedAt!: string;

        @ApiProperty({ example: 42, description: '전체 채팅 수' })
        totalChatCnt!: number;

        @ApiProperty({ example: 17, description: '필터 감지 수' })
        filter!: number;

        @ApiProperty({ example: 40.5, description: '필터 감지율' })
        filterPercent!: number;

        @ApiProperty({ example: 31, description: '마스킹 후 전송 수' })
        masking!: number;

        @ApiProperty({ example: 6, description: '로컬 전송 수' })
        local!: number;

        @ApiProperty({ example: 14.5, description: '로컬 전송 비율' })
        localPercent!: number;
    }

    @ApiSchema({ name: 'UserMessageHistoryItem' })
    export class MessageHistoryItem {
        @ApiProperty({
            type: String,
            example: 'cbc9dacd-1788-4f7a-81c8-1df5d0d30cbf',
            format: 'uuid'
        })
        promptId!: string;

        @ApiProperty({ type: String, example: 'A사 계약 리스크 검토' })
        promptSummary!: string;

        @ApiProperty({
            type: String,
            example: '2026-07-24T18:25:50Z',
            format: 'date-time'
        })
        promptedAt!: string;

        @ApiProperty({ type: String, example: 'Local LLM' })
        llmModel!: string;

        @ApiProperty({ type: Number, example: 3 })
        detectCnt!: number;
    }

    @ApiSchema({ name: 'UserMessageHistoryResponse' })
    export class MessageHistory {
        @ApiProperty({ type: () => [MessageHistoryItem] })
        data!: MessageHistoryItem[];

        @ApiProperty({ type: Number, example: 42 })
        totalCnt!: number;

        @ApiProperty({ type: Number, example: 9 })
        dataCnt!: number;

        @ApiProperty({ type: Number, example: 1 })
        pageNumber!: number;
    }

    @ApiSchema({ name: 'UserDepartmentPolicyItem' })
    export class DepartmentPolicyItem {
        @ApiProperty({ type: Number, example: 3 })
        policyId!: number;

        @ApiProperty({ type: String, example: '전화번호' })
        maskingContent!: string;

        @ApiProperty({ type: String, example: '개인 정보' })
        maskingClass!: string;
    }

    @ApiSchema({ name: 'UserDepartmentPolicyListResponse' })
    export class DepartmentPolicyList {
        @ApiProperty({ type: String, example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({ type: () => [DepartmentPolicyItem] })
        policies!: DepartmentPolicyItem[];

        @ApiProperty({ type: Number, example: 2 })
        totalCnt!: number;
    }

    export type MessageList = MessageHistory | null;
    export type PolicyList = DepartmentPolicyList | null;
}
