const KOREA_STANDARD_TIME_OFFSET_MS = 9 * 60 * 60 * 1_000;

/**
 * UTC로 저장한 시각을 한국 표준시(KST, UTC+09:00) ISO 8601 문자열로 표현합니다.
 * 저장된 절대 시각은 변경하지 않고 API 응답 표현만 변환합니다.
 */
export function toKoreaStandardTimeISOString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value instanceof Date ? '' : value;
  }

  return new Date(date.getTime() + KOREA_STANDARD_TIME_OFFSET_MS)
    .toISOString()
    .replace('Z', '+09:00');
}

export function toKoreaStandardTimeDateString(value: Date | string): string {
  return toKoreaStandardTimeISOString(value).slice(0, 10);
}
