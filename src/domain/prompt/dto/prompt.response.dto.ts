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
            type: () => MaskingFile,
            nullable: true,
            description: '업로드 파일의 탐지 결과. 파일이 없으면 null'
        })
        file!: MaskingFile | null;

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

        @ApiProperty({
            example: 2,
            description: '이번 분석에서 탐지된 마스킹 요소 수'
        })
        recentDetectCnt!: number;

        @ApiProperty({ type: () => Masking })
        masking!: Masking;
    }

    @ApiSchema({ name: 'PromptAnalyzeNoDetectionResponse' })
    export class AnalyzeWithoutDetection {
        @ApiProperty({
            example: 0,
            description: '이번 분석에서 탐지된 마스킹 요소 수. 탐지 항목이 없으면 0'
        })
        recentDetectCnt!: 0;
    }

    @ApiSchema({ name: 'PromptRecentAnalyzeResponse' })
    export class RecentAnalyze {
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

        @ApiProperty({
            example: '다음 주 A사와 체결 예정인...',
            description: '분석 대상 원본 텍스트'
        })
        originText!: string;

        @ApiProperty({ type: () => Masking })
        masking!: Masking;
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

    export class PromptListPage {
        @ApiProperty({
            type: () => [PromptListItem],
            description: '최신순 프롬프트 목록. 같은 communicatedAt 경계는 UNIX ms 커서에서 누락되지 않도록 pageSize보다 많이 반환될 수 있음'
        })
        data!: PromptListItem[];

        @ApiProperty({
            example: true,
            description: '다음 페이지 존재 여부'
        })
        hasNext!: boolean;

        @ApiProperty({
            example: '1784957118000',
            description: '현재 페이지 마지막 프롬프트의 communicatedAt(UNIX timestamp ms)'
        })
        nextCursor!: string;
    }

    @ApiSchema({ name: 'PromptNerDeploymentSummary' })
    export class NerDeployment {
        @ApiProperty({ example: 'local-ner-gliner-multi', description: 'LPL Provider Deployment ID' })
        deploymentId!: string;

        @ApiProperty({ example: true, description: 'LPL Registry 활성화 여부. 비활성 Deployment도 목록에 포함됩니다.' })
        enabled!: boolean;
    }

    @ApiSchema({ name: 'PromptNerListResponse' })
    export class NerList {
        @ApiProperty({
            type: () => [NerDeployment],
            description: 'LPL Provider GET /deployments/ner 응답의 deployments 배열',
        })
        deployments!: NerDeployment[];
    }

    export type Empty = null;
    export type AnalyzeResult = Analyze | AnalyzeWithoutDetection;
    export type LlmResponse = string | null;
    export type RecentPromptList = RecentPrompt[] | null;
    export type PromptList = PromptListPage | null;
    export type FileDownload = string;
    export type ModelList = string[];
}
