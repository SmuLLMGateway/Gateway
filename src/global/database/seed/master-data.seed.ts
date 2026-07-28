/** 프로젝트 시작 시 보장해야 하는 LLM 모델 마스터 목록입니다. */
export const DEFAULT_LLM_DETAIL_MODELS = [
  'gpt-5.4-nano',
  'gpt-5.5',
  'gpt-5.6-luna',
  'gpt-5.6-terra',
  'gpt-5.6-sol',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'claude-haiku-4-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
] as const;

export { DEFAULT_POLICIES } from '../../../domain/admin/policy/security-policy.catalog.js';
