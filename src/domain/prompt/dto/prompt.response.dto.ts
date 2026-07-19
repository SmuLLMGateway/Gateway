import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace PromptResDTO {
    export class MaskingFile {
        @ApiProperty({ example: 52, description: '파일 오브젝트 ID' })
        fileObjectId!: number;

        @ApiProperty({ example: '민감정보', description: '마스킹 분류' })
        maskingCategory!: string;

        @ApiProperty({ example: 2, description: '파일 내 탐지 건수' })
        detectCnt!: number;
    }

    export class MaskingText {
        @ApiProperty({
            example: 'A사와 체결 예정인...',
            description: '탐지된 원문'
        })
        targetText!: string;

        @ApiProperty({ example: 6, description: '탐지 시작 인덱스' })
        startIdx!: number;

        @ApiProperty({ example: 22, description: '탐지 종료 인덱스' })
        endIdx!: number;

        @ApiProperty({ example: '민감정보', description: '마스킹 분류' })
        maskingCategory!: string;

        @ApiProperty({
            example: '조달 및 계약 정보',
            description: '마스킹 상세 분류'
        })
        detailCategory!: string;
    }

    export class Masking {
        @ApiProperty({
            type: () => MaskingFile,
            nullable: true,
            description: '파일이 없으면 null'
        })
        file!: MaskingFile | null;

        @ApiProperty({ type: () => [MaskingText] })
        text!: MaskingText[];
    }

    @ApiSchema({ name: 'PromptAnalyzeResponse' })
    export class Analyze {
        @ApiProperty({
            example: '다음 주 A사와 체결 예정인...',
            description: '분석 대상 원본 텍스트'
        })
        originText!: string;

        @ApiProperty({ type: () => Masking })
        masking!: Masking;
    }

    export class RecentPrompt {
        @ApiProperty({ example: 421, description: '프롬프트 ID' })
        promptId!: number;

        @ApiProperty({
            example: 'A사와 체결 보고서 작성',
            description: '대화 제목'
        })
        title!: string;

        @ApiProperty({
            example: '2026-07-19T17:33:30Z',
            description: '대화 생성 시각',
            format: 'date-time'
        })
        createdAt!: string;
    }

    export type Empty = null;
    export type LlmResponse = string;
    export type RecentPromptList = RecentPrompt[];
    export type FileDownload = string;
    export type Search = unknown;
}
