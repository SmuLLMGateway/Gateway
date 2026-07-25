import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { UserRole } from "../../../global/security/type/user-role.enum.js";

const ADMIN_POLICY_CODES = [
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
    'API_KEY'
] as const;

export namespace AdminReqDTO {
    @ApiSchema({ name: 'AdminCreateUserRequest' })
    export class CreateUser {
        @ApiProperty({ example: '김서윤', description: '사용자 이름' })
        name!: string;

        @ApiProperty({
            example: 'seoyun.kim@organization.go.kr',
            format: 'email',
            description: '사용자 이메일'
        })
        email!: string;

        @ApiProperty({
            example: 'Gateway123!',
            description: '사용자 초기 비밀번호'
        })
        password!: string;

        @ApiProperty({ example: '정책기획팀', description: '소속 부서명' })
        department!: string;

        @ApiProperty({
            example: UserRole.USER,
            enum: [UserRole.USER, UserRole.DEPART_ADMIN],
            description: '생성할 사용자 역할'
        })
        role!: string;
    }

    @ApiSchema({ name: 'AdminCreateDepartmentRequest' })
    export class CreateDepartment {
        @ApiProperty({
            example: '정책기획팀',
            minLength: 1,
            maxLength: 255,
            description: '생성할 부서명. 앞뒤 공백은 제거됩니다.'
        })
        name!: string;
    }

    @ApiSchema({ name: 'AdminDepartmentListQuery' })
    export class DepartmentList {
        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({ example: 1, description: '현재 페이지 번호' })
        pageNumber!: number;

        @ApiProperty({ example: '감사', description: '부서명 검색 키워드' })
        query?: string;
    }

    @ApiSchema({ name: 'AdminRegisterApiKeyRequest' })
    export class RegisterApiKey {
        @ApiProperty({ example: 'sk-example', description: '등록할 LLM API 키' })
        apiKey!: string;

        @ApiProperty({
            example: 'OpenAI',
            enum: ['Anthropic', 'OpenAI', 'Google'],
            description: 'LLM 서비스: Anthropic, OpenAI, Google'
        })
        service!: string;
    }

    export interface PolicyInput {
        maskingContent: string;
        maskingClass: string;
    }

    @ApiSchema({ name: 'AdminSyncPoliciesRequest' })
    export class SyncPolicies {
        @ApiProperty({
            type: [String],
            enum: ADMIN_POLICY_CODES,
            example: ['PHONE', 'API_KEY'],
            description: '최종 적용할 부서 정책 코드 목록'
        })
        policies!: string[] | PolicyInput[];
    }

    @ApiSchema({ name: 'AdminTrendsQuery' })
    export class Trends {
        @ApiProperty({
            example: '7일',
            description: '조회 기간: 7일, 1달, 3달'
        })
        recent!: string;
    }

    @ApiSchema({ name: 'AdminDepartmentRisksQuery' })
    export class DepartmentRisks {
        @ApiProperty({
            example: '7일',
            description: '조회 기간: 7일, 1달, 3달'
        })
        recent!: string;
    }

    @ApiSchema({ name: 'AdminUserListQuery' })
    export class UserList {
        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({ example: 1, description: '현재 페이지 번호' })
        pageNumber!: number;

        @ApiPropertyOptional({
            example: 'recent',
            description: '정렬 기준: recent, department, role, status'
        })
        orderBy?: string;

        @ApiPropertyOptional({
            example: '김서윤',
            description: '이름 또는 이메일 검색어. orderBy와 동시에 사용하지 않음'
        })
        query?: string;
    }

    @ApiSchema({ name: 'AdminUserPromptOverviewQuery' })
    export class UserPromptOverview {
        @ApiProperty({ example: 1, description: '현재 페이지 번호' })
        pageNumber!: number;

        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({
            example: '정책기획팀',
            description: '사용자 또는 부서 검색어'
        })
        query!: string;
    }

    @ApiSchema({ name: 'AdminUserPromptListQuery' })
    export class UserPromptList {
        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({ example: 1, description: '현재 페이지 번호' })
        pageNumber!: number;
    }

    @ApiSchema({ name: 'AdminLegacyLogListQuery' })
    export class LogList {
        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({ example: 1, description: '현재 페이지 번호' })
        pageNumber!: number;

        @ApiPropertyOptional({
            example: 'recent',
            description: '정렬 기준: recent, process, policy, model'
        })
        orderBy?: string;

        @ApiPropertyOptional({
            example: '김서윤',
            description: '사용자 이름 검색어. orderBy와 동시에 사용하지 않음'
        })
        query?: string;
    }

    export type UpdateUser = unknown;
}
