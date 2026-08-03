# API v3 런타임 검증 보고서

검증일: 2026-08-03 (Asia/Seoul)  
대상: `http://localhost:3000`  
명세 검토 결과: [API_v3_business_logic_review.md](./API_v3_business_logic_review.md)  
방식: 애플리케이션 코드는 열람하지 않고, 제공된 세 역할 계정과 실제 HTTP 응답만 사용한 블랙박스 검증

## 1. 범위와 판정 기준

- 제공 계정: 총 관리자, 부서 관리자, 일반 사용자
- 추가 계정: 권한 경계와 계정 상태 전이를 확인하기 위한 임시 일반 사용자 5개
- 안전 원칙: 외부 LLM 호출, 실제 API 키 변경, 정책 변경, 마지막 총 관리자 비활성화처럼 비용이나 공유 상태에 큰 영향을 주는 요청은 수행하지 않았다.
- NER 조건: 웹 서버는 기동됐지만 실제 탐지 모델은 동작하지 않는 환경이라는 전제에서 실패 상태 전이만 확인했다.
- 응답 기록에는 access/refresh token, API 키, 서명 URL 원문을 남기지 않았다.

판정은 다음과 같다.

- **CONFIRMED**: 예상한 허점이 실제 응답으로 재현됨
- **DEFENDED**: 명세상 불명확하거나 누락됐지만 현재 구현은 방어함
- **PARTIAL**: 일부 증거는 있으나 숨은 임계값이나 운영 조건 때문에 단정할 수 없음
- **INCONCLUSIVE**: 단일 인스턴스 블랙박스 요청만으로 판단 불가
- **NOT TESTED**: 비용, 데이터 파괴, 공유 설정 변경 위험 때문에 실행하지 않음

## 2. 결론 요약

출시 전 우선 수정해야 할 실제 재현 항목은 다음 6개다.

1. **부서 관리자의 전사 관리자 조회 권한 우회**: 타 부서 상세와 전사 대시보드가 `200`으로 반환됐다.
2. **부서 API 키 원문 응답**: 마스킹되지 않은 GPT API 키 전체가 문자열로 반환됐고 캐시 방지 헤더도 없었다.
3. **토큰 갱신 흐름의 자기모순**: 유효한 refresh token만으로는 갱신할 수 없고 유효한 access token도 요구했다.
4. **보안 이벤트 뒤 세션 잔존**: 로그아웃 뒤 access token이 계속 유효했고, 비밀번호 변경 뒤 기존 access/refresh도 유지됐다.
5. **복구 시 폐기 전 access token 부활**: 비활성화로 막힌 기존 access token이 계정 복구 뒤 다시 사용할 수 있었다.
6. **메시지 검색/필터 미적용**: 문서화된 `orderBy`, `query`, 상호배타 조건이 실제 결과에 적용되지 않았다.

반대로 프롬프트 핵심 IDOR, refresh token 재사용, 비활성 계정 접근, 파일의 임의 URL 조회는 현재 구현에서 방어됐다. 명세 보완과 구현 취약점은 구분해서 다뤄야 한다.

## 3. 재현된 허점

