/**
 * API와 DB에 노출하는 LLM 서비스 이름입니다.
 *
 * 실제 검증 API나 모델 이름은 서비스마다 다른 명칭을 사용하므로,
 * 내부 provider 식별자는 LlmProvider로 별도 관리합니다.
 */
export enum LlmService {
  GOOGLE = 'Google',
  OPENAI = 'OpenAI',
  ANTHROPIC = 'Anthropic',
}
