import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace PromptResDTO {
    @ApiSchema({ name: 'PromptAnalyzeRequestResponse' })
    export class AnalyzeRequest {
        @ApiProperty({
            example: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
            description: '분석 요청이 연결된 채팅방 ID',
            format: 'uuid'
        })
        chatRoomId!: string;
    }

    export class MaskingFile {
        @ApiProperty({
            example: '[A사] 협력 파트너십 계약서.pdf',
            description: '업로드 당시 파일명'
        })
        fileOriginalName!: string;

        @ApiProperty({
            example: 'http://local-llm...',
            description: '마스킹 요소 탐지 결과의 파일 URL'
        })
        fileUrl!: string;

        @ApiProperty({ example: '민감정보', nullable: true, description: '마스킹 분류. 파일에서 탐지되지 않으면 null' })
        maskingCategory!: string | null;

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

        @ApiProperty({
            example: 22,
            description: '탐지 종료 인덱스(JavaScript 문자열 기준, 해당 인덱스 포함)'
        })
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
            type: () => [MaskingFile],
            nullable: true,
            description: '파일이 없으면 null'
        })
        file!: MaskingFile[] | null;

        @ApiProperty({
            type: () => [MaskingText],
            nullable: true,
            description: '텍스트에서 탐지된 항목이 없으면 null'
        })
        text!: MaskingText[] | null;
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

    @ApiSchema({ name: 'PromptRecentAnalyzeResponse' })
    export class RecentAnalyze extends Analyze {
        @ApiProperty({
            example: '8e88c068-722e-4c04-93c5-906cea400be2',
            description: '분석 요청 티켓',
            format: 'uuid'
        })
        ticket!: string;

        @ApiProperty({
            example: 'eb1565a6-348e-4905-b852-929e3d630980',
            nullable: true,
            description: '이전 분석 요청 티켓. 없으면 null',
            format: 'uuid'
        })
        recentTicket!: string | null;
    }

    export class RecentPrompt {
        @ApiProperty({
            example: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
            description: '채팅방 ID(prompt_room_id)',
            format: 'uuid'
        })
        chatRoomId!: string;

        @ApiProperty({
            example: 'A사와 체결 보고서 작성',
            description: '대화 제목'
        })
        title!: string;

        @ApiProperty({
            example: '2026-07-19T17:33:30Z',
            description: '채팅방 생성 시각(started_at)',
            format: 'date-time'
        })
        createdAt!: string;
    }

    export class PromptListFile {
        @ApiProperty({
            example: 'http://local-llm...',
            description: '프롬프트에 첨부된 파일 URL'
        })
        fileUrl!: string;

        @ApiProperty({
            example: '[A사] 협력 파트너십 계약서.pdf',
            description: '프롬프트에 첨부된 파일의 원본 이름'
        })
        fileOriginalName!: string;
    }

    export class PromptListItem {
        @ApiProperty({
            example: '다음 주 A사와 체결 예정인...',
            description: 'LLM 요청 내용'
        })
        request!: string;

        @ApiProperty({
            example: '다음은 A사와 체결할 보고서 초안입니다...',
            nullable: true,
            description: 'LLM 응답 내용. 아직 LLM 전송 전이면 null'
        })
        response!: string | null;

        @ApiProperty({
            type: () => [PromptListFile],
            nullable: true,
            description: '첨부 파일 목록. 파일이 없으면 null'
        })
        file!: PromptListFile[] | null;
    }

    export type Empty = null;
    export type LlmResponse = string | null;
    export type RecentPromptList = RecentPrompt[] | null;
    export type PromptList = PromptListItem[] | null;
    export type FileDownload = string;
    export type ModelList = string[];
}