| ID | 우선순위 | API/영역 | 실제 관찰 | 판정 |
|---|---|---|---|---|
| R-01 | P0 | `POST /auth/v1/token` | refresh body만 보내면 `401 AUTH401_1`; 유효한 access+refresh일 때만 `200` | CONFIRMED |
| R-02 | P0 | `POST /auth/v1/logout` | 로그아웃은 `200`, 같은 access로 `/api/v1/users/me`는 계속 `200`; refresh만 폐기됨 | CONFIRMED |
| R-03 | P0 | `PATCH /auth/v1/password` | 변경 뒤 기존 access가 유효하고, 변경 전 refresh로 새 토큰 발급 가능 | CONFIRMED |
| R-04 | P0 | 사용자 비활성화/복구 | 비활성화 전 access는 비활성 중 차단되지만 복구 후 다시 `200`; refresh는 부활하지 않음 | CONFIRMED |
| R-05 | P0 | 부서 관리자 읽기 권한 | `DEPART_ADMIN`이 전사 dashboard, logs, policies, health, 모든 부서 목록/상세 등을 `200`으로 조회 | CONFIRMED |
| R-06 | P0 | `GET /admin/v1/departments/me/api-key` | 부서 관리자에게 `apiKey` 전체 문자열 반환; `Cache-Control`, `Pragma`, `Expires` 없음 | CONFIRMED |
| R-07 | P1 | 로그인 보호 | 존재하지 않는 계정으로 15회 연속 실패해도 모두 `400`, `429`와 점진 지연 없음 | PARTIAL |
| R-08 | P1 | 비밀번호 정책 | 기존 비밀번호와 동일한 새 비밀번호를 보내도 `200` | CONFIRMED |
| R-09 | P1 | `POST /api/v1/analyze` | 동일 ticket과 동일 payload 재시도는 기존 결과가 아니라 `400 PROM400_2` | CONFIRMED |
| R-10 | P1 | 분석 취소 상태 | 실패 ticket 취소는 `200 PROM200_11`, 이후 상태 조회는 계속 `503 PROM503_1` | CONFIRMED |
| R-11 | P1 | 채팅방/이력 | 제목과 request/summary에 전화번호처럼 보이는 원문 문자열이 그대로 반환됨 | CONFIRMED |
| R-12 | P1 | `GET /api/v1/messages` | `orderBy=gpt`, `orderBy=local`, 임의 `query`가 모두 같은 전체 결과를 반환; 둘을 함께 보내도 `200` | CONFIRMED |
| R-13 | P1 | 부서 사용자 연동 | `[연동 가능, 이미 소속, 미존재]` 혼합 요청이 `201`; 성공 항목만 반환하고 탈락 사유 없음 | CONFIRMED |
| R-14 | P1 | 미소속 사용자 관리 | 총 관리자가 만든 미소속 활성 사용자는 목록에 보이나 비활성화가 `404`; 부서 연결 후에야 가능 | CONFIRMED |
| R-15 | P1 | 관리자 prompt 목록/상세 | 사용자 prompt 목록이 반환한 ID를 상세 API에 넣어도 `404 PROM404_2` | CONFIRMED |
| R-16 | P1 | 관리자 집계 | dashboard/summary API의 `updatedAt`이 각각 달랐고, 같은 `localRate`가 화면별로 다른 의미를 가짐 | CONFIRMED |
| R-17 | P2 | 빈 목록 계약 | 사용자 채팅방/메시지와 관리자 검색 무결과가 page 또는 `[]`가 아니라 `result:null` | CONFIRMED |
| R-18 | P2 | 사용자 메시지 페이지 | `pageSize=0&pageNumber=0`을 거절하지 않고 기본값처럼 처리해 `200` | CONFIRMED |
| R-19 | P2 | 위험 분포 오류 | 잘못된 `recent`에 부서 목록용 `ADMIN400_11`과 잘못된 메시지를 재사용 | CONFIRMED |
| R-20 | P2 | `/admin/v1/users-prompts` | query를 생략하면 `400 ADMIN400_10`; 명세에 해당 400 오류 계약이 없음 | CONFIRMED |
| R-21 | P2 | 파일 다운로드 | 소유자는 `200`, 타 사용자는 `403`, 임의 URL은 `404`; 상태 차이로 object 존재 여부 구분 가능 | CONFIRMED |
| R-22 | P2 | 관리자 역할 범위 | 같은 부서 관리자가 타 사용자 상세은 `404`지만 타 부서 상세/전사 집계는 `200`으로 권한 기준이 일관되지 않음 | CONFIRMED |

### R-01 토큰 갱신 교착

`POST /auth/v1/token`에 유효한 refresh token을 body로 보내고 access header를 생략하면 `401 AUTH401_1`이었다. 유효한 access와 refresh를 함께 보냈을 때만 새 access/refresh가 발급됐다. 따라서 access 만료가 실제 갱신 사유인 정상 흐름에서 갱신 API를 사용할 수 없다.

