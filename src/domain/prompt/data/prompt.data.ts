export namespace PromptData {
  export interface CreatePromptRoom {
    startedAt: Date;
    lastCommunicatedAt: Date;
    promptRoomTitle: string;
    memberId: string;
  }

  export interface CreatePromptLog {
    originalText: string;
    fileUrl: string | null;
    maskingText: string;
    communicatedAt: Date;
    modelType: string;
    responseText: string | null;
    promptRoomId: string;
  }

  export interface CreatePromptMasking {
    maskingText: string | null;
    promptLogId: string;
    policyId: string;
  }

  /** 프롬프트 과거 기록 조회 결과의 원본 데이터 */
  export interface RecentPrompt {
    promptId: number;
    title: string;
    createdAt: Date | string;
  }
}
