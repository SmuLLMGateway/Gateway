/** LPL Provider `POST /titles` 요청 계약입니다. */
export interface LplChatTitleRequest {
  /** 실제 LLM 전송 본문과 같은 마스킹 처리된 사용자 입력입니다. */
  readonly text: string;
  /** 제목 생성에 사용할 활성 LPL LLM Deployment ID입니다. */
  readonly llmDeploymentId: string;
}

/** LPL Provider `POST /titles` 성공 응답 계약입니다. */
export interface LplChatTitleResponse {
  /** 줄바꿈 없는 1~30자 채팅 제목입니다. */
  readonly title: string;
}
