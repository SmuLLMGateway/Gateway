/**
 * 시스템이 제공하는 전역 보안 정책 카탈로그입니다.
 *
 * 부서별 활성화 여부는 `department_policy`에서 관리합니다. 이 목록은 정책
 * 마스터(`policy`)의 초기 데이터와 요청값의 분류 검증에만 사용합니다.
 */
export const SECURITY_POLICY_CONTENTS = [
  'SECURITY_INFRA',
  'OPERATION',
  'STATE_SECRET',
  'CONTRACT',
  'PERSONAL',
  'CITIZEN',
  'AUDIT',
  'INFO_SYSTEM_ACCESS_LOG',
  'R&D',
  'RESIDENT',
  'PHONE',
  'EMAIL',
  'ACCOUNT',
  'CARD',
  'ADDRESS',
  'API_KEY',
] as const;

export type SecurityPolicyContent =
  (typeof SECURITY_POLICY_CONTENTS)[number];

export type SecurityPolicyClass = 'SENSITIVE' | 'PRIVATE';

export interface SecurityPolicyDefinition {
  readonly maskingContent: SecurityPolicyContent;
  readonly maskingClass: SecurityPolicyClass;
}

/** API 응답에서 사용하는 정책 항목의 한글 표시명입니다. */
export const SECURITY_POLICY_DISPLAY_NAMES: Readonly<
  Record<SecurityPolicyContent, string>
> = Object.freeze({
  SECURITY_INFRA: '보안 인프라 정보',
  OPERATION: '행정 운영 정보',
  STATE_SECRET: '국가기밀 수준 정보',
  CONTRACT: '조달 및 계약 정보',
  PERSONAL: '인사·인력 운영 정보',
  CITIZEN: '시민 데이터 취합 결과',
  AUDIT: '감사·수사·징계 정보',
  INFO_SYSTEM_ACCESS_LOG: '정보시스템 접근 로그',
  'R&D': 'R&D 및 기술 정보',
  RESIDENT: '주민등록번호',
  PHONE: '전화번호',
  EMAIL: '이메일',
  ACCOUNT: '계좌번호',
  CARD: '카드번호',
  ADDRESS: '주소 정보',
  API_KEY: 'API 키',
});

/** 프로젝트 시작 시 누락된 항목만 추가하는 전역 정책 마스터 데이터입니다. */
export const DEFAULT_POLICIES = [
  { maskingContent: 'SECURITY_INFRA', maskingClass: 'SENSITIVE' },
  { maskingContent: 'OPERATION', maskingClass: 'SENSITIVE' },
  { maskingContent: 'STATE_SECRET', maskingClass: 'SENSITIVE' },
  { maskingContent: 'CONTRACT', maskingClass: 'SENSITIVE' },
  { maskingContent: 'PERSONAL', maskingClass: 'SENSITIVE' },
  { maskingContent: 'CITIZEN', maskingClass: 'SENSITIVE' },
  { maskingContent: 'AUDIT', maskingClass: 'SENSITIVE' },
  {
    maskingContent: 'INFO_SYSTEM_ACCESS_LOG',
    maskingClass: 'SENSITIVE',
  },
  { maskingContent: 'R&D', maskingClass: 'SENSITIVE' },
  { maskingContent: 'RESIDENT', maskingClass: 'PRIVATE' },
  { maskingContent: 'PHONE', maskingClass: 'PRIVATE' },
  { maskingContent: 'EMAIL', maskingClass: 'PRIVATE' },
  { maskingContent: 'ACCOUNT', maskingClass: 'PRIVATE' },
  { maskingContent: 'CARD', maskingClass: 'PRIVATE' },
  { maskingContent: 'ADDRESS', maskingClass: 'PRIVATE' },
  { maskingContent: 'API_KEY', maskingClass: 'PRIVATE' },
] as const satisfies readonly SecurityPolicyDefinition[];

const SECURITY_POLICY_CONTENT_SET = new Set<string>(SECURITY_POLICY_CONTENTS);

/** 대소문자와 공백/하이픈 표기 차이를 정규화한 보안 정책 코드입니다. */
export function normalizeSecurityPolicyContent(
  value: string,
): SecurityPolicyContent | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');

  return SECURITY_POLICY_CONTENT_SET.has(normalized)
    ? normalized as SecurityPolicyContent
    : null;
}

/** 해당 정책 코드에 고정된 보안 등급을 반환합니다. */
export function getDefaultPolicy(
  maskingContent: SecurityPolicyContent,
): SecurityPolicyDefinition {
  const policy = DEFAULT_POLICIES.find(
    (candidate) => candidate.maskingContent === maskingContent,
  );

  if (policy === undefined) {
    throw new Error(`알 수 없는 보안 정책 코드입니다: ${maskingContent}`);
  }

  return policy;
}

/** 정책 목록·상세 응답에서 사용하는 한글 정책명입니다. */
export function getSecurityPolicyDisplayName(value: string): string {
  const normalized = normalizeSecurityPolicyContent(value);
  return normalized === null ? value : SECURITY_POLICY_DISPLAY_NAMES[normalized];
}

/** 정책 목록·상세 응답에서 사용하는 한글 등급명입니다. */
export function getSecurityPolicyClassDisplayName(value: string): string {
  switch (value) {
    case 'SENSITIVE':
      return '민감 정보';
    case 'PRIVATE':
      return '개인 정보';
    default:
      return value;
  }
}

/** 정책별 감지 통계와 마스킹 결과에서 사용하는 압축 한글 등급명입니다. */
export function getMaskingCategoryDisplayName(value: string): string {
  switch (value) {
    case 'SENSITIVE':
      return '민감정보';
    case 'PRIVATE':
      return '개인정보';
    default:
      return value;
  }
}
