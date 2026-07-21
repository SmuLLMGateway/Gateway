/**
 * Repository 등 데이터 계층에서 조회한 오프셋 페이지 데이터입니다.
 * 응답 전용 값인 dataCnt는 Mapper가 실제 data 길이로 계산합니다.
 */
export interface OffsetPageData<T> {
  data: readonly T[];
  totalCnt: number;
  filteringCnt: number | null;
  pageNumber: number;
}
