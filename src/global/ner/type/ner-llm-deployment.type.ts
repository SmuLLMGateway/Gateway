import type { NerDeploymentSummary } from './ner-deployment-summary.type.js';

/** LPL /deployments/llm의 로컬 LLM 배포 요약입니다. */
export type NerLlmDeployment = NerDeploymentSummary;

/** LPL /deployments/llm/{deploymentId}의 로컬 LLM 배포 상세입니다. */
export interface NerLlmDeploymentDetail extends NerLlmDeployment {
  readonly adapterType: string;
  readonly baseUrl?: string;
  readonly modelName?: string;
  readonly timeoutMs?: number;
}
