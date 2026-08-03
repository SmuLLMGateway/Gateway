export const NER_ADAPTER_TYPES = [
  'gliner_http',
  'hf_inference_token_classification',
  'http_ner',
  'mock',
] as const;

export type NerAdapterType = (typeof NER_ADAPTER_TYPES)[number];

export const LLM_ADAPTER_TYPES = [
  'mock',
  'openai_compatible',
] as const;

export type LlmAdapterType = (typeof LLM_ADAPTER_TYPES)[number];

/** LPL Provider에 등록하는 NER Deployment 계약입니다. */
interface DeploymentCreateRequestBase {
  readonly deploymentId: string;
  readonly enabled: boolean;
}

export type NerDeploymentCreateRequest =
  | (DeploymentCreateRequestBase & {
    readonly adapterType: 'mock';
  })
  | (DeploymentCreateRequestBase & {
    readonly adapterType: Exclude<NerAdapterType, 'mock'>;
    readonly baseUrl: string;
    readonly timeoutMs: number;
  });

/** LPL Provider에 등록하는 로컬 LLM Deployment 계약입니다. */
export type LlmDeploymentCreateRequest =
  | (DeploymentCreateRequestBase & {
    readonly adapterType: 'mock';
  })
  | (DeploymentCreateRequestBase & {
    readonly adapterType: 'openai_compatible';
    readonly baseUrl: string;
    readonly modelName: string;
    readonly timeoutMs: number;
  });

/** 등록 완료 응답에서 Gateway가 사용하는 최소 계약입니다. */
export interface DeploymentCreateResponse {
  readonly deploymentId: string;
}

/** LPL Deployment 활성 상태 변경 요청 계약입니다. */
export interface DeploymentEnabledUpdateRequest {
  readonly enabled: boolean;
}
