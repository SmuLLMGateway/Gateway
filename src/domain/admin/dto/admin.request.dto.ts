import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../global/security/type/user-role.enum.js";

export namespace AdminReqDTO {
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

    export class CreateDepartment {
        @ApiProperty({ example: '정책기획팀', description: '생성할 부서명' })
        name!: string;
    }

    export class DepartmentList {
        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({ example: 1, description: '현재 페이지 번호' })
        pageNumber!: number;
    }

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

    export class Trends {
        @ApiProperty({
            example: '7일',
            description: '조회 기간: 7일, 1달, 3달'
        })
        recent!: string;
    }

    export class DepartmentRisks {
        @ApiProperty({
            example: '7일',
            description: '조회 기간: 7일, 1달, 3달'
        })
        recent!: string;
    }

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
