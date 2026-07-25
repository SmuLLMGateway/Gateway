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
            description: '마스킹 요소를 탐지할 원본 텍스트 (UTF-8 기준 최대 65,535바이트)',
            maxLength: 65535
        })
        text!: string;

        @ApiProperty({
            example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
            description: '분석 요청 티켓',
            format: 'uuid'
        })
        ticket!: string;

        @ApiProperty({
            example: '8e88c068-722e-4c04-93c5-906cea400be2',
            nullable: true,
            description: '직전 분석 요청 티켓. 첫 요청이면 null',
            format: 'uuid'
        })
        recentTicket!: string | null;

        @ApiProperty({
            example: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
            description: '채팅방 ID',
            format: 'uuid'
        })
        chatRoomId!: string;
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
            example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
            description: '마스킹 요소 탐지 요청에 사용한 티켓',
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
            example: 's3://gateway-private/masking/a81cc17e-e10a-46ae-8113-dceffb932d6c/source',
            description: '분석 결과에서 반환된 파일 URL',
            maxLength: 1024
        })
        fileUrl!: string;
    }

    export class PromptList {
        @ApiProperty({
            example: '1784957118000',
            description: '최신순 페이지네이션 커서(UNIX timestamp ms)',
            required: false
        })
        cursor?: string;

        @ApiProperty({
            example: 10,
            description: '불러올 데이터 수'
        })
        pageSize!: number;
    }

    export class Search {
        @ApiProperty({
            example: '계약 보고서',
            description: '대화 검색 키워드'
        })
        query!: string;
    }
}
