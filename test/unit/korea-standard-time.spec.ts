import {
  toKoreaStandardTimeDateString,
  toKoreaStandardTimeISOString,
} from '../../src/global/time/korea-standard-time.js';

describe('KST 응답 시각 변환', () => {
  it('UTC 시각을 UTC+09:00 ISO 8601 문자열로 변환한다', () => {
    expect(toKoreaStandardTimeISOString(
      new Date('2026-08-03T08:44:35.000Z'),
    )).toBe('2026-08-03T17:44:35.000+09:00');
  });

  it('날짜 경계를 넘는 UTC 시각도 한국 날짜로 변환한다', () => {
    expect(toKoreaStandardTimeDateString(
      new Date('2026-08-03T18:00:00.000Z'),
    )).toBe('2026-08-04');
  });
});
