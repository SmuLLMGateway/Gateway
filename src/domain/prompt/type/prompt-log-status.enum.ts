/** 채팅방에 기록되는 프롬프트 요청의 처리 상태입니다. */
export enum PromptLogStatus {
  PENDING = 'PENDING',
  MASKING = 'MASKING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}