권장 수정은 refresh token만 인증 재료로 받고, access header는 요구하지 않는 것이다. refresh 회전은 `(familyId, jti)` 단위 원자적 단일 사용으로 유지한다.

### R-02~R-04 세션 수명주기

- 로그아웃 후 refresh 재사용은 `401`로 차단됐지만 같은 access는 보호 API에서 계속 `200`이었다.
- 비밀번호 변경 뒤 변경 전 access와 refresh가 모두 살아 있었다.
- 계정 비활성화 중에는 access/refresh/login 모두 차단됐다.
- 계정을 복구하자 비활성화 전에 발급한 access가 다시 살아났다.

계정에 `tokenVersion` 또는 `credentialsChangedAt`을 두고 로그아웃, 비밀번호 변경, 비활성화 시 세션 family를 폐기해야 한다. 복구는 계정 상태만 바꾸고 과거 token version을 되돌리면 안 된다.

### R-05~R-06 관리자 권한과 비밀 노출

제공된 부서 관리자 계정으로 다음 읽기 요청이 `200`이었다.

- 전사 운영 dashboard
- 자기 부서가 아닌 `departmentId=7` 상세
- 전사 logs, policies, health, LLM health, user/department summary 계열
- 다른 부서 사용자 prompt 목록(별도 부서 관리자 계정으로 내용 있는 사용자에 대해 재현)

반면 타 사용자 상세은 `404`여서 엔드포인트마다 scope 구현이 다르다. 최상위 명세대로 관리자 API가 총 관리자 전용이라면 명백한 역할 우회다. 부서 관리자에게 일부 조회를 허용할 의도라면 역할 매트릭스를 API별로 명시하고 모든 조회를 해당 `departmentId`로 제한해야 한다.

API 키 조회는 응답 객체에 `service`, `apiKey`가 있었고 `apiKey`는 전체 문자열이었다. 실제 값은 보고서에 기록하지 않았다. 저장 후 재조회는 fingerprint와 마지막 4자리만 제공하고, 원문 재열람이 꼭 필요하면 재인증, 사유, 감사 이벤트, `Cache-Control: no-store`를 요구해야 한다.

### R-09~R-10 분석 상태 머신

컨테이너 기동 뒤 무해한 새 ticket을 보낸 결과는 다음과 같다.

1. 접수: `200 PROM200_1`
2. 세 차례 상태 조회: 모두 `503 PROM503_1`
3. 취소: `200 PROM200_11`
4. 취소 뒤 상태 조회: 다시 `503 PROM503_1`

NER가 실제 탐지할 수 없는 환경에서 실패 terminal 상태를 반환한 점은 적절하다. 문제는 취소 성공 응답이 상태에 반영되지 않는다는 것이다. 실패 job 취소를 거절하거나, 멱등 성공을 반환하되 현재 terminal 상태를 함께 반환해야 한다.

### R-12 메시지 검색/필터

기존 메시지 2건을 기준으로 다음 요청이 모두 같은 2건을 반환했다.

- `orderBy=gpt`
- `orderBy=local`
- 일치하지 않는 `query`
- 알려진 전화번호 `query`
- `orderBy`와 `query` 동시 전달

단순 응답 모양 문제가 아니라 사용자가 필터됐다고 믿고 내보내기/감사를 수행할 수 있는 기능 오류다. 필터를 실제 적용하고 상호배타가 의도라면 동시 입력을 `400`으로 거절해야 한다.

### R-14 미소속 사용자 고립

총 관리자가 생성한 미소속 활성 사용자는 사용자 목록에는 나타났지만 `DELETE /admin/v1/users/{id}`가 `404 AUTH404_1`이었다. 같은 사용자를 부서에 연결한 직후에는 비활성화가 `200`이었다. 조회/비활성화 쿼리가 부서 relation을 전제하는 것으로 보이지만 이는 런타임 관찰에 따른 추론이다.

미소속 상태를 허용한다면 상세, 비활성화, 복구가 모두 가능해야 한다. 허용하지 않는다면 사용자 생성 자체를 원자적으로 부서 연결과 묶어야 한다.

