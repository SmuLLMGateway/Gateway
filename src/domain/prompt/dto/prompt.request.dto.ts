import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace PromptReqDTO {
    export class PrePrompt {
        @ApiProperty({
            example: 'Claude Sonnet 5',
            description: '사용할 LLM 모델',
            maxLength: 100
        })
        model!: string;

        @ApiProperty({
            example: '다음 주 A사와 체결 예정인 미공개...',
            description: '마스킹 요소를 탐지할 원본 텍스트',
            maxLength: 100000
        })
        text!: string;

        @ApiProperty({
            example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
            description: '분석 요청 티켓',
            format: 'uuid'
        })
        ticket!: string;
    }

    @ApiSchema({ name: 'PromptAnalyzeRequest' })
    export class Analyze {
        @ApiProperty({
            example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
            description: '분석 요청 티켓',
            format: 'uuid'
        })
        ticket!: string;
    }

    export class LlmRequest {
        @ApiProperty({
            example: 'Claude Sonnet 5',
            description: '사용할 LLM 모델'
        })
        model!: string;

        @ApiProperty({
            example: '다음 주 A사와 체결 예정인 미공개...',
            description: 'LLM에 전송할 수정된 텍스트'
        })
        text!: string;

        @ApiProperty({
            example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
            description: 'LLM 전송 요청 티켓',
            format: 'uuid'
        })
        ticket!: string;
    }

    export class LlmResponse {
        @ApiProperty({
            example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
            description: 'LLM 전송 요청 티켓',
            format: 'uuid'
        })
        ticket!: string;
    }

    export class FileDownload {
        @ApiProperty({
            example: 52,
            description: '다운로드할 파일의 오브젝트 ID'
        })
        objectId!: number;
    }

    export class Search {
        @ApiProperty({
            example: '계약 보고서',
            description: '대화 검색 키워드'
        })
        query!: string;
    }
}
