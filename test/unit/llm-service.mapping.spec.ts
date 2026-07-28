import { LlmProvider } from '../../src/global/llm/enum/llm-provider.enum.js';
import { LlmService } from '../../src/global/llm/enum/llm-service.enum.js';
import {
  getLlmServiceDescriptor,
  normalizeLlmService,
  resolveLlmServiceFromModelName,
} from '../../src/global/llm/llm-service.mapping.js';

describe('LLM 외부 서비스와 내부 provider 매핑', () => {
  it.each([
    ['  gemini ', LlmService.GEMINI],
    ['GPT', LlmService.GPT],
    ['ClAuDe', LlmService.CLAUDE],
  ])('%s 입력을 canonical 서비스명 %s로 정규화한다', (input, expected) => {
    expect(normalizeLlmService(input)).toBe(expected);
  });

  it.each([
    [LlmService.GEMINI, LlmProvider.GEMINI, 'gemini'],
    [LlmService.GPT, LlmProvider.GPT, 'gpt'],
    [LlmService.CLAUDE, LlmProvider.CLAUDE, 'claude'],
  ])(
    '%s은 내부 provider %s 및 모델 접두사 %s를 사용한다',
    (service, provider, llmNamePrefix) => {
      expect(getLlmServiceDescriptor(service)).toEqual({
        provider,
        llmNamePrefix,
      });
    },
  );

  it.each([
    ['Gemini 2.5 Pro', LlmService.GEMINI],
    ['gEmInI-2.5-flash', LlmService.GEMINI],
    ['GPT-4.1', LlmService.GPT],
    ['gpt 4o', LlmService.GPT],
    ['Claude Sonnet 4', LlmService.CLAUDE],
    ['claude-3-5-haiku', LlmService.CLAUDE],
  ])('%s 모델명에서 저장 서비스 %s를 판별한다', (modelName, service) => {
    expect(resolveLlmServiceFromModelName(modelName)).toBe(service);
  });

  it.each(['gpt4o', 'geminix', 'claudette', 'x-gpt-4o', '', null])(
    '모델 접두사 경계가 맞지 않는 %p은 서비스로 판별하지 않는다',
    (modelName) => {
      expect(resolveLlmServiceFromModelName(modelName)).toBeNull();
    },
  );

  it.each([
    undefined,
    null,
    1,
    {},
    '',
    'Azure',
    'Google',
    'OpenAI',
    'Anthropic',
  ])(
    '지원하지 않는 입력 %p은 서비스로 정규화하지 않는다',
    (service) => {
      expect(normalizeLlmService(service)).toBeNull();
    },
  );
});
