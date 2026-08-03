import {
    ApiProperty,
    ApiPropertyOptional,
    ApiSchema
} from "@nestjs/swagger";

export namespace UserReqDTO {
    @ApiSchema({ name: 'UserMessageHistoryRequest' })
    export class MessageList {
        @ApiProperty({
            type: String,
            example: '7d',
            enum: ['7d', '30d', '90d', 'all'],
            description: '조회 기간: 7d, 30d, 90d, all'
        })
        recent!: string;

        @ApiProperty({
            type: Number,
            example: 10,
            description: '페이지당 데이터 수'
        })
        pageSize!: number;

        @ApiProperty({
            type: Number,
            example: 1,
            description: '현재 페이지 번호, 1부터 시작'
        })
        pageNumber!: number;

        @ApiPropertyOptional({
            type: String,
            example: 'gpt',
            enum: ['claude', 'gpt', 'local'],
            description: '정렬 기준: claude, gpt, local'
        })
        orderBy?: string;

        @ApiPropertyOptional({
            type: String,
            example: '계약 보고서',
            description: '검색 키워드. orderBy와 동시에 사용하지 않음'
        })
        query?: string;
    }
}