## 4. 구현에서 방어된 항목

| ID | 검증 항목 | 실제 관찰 | 판정 |
|---|---|---|---|
| D-01 | refresh 회전 | 갱신 전 refresh 재사용은 `401 AUTH401_2` | DEFENDED |
| D-02 | 토큰 종류/형식 | 헤더 없음, malformed token, refresh-as-bearer가 서로 다른 오류로 차단 | DEFENDED |
| D-03 | 비활성 계정 | 비활성화 즉시 기존 access/refresh/login 모두 차단 | DEFENDED |
| D-04 | 멱등 관리 작업 | 반복 logout과 반복 사용자 비활성화가 `200` | DEFENDED |
| D-05 | 채팅방 소유권 | 타 사용자 방의 prompt/recent-analyze와 해당 방을 사용한 analyze가 모두 `404` | DEFENDED |
| D-06 | ticket 소유권 | 타 사용자 ticket의 분석 조회, prompt 조회/전송, 취소가 모두 `404` | DEFENDED |
| D-07 | 파일 임의 접근 | 소유자만 signed URL 발급; 임의 URL은 `404`, 서명 TTL은 600초 | DEFENDED |
| D-08 | 일반 사용자 관리자 접근 | 일반 사용자의 관리자 API 호출은 `403` | DEFENDED |
| D-09 | 부서 관리자 변경 권한 | 부서/부서 관리자 생성, 타 사용자 연동, API 키 등록 시도는 `403` | DEFENDED |
| D-10 | 부서 관리자 USER 생성 | 일반 사용자만 생성 가능하고 생성자는 자기 부서에 자동 배정 | DEFENDED |
| D-11 | 관리자 입력 검증 | 사용자/부서 목록의 0 page, 충돌 query, 잘못된 order 값은 `400` | DEFENDED |
| D-12 | LLM health 응답 | 단일 객체가 아니라 여러 서비스의 배열을 반환해 명세 모순을 구현에서 해소 | DEFENDED |
| D-13 | 분석 실패 terminal | 탐지 불가 시 영구 pending이 아니라 `503 PROM503_1`로 수렴 | DEFENDED |
| D-14 | 서명 URL | 발급된 URL은 인증 없이 다운로드되지만 600초 만료와 객체 범위 서명이 적용 | DEFENDED |

주의할 점은 D-07도 완전 방어는 아니라는 것이다. 타 소유자의 실제 file URL은 `403`, 존재하지 않는 값은 `404`라 존재 oracle은 R-21로 남는다. SSRF는 재현되지 않았다.

## 5. 명세와 구현이 함께 보완돼야 하는 항목

### 5.1 빈 결과와 페이지 계약

- 새 사용자의 채팅방/메시지 목록은 `result:null`이었다.
- 관리자 사용자 검색 무결과도 `result:null`이었다.
- 같은 제품의 다른 목록은 배열 또는 page 객체를 반환한다.
- 사용자 메시지만 0 page를 기본값으로 보정하고 관리자 목록은 `400`으로 거절했다.

목록은 `data:[]`, `pageSize`, `pageNumber`, `totalCnt`를 항상 유지하고 page를 1-base 또는 0-base 중 하나로 고정해야 한다.

### 5.2 관리자 집계

순차 호출한 dashboard, departments-summary, logs-summary, user-summary의 기준 시각이 각각 달랐다. 또한 dashboard의 `localRate`는 변화율처럼 보이고 logs-summary의 `localRate`는 `local / filterDetect` 비율처럼 나타났다. 정확한 내부 공식은 코드 미열람 조건 때문에 확정하지 않았지만, 한 화면에서 공통 `snapshotId`, `windowStart`, `windowEnd`, 분모, 단위를 반환해야 한다.

### 5.3 모델 가용성

