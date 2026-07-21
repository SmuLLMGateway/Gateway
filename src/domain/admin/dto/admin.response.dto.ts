import { ApiProperty } from "@nestjs/swagger";

export namespace AdminResDTO {
    export class CreateUser {
        @ApiProperty({ example: '김서윤' })
        name!: string;

        @ApiProperty({ example: '일반 사용자' })
        role!: string;

        @ApiProperty({ example: '2026-07-20T15:11:39Z', format: 'date-time' })
        createdAt!: string;
    }

    export class CreateDepartment {
        @ApiProperty({ example: '정책기획팀' })
        name!: string;

        @ApiProperty({ example: '2026-07-20T15:18:39Z', format: 'date-time' })
        createdAt!: string;
    }

    export class DepartmentListItem {
        @ApiProperty({ example: 1 })
        departmentId!: number;

        @ApiProperty({ example: '정책기획팀' })
        departmentName!: string;
    }

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

    export class RegisterApiKey {
        @ApiProperty({ example: '정책기획팀' })
        targetDepartment!: string;

        @ApiProperty({ example: 'GPT' })
        service!: string;

        @ApiProperty({ example: '2026-07-20T15:45:39Z', format: 'date-time' })
        createdAt!: string;
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
        role!: string;

        @ApiProperty({ example: '2026-07-19T21:49:17Z', format: 'date-time' })
        lastLoginAt!: string;

        @ApiProperty({ example: '활성' })
        status!: string;
    }

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
