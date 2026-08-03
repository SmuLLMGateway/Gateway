import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { UserRole } from "../../../global/security/type/user-role.enum.js";
import { SECURITY_POLICY_CONTENTS } from '../policy/security-policy.catalog.js';

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

        @ApiProperty({
            example: UserRole.USER,
            enum: [UserRole.USER, UserRole.DEPART_ADMIN],
            description: '생성할 사용자 역할'
        })
        authorize!: UserRole.USER | UserRole.DEPART_ADMIN;
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

        @ApiProperty({
            example: 'POLICY',
            minLength: 1,
            maxLength: 10,
            description: '부서 코드'
        })
        code!: string;

        @ApiPropertyOptional({
            example: true,
            type: Boolean,
            default: true,
            deprecated: true,
            description: '로컬 LLM은 모든 부서에서 항상 활성화됩니다. 전달값은 무시됩니다.'
        })
        activeLocalLLM?: boolean;

        @ApiProperty({
            example: true,
            type: Boolean,
            description: '외부 LLM 전송 전 마스킹 필수 여부'
        })
        mustFiltering!: boolean;

        @ApiProperty({
            example: 200000,
            type: Number,
            minimum: 0,
            description: '부서 한도. 0은 무제한'
        })
        departmentLimit!: number;
    }

    @ApiSchema({ name: 'AdminDepartmentListQuery' })
    export class DepartmentList {
        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({ example: 1, description: '현재 페이지 번호. null이면 첫 페이지' })
        pageNumber!: number;

        @ApiPropertyOptional({ example: '감사', description: '부서명 검색 키워드' })
        query?: string;
    }

    @ApiSchema({ name: 'AdminRegisterApiKeyRequest' })
    export class RegisterApiKey {
        @ApiProperty({ example: 'sk-example', description: '등록할 LLM API 키' })
        apiKey!: string;

        @ApiProperty({
            example: 'GPT',
            enum: ['Claude', 'GPT', 'Gemini'],
            description: 'LLM 서비스: Claude, GPT, Gemini'
        })
        service!: string;
    }

    export class DepartmentApiKey {
        @ApiProperty({
            example: 'GPT',
            enum: ['Claude', 'GPT', 'Gemini'],
            description: '조회할 LLM 서비스. 대소문자를 구분하지 않습니다.'
        })
        service!: string;
    }

    @ApiSchema({ name: 'AdminLinkDepartmentUsersRequest' })
    export class LinkDepartmentUsers {
        @ApiProperty({
            type: [Number],
            example: [23, 25],
            minItems: 1,
            description: '대상 부서에 새로 연동할 사용자 ID 목록. 양의 정수만 허용하며 중복할 수 없습니다.'
        })
        userIds!: number[];
    }

    @ApiSchema({ name: 'AdminSyncPoliciesRequest' })
    export class SyncPolicies {
        @ApiProperty({
            example: '기본 보안 정책',
            minLength: 1,
            maxLength: 255,
            description: '동기화할 기업 보안 정책 이름'
        })
        policyName!: string;

        @ApiProperty({
            type: [String],
            enum: SECURITY_POLICY_CONTENTS,
            example: ['PHONE', 'API_KEY'],
            description: '최종 적용할 부서 정책 코드 목록입니다. 빈 배열은 해당 부서의 정책을 모두 해제합니다.'
        })
        policies!: string[];
    }

    @ApiSchema({ name: 'AdminSyncGlobalPoliciesRequest' })
    export class SyncGlobalPolicies {
        @ApiProperty({
            example: '기본 보안 정책',
            minLength: 1,
            maxLength: 255,
            description: '생성하거나 활성화할 보안 정책 프리셋 이름'
        })
        presetName!: string;

        @ApiPropertyOptional({
            type: [String],
            enum: SECURITY_POLICY_CONTENTS,
            example: ['PHONE', 'API_KEY'],
            description: '새 프리셋을 생성하거나 기존 구성을 변경할 때만 전달하는 정책 코드 목록입니다. 생략하면 기존 프리셋을 활성화합니다.'
        })
        policies?: string[];
    }

    @ApiSchema({ name: 'AdminDepartmentRisksQuery' })
    export class DepartmentRisks {
        @ApiProperty({
            example: '7d',
            enum: ['7d', '30d', '90d'],
            description: '조회 기간: 7d, 30d, 90d'
        })
        recent!: string;
    }

    @ApiSchema({ name: 'AdminUserListQuery' })
    export class UserList {
        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({ example: 1, description: '현재 페이지 번호. null이면 첫 페이지' })
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

    export type UpdateUser = unknown;
}