NER 웹 서버 기동 뒤 부서 3 일반 사용자 모델 목록에는 외부 모델 7개만 있었고 local 모델은 없었다. 앞선 검증에서 부서 4 상세에는 Local LLM 사용 가능으로 표시됐지만 부서 4 사용자의 모델 목록은 비어 있었다. NER가 모델을 실제 제공하지 않는 현재 환경에서는 일부가 운영 조건에 따른 정상 동작일 수 있으므로, 최종 결함 판정은 **PARTIAL**이다. 관리 화면의 설정값과 실제 가용성은 분리해서 표시해야 한다.

## 6. 미검증 또는 단정 불가 항목

다음은 명세상 보완 필요성이 있지만 이번 블랙박스 검증으로 실제 취약 동작을 확정하지 않았다.

| 항목 | 판정 | 이유 |
|---|---|---|
| 같은 순간의 token refresh 경쟁 | INCONCLUSIVE | 동시성/원자성 부하 테스트 필요 |
| quota 예약, 초과, 실패 환불, 월 경계 | NOT TESTED | 실제 공급자 비용과 공유 한도 변경 위험 |
| LLM 전송 중복과 원문/마스킹 payload | NOT TESTED | 외부 공급자 호출 및 비용 발생 가능 |
| API 키 등록/회전/폐기/암호화 저장 | NOT TESTED | 실제 비밀과 공유 설정 변경 위험 |
| 전사/부서 정책 수정의 상속과 snapshot | NOT TESTED | 운영 정책 변경 위험 |
| 마지막 총 관리자/자기 자신 비활성화 | NOT TESTED | 관리자 접근 상실 위험 |
| file URL 기반 SSRF | INCONCLUSIVE | 임의 URL은 `404`; 서버 dereference 증거 없음 |
| raw file URL 직접 공개 여부 | INCONCLUSIVE | `/download`는 signed URL을 사용하지만 다른 응답 URL의 저장소 정책 미확정 |
| timestamp cursor의 같은 ms 누락 | INCONCLUSIVE | 동일 시각 다건 생성과 안정적인 재현 필요 |
| `recentTicket`의 타 사용자 직접 참조 | NOT TESTED | 다른 사용자의 민감 분석 결과를 연결하는 요청은 수행하지 않음 |
| 부서/사용자 생성 동시성, 중복 관리자 배정 | INCONCLUSIVE | 병렬 mutation 테스트 필요 |
| 집계의 정확한 수식과 삭제 데이터 포함 여부 | INCONCLUSIVE | 외부 기준 원장과 기간별 데이터 필요 |

## 7. 권장 수정 순서

1. **즉시**: 부서 관리자 접근을 공통 authorization policy로 묶고 모든 관리자 조회에 role+department scope를 적용한다.
2. **즉시**: API 키 원문 조회를 제거하고 캐시 금지, 감사, 재인증을 추가한다.
3. **즉시**: refresh-only 갱신으로 바꾸고 password/logout/disable/restore에 단조 증가하는 token version을 적용한다.
4. **다음**: 메시지 검색/필터를 실제 적용하고 프롬프트 목록→상세 연결을 회귀 테스트로 고정한다.
5. **다음**: 분석 job의 FAILED/CANCELLED 전이와 취소 응답을 일치시키고 동일 ticket 재시도는 기존 job을 반환한다.
6. **다음**: 미소속 사용자 수명주기, 부서 연동 부분 성공 결과, 빈 목록/page/error 계약을 통일한다.

## 8. 테스트 데이터 정리

- 검증 중 생성한 일반 사용자 5개는 최종 목록 조회에서 모두 `비활성`으로 확인했다.
- 미소속 사용자 1개는 직접 비활성화가 `404`여서 테스트 부서 연결 후 비활성화했다.
- 컨테이너 기동 뒤 생성한 분석 ticket은 취소 요청을 보냈다. 취소 뒤 조회가 여전히 `503`인 상태 불일치는 R-10에 기록했다.
- 분석 요청으로 만들어진 테스트 채팅방 메타데이터는 삭제/archive API가 없어 일반 사용자 계정에 남을 수 있다. DB 직접 삭제는 수행하지 않았다.
- 실제 API 키, 토큰, presigned URL은 파일에 기록하지 않았다.
