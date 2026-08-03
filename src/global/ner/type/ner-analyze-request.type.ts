/** LPL Provider `POST /detect` 요청 계약입니다. */
export interface NerAnalyzeRequest {
  readonly text: string;
  readonly nerDeploymentId: string;
  readonly llmDeploymentId: string;
  readonly existingDetections: readonly NerExistingDetection[];
}

/** Gateway 정규식 탐지 결과를 LPL에 전달하는 형식입니다. */
export interface NerExistingDetection {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly type: string;
  readonly source: 'regex';
  readonly score: number;
}

/** LPL이 NER·로컬 LLM으로 새로 탐지한 결과입니다. */
export interface NerDetection {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly type: string;
  readonly source: 'ner' | 'llm';
  readonly score: number;
  /**
   * LPL의 마스킹 치환 계약 확장 필드입니다. 현재 Provider 명세에는 없지만,
   * Gateway는 탐지 결과가 있을 때 이 값을 반드시 받아 저장·전송합니다.
   */
  readonly maskingText?: string;
}

export interface NerAnalyzeResponse {
  readonly detections: readonly NerDetection[];
}
