import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export namespace AdminReqDTO {
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
