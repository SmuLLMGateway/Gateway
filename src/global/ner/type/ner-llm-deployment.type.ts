/** NER 서버 /deployments/llm의 로컬 LLM 배포 요약입니다. */
export interface NerLlmDeployment {
  readonly deploymentId: string;
  readonly displayName: string;
  readonly modelId: string | null;
  readonly enabled: boolean;
}
