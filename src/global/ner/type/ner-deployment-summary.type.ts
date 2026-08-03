/** LPL Deployment 목록에서 공통으로 반환하는 요약 정보입니다. */
export interface NerDeploymentSummary {
  readonly deploymentId: string;
  readonly enabled: boolean;
}

/** LPL /deployments/ner/{deploymentId}/enabled 응답의 NER Deployment 상세입니다. */
export interface NerDeploymentDetail extends NerDeploymentSummary {
  readonly adapterType: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}
