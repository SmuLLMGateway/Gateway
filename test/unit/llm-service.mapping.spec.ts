import { LlmProvider } from '../../src/global/llm/enum/llm-provider.enum.js';
import { LlmService } from '../../src/global/llm/enum/llm-service.enum.js';
import {
  getLlmServiceDescriptor,
  normalizeLlmService,
  resolveLlmServiceFromModelName,
} from '../../src/global/llm/llm-service.mapping.js';

describe('LLM 외부 서비스와 내부 provider 매핑', () => {
  it.each([
    ['  google ', LlmService.GOOGLE],
    ['OPENAI', LlmService.OPENAI],
    ['AnThRoPiC', LlmService.ANTHROPIC],
  ])('%s 입력을 canonical 서비스명 %s로 정규화한다', (input, expected) => {
    expect(normalizeLlmService(input)).toBe(expected);
  });

  it.each([
    [LlmService.GOOGLE, LlmProvider.GEMINI, 'gemini'],
    [LlmService.OPENAI, LlmProvider.GPT, 'gpt'],
    [LlmService.ANTHROPIC, LlmProvider.CLAUDE, 'claude'],
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
    ['Gemini 2.5 Pro', LlmService.GOOGLE],
    ['gEmInI-2.5-flash', LlmService.GOOGLE],
    ['GPT-4.1', LlmService.OPENAI],
    ['gpt 4o', LlmService.OPENAI],
    ['Claude Sonnet 4', LlmService.ANTHROPIC],
    ['claude-3-5-haiku', LlmService.ANTHROPIC],
  ])('%s 모델명에서 저장 서비스 %s를 판별한다', (modelName, service) => {
    expect(resolveLlmServiceFromModelName(modelName)).toBe(service);
  });

  it.each(['gpt4o', 'geminix', 'claudette', 'x-gpt-4o', '', null])(
    '모델 접두사 경계가 맞지 않는 %p은 서비스로 판별하지 않는다',
    (modelName) => {
      expect(resolveLlmServiceFromModelName(modelName)).toBeNull();
    },
  );

  it.each([undefined, null, 1, {}, '', 'Azure'])(
    '지원하지 않는 입력 %p은 서비스로 정규화하지 않는다',
    (service) => {
      expect(normalizeLlmService(service)).toBeNull();
    },
  );
});
