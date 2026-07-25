import { ApiProperty, ApiSchema } from "@nestjs/swagger";

export namespace PromptResDTO {
    export class MaskingFile {
        @ApiProperty({
            example: '[A사] 협력 파트너십 계약서.pdf',
            description: '업로드 당시 파일명'
        })
        fileOriginalName!: string;

        @ApiProperty({
            example: 's3://gateway-private/masking/a81cc17e-e10a-46ae-8113-dceffb932d6c/source',
            description: '파일 다운로드 URL 생성 API에 전달할 저장 파일 URL'
        })
        fileUrl!: string;

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

        @ApiProperty({
            example: 22,
            description: '탐지 종료 인덱스(JavaScript 문자열 기준, 해당 인덱스 미포함)'
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
            description: 'LLM 응답 내용'
        })
        response!: string;

        @ApiProperty({
            type: () => [PromptListFile],
            nullable: true,
            description: '첨부 파일 목록. 파일이 없으면 null'
        })
        file!: PromptListFile[] | null;
    }

    @ApiSchema({ name: 'PromptListResponse' })
    export class PromptListPage {
        @ApiProperty({ type: () => [PromptListItem] })
        data!: PromptListItem[];

        @ApiProperty({
            example: true,
            description: '다음 페이지 존재 여부'
        })
        hasNext!: boolean;

        @ApiProperty({
            example: '1784870718000',
            description: '다음 페이지 조회 커서(UNIX timestamp ms)'
        })
        nextCursor!: string;
    }

    export type Empty = null;
    export type LlmResponse = string | null;
    export type RecentPromptList = RecentPrompt[] | null;
    export type PromptList = PromptListPage | null;
    export type FileDownload = string;
    export type ModelList = string[];
    export type Search = unknown;
}
