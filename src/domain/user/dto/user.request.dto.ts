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
            enum: ['claude', 'gpt', 'gemini', 'local'],
            description: 'LLM 서비스 또는 로컬 LLM 필터'
        })
        model?: string;

        @ApiPropertyOptional({
            type: String,
            example: '계약 보고서',
            description: '프롬프트 요약 또는 원문 검색 키워드. model, sort와 함께 사용할 수 있습니다.'
        })
        query?: string;

        @ApiPropertyOptional({
            type: String,
            example: 'recent',
            enum: ['recent', 'oldest'],
            default: 'recent',
            description: '정렬 방향: recent(최신순), oldest(오래된순). model, query와 함께 사용할 수 있습니다.'
        })
        sort?: string;
    }
}
