import type { MaskingClass } from '../../admin/dao/policy.dao.js';

/** 정규식 및 NER 분석에서 지원하는 마스킹 콘텐츠 코드입니다. */
export const MASKING_CONTENT = {
  PHONE: 'PHONE',
  RESIDENT: 'RESIDENT',
  CARD: 'CARD',
  EMAIL: 'EMAIL',
  API_KEY: 'API_KEY',
} as const;

export type MaskingContent =
  (typeof MASKING_CONTENT)[keyof typeof MASKING_CONTENT];

/** 부서 정책 중 게이트웨이가 실제로 탐지할 수 있는 정책입니다. */
export interface DepartmentMaskingPolicy {
  readonly departmentPolicyId: string;
  readonly maskingContent: MaskingContent;
  readonly maskingClass: MaskingClass;
}

const KNOWN_MASKING_CONTENTS = new Set<string>(
  Object.values(MASKING_CONTENT),
);

export function normalizeMaskingContent(
  value: string,
): MaskingContent | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');

  return KNOWN_MASKING_CONTENTS.has(normalized)
    ? normalized as MaskingContent
    : null;
}
