/**
 * NER 외부 API 명세가 확정되기 전 도메인 Service와 NerClient 사이에서 사용하는
 * 내부 요청 계약입니다. 파일 원본 대신 만료 시간이 짧은 MinIO URL을 전달합니다.
 */
export interface NerAnalyzeRequest {
  readonly ticket: string;
  readonly text: string;
  readonly file: {
    readonly url: string;
    readonly contentType: string;
    readonly size: number;
    readonly sha256: string;
  };
}
