import { ApiProperty } from "@nestjs/swagger";

export namespace UserResDTO {
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

        @ApiProperty({ example: 31, description: '마스킹 후 전송 수' })
        masking!: number;

        @ApiProperty({ example: 6, description: '로컬 전송 수' })
        local!: number;

        @ApiProperty({ example: 14.5, description: '로컬 전송 비율' })
        localPercent!: number;
    }

    export type MessageList = unknown;
}
