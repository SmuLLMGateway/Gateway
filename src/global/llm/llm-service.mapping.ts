import { LlmProvider } from './enum/llm-provider.enum.js';
import { LlmService } from './enum/llm-service.enum.js';

export interface LlmServiceDescriptor {
  /** API 키 검증과 암호화 AAD에 사용하는 내부 provider 식별자입니다. */
  readonly provider: LlmProvider;
  /** llm_detail_model.llm_name의 소문자 접두사입니다. */
  readonly llmNamePrefix: string;
}

const LLM_SERVICE_DESCRIPTORS: Readonly<
  Record<LlmService, LlmServiceDescriptor>
> = Object.freeze({
  [LlmService.GEMINI]: Object.freeze({
    provider: LlmProvider.GEMINI,
    llmNamePrefix: 'gemini',
  }),
  [LlmService.GPT]: Object.freeze({
    provider: LlmProvider.GPT,
    llmNamePrefix: 'gpt',
  }),
  [LlmService.CLAUDE]: Object.freeze({
    provider: LlmProvider.CLAUDE,
    llmNamePrefix: 'claude',
  }),
});

const LLM_SERVICE_BY_NORMALIZED_NAME: Readonly<Record<string, LlmService>> =
  Object.freeze({
    gemini: LlmService.GEMINI,
    gpt: LlmService.GPT,
    claude: LlmService.CLAUDE,
  });

/**
 * 외부 입력을 API와 DB에 사용하는 canonical 서비스명으로 변환합니다.
 * 입력의 앞뒤 공백과 대소문자는 구분하지 않습니다.
 */
export function normalizeLlmService(value: unknown): LlmService | null {
  if (typeof value !== 'string') {
    return null;
  }

  return LLM_SERVICE_BY_NORMALIZED_NAME[value.trim().toLowerCase()] ?? null;
}

export function getLlmServiceDescriptor(
  service: LlmService,
): LlmServiceDescriptor {
  return LLM_SERVICE_DESCRIPTORS[service];
}

/**
 * 모델명이 소유한 서비스명을 판별합니다. 기존 모델 계약처럼 접두사 뒤에는
 * 문자열 끝, 공백 또는 하이픈만 허용하여 예기치 않은 접두사 충돌을 막습니다.
 */
export function resolveLlmServiceFromModelName(
  modelName: unknown,
): LlmService | null {
  if (typeof modelName !== 'string') {
    return null;
  }

  const normalizedModelName = modelName.toLowerCase();

  for (const service of Object.values(LlmService)) {
    const { llmNamePrefix } = getLlmServiceDescriptor(service);
    if (hasLlmNamePrefix(normalizedModelName, llmNamePrefix)) {
      return service;
    }
  }

  return null;
}

function hasLlmNamePrefix(modelName: string, prefix: string): boolean {
  if (!modelName.startsWith(prefix)) {
    return false;
  }

  const nextCharacter = modelName.charAt(prefix.length);
  return nextCharacter === '' || nextCharacter === '-' || /\s/.test(nextCharacter);
}
