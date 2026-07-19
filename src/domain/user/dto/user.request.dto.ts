import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export namespace UserReqDTO {
    export class MessageList {
        @ApiProperty({
            example: '7일전',
            description: '조회 기간: 7일전, 30일전, 90일전, 전체'
        })
        recent!: string;

        @ApiProperty({ example: 10, description: '페이지당 데이터 수' })
        pageSize!: number;

        @ApiProperty({
            example: 1,
            description: '현재 페이지 번호, 1부터 시작'
        })
        pageNumber!: number;

        @ApiPropertyOptional({
            example: 'gpt',
            description: '정렬 기준: claude, gpt, local'
        })
        orderBy?: string;

        @ApiPropertyOptional({
            example: '계약 보고서',
            description: '검색 키워드. orderBy와 동시에 사용하지 않음'
        })
        query?: string;
    }
}
