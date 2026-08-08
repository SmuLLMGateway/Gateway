/** LPL Provider `POST /generate` 요청 계약입니다. */
export interface LplLlmGenerateRequest {
  /** 마스킹 처리된 사용자 입력 텍스트입니다. */
  readonly text: string;
  /** LPL Registry에 등록된 활성 LLM Deployment ID입니다. */
  readonly llmDeploymentId: string;
}

/** LPL Provider `POST /generate`가 선택적으로 반환하는 토큰 사용량입니다. */
export interface LplLlmGenerateUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

/** LPL Provider `POST /generate` 성공 응답 계약입니다. */
export interface LplLlmGenerateResponse {
  /** 생성된 LLM 최종 응답입니다. */
  readonly text: string;
  readonly modelName?: string;
  readonly finishReason?: string;
  readonly usage?: LplLlmGenerateUsage;
}
