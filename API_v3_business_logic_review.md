# API v3 비즈니스 로직 허점 검토

검토 기준일: 2026-08-03  
검토 원본: [API 명세서 v3](https://app.notion.com/p/3a260c1ed8eb80cc8b14ef5691a6b481)  
검토 범위: 인증 4개, 프롬프트 10개, 마이페이지 4개, 관리자 26개, 총 44개 API  
제외: `사용자 정보 수정 (화면 미결정)`, `사용자 일괄 생성 (기획단계)`  
검토 방식: 코드나 구현은 보지 않고 URI, 요청, 정상 응답, 오류 응답 및 API 간 흐름만 검토했다.

## 우선순위 기준

- **P0**: 권한 우회, 민감정보 유출, 외부 LLM 원문 전송, 중복 과금, 계정 탈취처럼 출시 전에 반드시 막아야 하는 문제
- **P1**: 상태/집계/동시성 오류로 실제 데이터가 틀리거나 정상 업무가 막힐 수 있는 문제
- **P2**: 응답 계약, 식별자, 빈 결과 등 클라이언트별 해석이 갈릴 수 있는 문제

## 결론 요약

1. **프롬프트 리소스의 소유권 계약이 빠져 있다.** `ticket`, `chatRoomId`, `recentTicket`을 클라이언트가 만들거나 전달하지만, 분석 조회·LLM 전송/조회·방별 이력 조회에는 요청자/조직 일치 오류가 없다. UUID의 난수성은 인가가 아니다.
2. **민감정보 보호 API가 오히려 원문과 비밀을 넓게 반환한다.** 분석 결과와 관리자 프롬프트 상세가 `originText/targetText/originalText`를, 여러 이력 API가 `fileUrl`을, 부서 API 키 조회가 원문 `apiKey`를 반환한다.
3. **비동기 상태 머신이 없다.** 분석과 LLM 생성은 진행 중/완료만 있어 실패·취소·만료·재시도 가능 상태를 표현하지 못한다. 사용자는 영구 폴링할 수 있고 취소와 전송이 경합할 수 있다.
4. **멱등 성공 계약과 과금 원자성이 없다.** 같은 분석 ticket은 중복 작업을 막지만 기존 job을 반환하지 않아 안전한 네트워크 재시도가 어렵다. 새 ticket 재발급과 LLM 전송의 동시 요청까지 포함한 중복 방지 범위는 정의되지 않았다.
5. **무엇을 외부 LLM에 보내는지가 계약에 없다.** 분석 응답은 탐지 구간만 주고 `POST /prompt`는 ticket만 받는다. 사용자 선택 또는 서버 정책으로 어떤 구간/파일을 마스킹하는지, 원본 대신 어떤 불변 산출물을 전송하는지 결정할 단계가 없다.
6. **세션 폐기 모델이 없다.** 토큰 회전·재사용 탐지, 로그아웃 범위, 비밀번호 변경·계정 비활성화 후 기존 access/refresh token 무효화가 빠져 있다.
7. **사용량 한도는 조회/생성 필드만 있고 집행 규칙이 없다.** 분석·LLM 전송 시 잔액 예약, 동시 요청, 공급자 실패 환불, 정산 기간·통화·무제한의 의미가 없다.
8. **전사 정책 preset과 부서 정책의 관계가 불명확하다.** optional field 조합으로 새 preset 생성과 기존 preset 선택을 구분하지만, 동일 이름 충돌·수정 가능 여부와 상속·우선순위·버전·적용 시점·진행 중 요청의 snapshot이 없다.
9. **관리자 변경 작업의 핵심 불변조건이 없다.** 마지막 총관리자/자기 자신 비활성화, 부서 관리자 중복 배정, 부서 정원 초과, 사용자 이동·연동 해제, 비활성 부서 복구 같은 규칙이 누락됐다.
10. **대시보드 수치에 공통 사전이 없다.** 기간, 분모, 시간대, 반올림, 처리 상태, 삭제 데이터 포함 여부와 snapshot이 달라 한 화면의 숫자가 서로 모순될 수 있다.

## API 간 명세 모순

- `POST /auth/v1/token`은 DB 행에서 토큰 필수이면서 body에 refresh token을 받는다. access token까지 필수라면 access 만료 후 갱신할 수 없다.
- `POST /admin/v1/users`는 부서 관리자가 USER를 생성할 수 있고 `부서 없음` 오류도 정의하지만 요청에 `departmentId`가 없다. 새 사용자를 어느 부서에 둘지 결정할 수 없다.
- `POST /api/v1/prompt`의 `티켓 중복`이 분석 ticket 중복인지, 이미 LLM 전송된 ticket의 재전송인지 범위가 불명확하다.
- 관리자 API는 모두 TOTAL_ADMIN 전용이라고 했지만 `GET /admin/v1/departments/me/api-key`는 어느 부서의 `me`인지 알 수 없다.
- `GET /admin/v1/llms/health`는 모델/서비스 선택 입력이 없는데 응답은 단일 service 객체다.
- 사용량 `usage/limit` 예시가 API에 따라 `12.4/200`과 `12400/200000`처럼 1000배 차이가 나며 단위가 없다.
- `GET /api/v1/messages`와 `GET /admin/v1/users`의 `orderBy`는 정렬과 필터가 섞여 있다. 검색과 상호배타여서 검색 결과 정렬도 할 수 없다.
- 목록이 없을 때 어떤 API는 `result:null`, 어떤 API는 배열/페이지 객체를 반환한다. 정상 빈 상태와 데이터 미생성을 구분할 수 없다.

## 명세 범위에서 보이지 않는 수명주기 작업

- 부서는 생성/조회만 있고 이름·code·한도·local LLM·mustFiltering 수정, 비활성화·복구·폐기 작업이 없다. 상세 응답의 `isActive`를 어떤 업무가 바꾸는지 알 수 없다.
- 사용자는 부서에 연결할 수 있지만 연결 해제와 부서 이동이 없다. 인사 이동 때 과거 이력·정책·quota 귀속을 처리할 수 없다.
- 외부 LLM 키는 등록/조회만 있고 명시적 rotate/revoke/delete가 없다. 유출 대응과 provider 변경의 원자적 절차가 없다.
- 분석은 취소할 수 있지만 외부 LLM 생성 job은 취소할 수 없다. 고비용·장시간 요청을 접수 뒤 중단할 방법이 없다.
- 채팅방/프롬프트/업로드 파일의 archive/delete와 개인정보 삭제 요청 처리 API가 없다. 보존 만료 또는 계정 비활성화 뒤 데이터 수명주기를 실행할 수 없다.
- 관리자가 만든 초기 비밀번호를 사용자가 잊거나 노출됐을 때 쓸 관리자 reset/일회용 초대·복구 절차가 없다. 현재 self-service 변경은 old password를 요구한다.

## 공통 계약 보완

- 모든 리소스 조회 조건을 `(tenantId, ownerId, resourceId)`로 고정하고 타 조직/타 사용자와 미존재는 동일한 404로 처리한다. 싱글테넌트 제품이면 그 전제를 명시한다.
- access/refresh token의 `iss/aud/typ/jti/sid`, 절대·유휴 만료, 최신 계정/역할 확인, 회전·재사용 탐지 및 token family 폐기를 공통 인증 규칙으로 둔다.
- 비동기 작업은 명시적 상태, 허용 전이, terminal failure, `retryable`, `failureCode`, `acceptedAt/completedAt/expiresAt`, `Retry-After`를 제공한다.
- POST는 `Idempotency-Key` 또는 ticket+payload hash로 동일 재시도를 기존 결과에 연결하고, 같은 키에 다른 payload만 409로 처리한다.
- 필수 detector 중 하나라도 실패하거나 결과가 불완전하면 `mustFiltering` 부서는 fail-closed로 외부 전송을 막는다. local fallback과 부분 성공 허용 여부도 정책으로 고정한다.
- quota는 접수 시 예상액 예약, provider 호출 뒤 확정, 실패/취소 시 해제하는 원장을 사용하고 동시 요청·월 경계·환율·세금·무제한 값의 규칙을 정의한다.
- 원문, API 키, 파일 URL, 토큰은 응답·로그·APM·분석도구에서 제거하거나 마스킹하고 민감 응답에 `Cache-Control: no-store`를 적용한다.
- ticket, 원문, masked artifact, 업로드 파일, provider 요청/응답의 보존기간과 사용자/방/계정 삭제 시 cascade 또는 법적 보존 예외를 정의한다.
- HTTP status와 `AUTH200_1` 같은 업무 코드를 분리한다. 400, 401, 403/opaque 404, 409, 413, 415, 429, 502/503, 504와 재시도 가능 여부를 공통 정의한다.
- 시각은 RFC 3339 UTC로 통일하고 집계에는 `windowStart/windowEnd/timezone/asOf/snapshotId`를 반환한다.
- 목록은 항상 `data:[]`를 유지하고 기본/최대 page size, 안정 정렬, tie-breaker, snapshot 또는 opaque cursor를 정의한다.
- enum과 식별은 표시 문자열이 아니라 안정적인 ID/code를 쓰며 표시명은 별도 필드로 둔다.
- 관리자 변경은 모두 `actorId`, 변경 전/후, 대상, 결과, 사유, `requestId`가 있는 불변 감사 이벤트를 남긴다.

---

## 1. 인증 API

### 1.1 로그인 - `POST /auth/v1/login`

- **P0** 로그인 실패 제한, 점진 지연, IP+계정 단위 rate limit과 `429/Retry-After`가 없다. 크리덴셜 스터핑 방어와 성공/실패 감사 규칙을 추가한다.
- **P1** 비활성 계정 오류를 언제 판정하는지 없다. 자격증명 확인 전에 반환하면 이메일 존재 여부를 열거할 수 있으므로 외부 오류 통일 또는 판정 순서를 명시한다.
- **P1** 반복 로그인 때 기존 refresh 세션 유지 여부, 동시 기기 수, 세션 식별자와 강제 종료 범위가 없다. `sid/jti`, 절대/유휴 TTL, 동시 세션 정책을 둔다.
- **P1** 관리자 생성 비밀번호의 첫 로그인 강제 변경, 잠김/비밀번호 만료/미소속 계정 로그인 허용 여부가 없다.
- **P2** `accessTokenExpiredAt` 또는 `expiresIn`, `tokenType`이 없고 이메일 trim·대소문자·길이 규칙도 없다.

### 1.2 로그아웃 - `POST /auth/v1/logout`

- **P0** body 없이 access token만 받는 구조라 어느 refresh 세션을 폐기하는지 알 수 없다. access의 `sid`로 현재 token family를 찾거나 refresh credential을 받아 범위를 명시한다.
- **P0** access token이 만료되면 로그아웃 자체가 거절되어 살아 있는 refresh token을 끊지 못할 수 있다.
- **P0** refresh만 폐기하는지 기존 access도 즉시 막는지 불명확하다. 효력 시점과 blocklist/token-version 정책을 정의한다.
- **P1** 이미 로그아웃된 세션의 반복 요청은 멱등 성공으로 처리하고 `현재 기기`와 `전체 기기` 종료를 구분한다.

### 1.3 사용자 비밀번호 수정 - `PATCH /auth/v1/password`

- **P0** 최소·최대 길이, 흔한/유출 비밀번호 차단, 기존/최근 비밀번호 재사용 금지 등 새 비밀번호 정책이 없다.
- **P0** 변경 후 기존 access/refresh 세션 폐기와 현재 세션 유지 여부가 없다. 탈취 세션이 계속 유효할 수 있다.
- **P1** 같은 old password로 두 변경 요청이 경합할 수 있다. 기존 credential version을 조건으로 원자적으로 한 요청만 성공시킨다.
- **P1** old password 실패 rate limit, 비활성 계정 처리, 보안 알림/감사 규칙이 없다.
- **P2** `AUTH400_1 이메일 혹은 비밀번호 오류`는 이 요청에 이메일이 없어 부정확하다. old-password mismatch, policy violation, reuse를 분리한다.

### 1.4 토큰 갱신 - `POST /auth/v1/token`

- **P0** access token도 필수인지 불명확하다. refresh credential만으로 동작하며 access header는 선택임을 명시해야 한다.
- **P0** 새 refresh를 반환하면서 기존 토큰 1회 사용, 원자적 회전, 재사용 탐지와 family 전체 폐기 규칙이 없다.
- **P0** 여러 탭이 동시에 갱신할 때 복수 발급 또는 정상 사용자의 오탐 폐기가 발생할 수 있다. 단일 승자와 짧은 grace/idempotency 정책을 정한다.
- **P0** 비활성화·비밀번호 변경·권한 변경 후에도 갱신될 수 있다. 매 갱신 시 최신 계정 상태와 token version을 확인하고 claim을 재생성한다.
- **P1** sliding/absolute 만료, 잘못된 token type·서명·폐기·재사용 오류와 갱신 rate limit이 없다.

## 2. 프롬프트 API

### 2.1 마스킹 요소 탐지 요청 - `POST /api/v1/analyze`

- **P0** client-supplied `chatRoomId`가 내 방인지, `recentTicket`이 내 소유이면서 같은 방의 요청인지 규칙이 없다. 타인 방 기록 주입과 revision 연결을 막아야 한다.
- **P1** 같은 분석 ticket을 거절해 중복 작업은 막지만, 타임아웃 재시도에 기존 job을 반환하지 않는다. 동일 owner+payload hash면 기존 job을 반환하고 다른 payload만 409로 처리한다. 새 ticket 재발급을 통한 의미상 중복의 처리도 정의한다.
- **P1** `recentTicket`이 단순 존재만 하면 stale revision으로 분기/롤백할 수 있다. 최신 성공 revision과 CAS하고 충돌 시 current revision을 반환한다.
- **P1** 표시명 `model` 대신 안정적인 model ID를 받고 접수와 실제 전송 때 부서 권한·키·상태를 재검증한다.
- **P1** text/file 최소 조건, 길이·개수·bytes/pages/pixels, MIME magic, 암호 PDF, 이미지 폭탄, malware 격리, quota 오류가 없다.
- **P1** 예시로 end-inclusive는 드러나지만 Unicode 정규화, index의 code point/UTF-16/byte 단위, 겹친 탐지 우선순위와 최종 masked artifact 생성 규칙이 없다.
- **P2** 비동기 접수인데 성공 응답에 ticket/status/status URL/만료시각이 없다. 202 응답으로 보완한다.

### 2.2 분석 여부 확인 - `GET /api/v1/analyze`

- **P0** 요청자 검사가 오류 계약에 없어 ticket을 알면 타인의 원문, 민감 `targetText`, 파일 URL을 조회할 수 있다.
- **P1** FAILED/CANCELLED/EXPIRED/TIMED_OUT 상태가 없어 영구 `진행 중`이 된다. 명시적 상태와 실패 이유를 반환한다.
- **P1** 감지 있음/없음의 result schema가 다르다. `detected`, `file:null`, `text:[]`로 고정하고 `recentDetectCnt`의 산정 범위를 정의한다.
- **P1** 일부 detector 결과만 DB에 반영된 순간 성공으로 보이면 안 된다. 모든 detector와 masked artifact가 원자적으로 확정된 뒤 성공 전이한다.
- **P1** 원문과 target text가 응답·브라우저·로그에 남는다. 정말 필요한 owner UI에만 no-store로 제공하고 기본은 masked preview로 둔다.

### 2.3 분석 취소 - `DELETE /api/v1/analyze`

- **P1** 취소 가능한 상태와 완료/LLM 전송과의 경쟁 결과가 없다. QUEUED/ANALYZING에서만 CAS로 CANCEL_REQUESTED/CANCELLED 전이를 허용한다.
- **P1** 반복 취소, 이미 완료된 분석, 이미 취소된 분석의 결과가 없다. 반복 요청은 동일 terminal 상태를 반환하는 멱등 API로 만든다.
- **P1** NER/LLM detector 중단, 이미 든 비용, 임시 파일 정리, 취소 ticket의 후속 전송 금지 범위가 없다.
- **P2** `요청자가 아님`을 400으로 반환하면 의미도 맞지 않고 존재 oracle이 된다. 타인/미존재를 동일 404로 처리한다.

### 2.4 LLM 전송 - `POST /api/v1/prompt`

- **P0** ticket 소유자/조직 확인 오류가 없다. 타인 ticket으로 외부 호출과 비용 발생이 가능하다.
- **P0** 분석 SUCCEEDED, 미취소, 미만료, masked artifact 확정이라는 선행조건이 없다. 한 transaction/CAS에서 검증한 뒤 job을 만든다.
- **P1** `티켓 중복` 오류가 분석 요청 중복인지 이미 전송된 LLM job의 중복인지 범위가 없다. ticket당 LLM job 1개를 unique로 보장하고 동일 재시도는 기존 job을 반환한다.
- **P0** 원문인지 masked text인지, 원본 파일인지 정제된 사본인지 실제 전송 payload가 없다. policy/detector version과 content hash가 붙은 불변 서버 산출물만 전송한다.
- **P0** 분석 결과의 어느 탐지 구간을 마스킹할지 선택하는 입력이 없다. `mustFiltering`에 따른 자동 마스킹과 선택 허용 범위, 사용자가 제외할 수 없는 필수 탐지를 명시하거나 별도 승인 API를 둔다.
- **P1** 분석 뒤 정책·키·모델 상태·quota가 바뀔 수 있다. dispatch 직전에 재검증하고 무단 provider/model fallback은 금지하거나 명시적 동의를 받는다.
- **P1** 응답이 null이라 추적할 job ID가 없다. 202와 `promptJobId/status/statusUrl/acceptedAt`을 반환한다.
- **P2** 이 요청에는 파일 body가 없는데 `지원하지 않는 파일 형식` 오류가 복제돼 있다. artifact invalid/quarantined/expired 오류로 바꾼다.

### 2.5 LLM 결과 확인 - `GET /api/v1/prompt`

- **P0** owner/tenant 검사가 없어 타인 결과를 조회할 수 있다.
- **P1** NOT_REQUESTED/FAILED/CANCELLED/EXPIRED/REFUSED/TRUNCATED가 없어 영구 폴링 또는 실패 오해가 발생한다.
- **P1** LLM이 원문을 재구성하거나 새 민감정보를 생성할 수 있다. 저장·반환 전 egress 검사를 하고 BLOCKED/REVIEW_REQUIRED 상태를 지원한다.
- **P2** 문자열만 반환해 model/version, job ID, 완료시각, usage, finish reason, policy version을 감사하거나 과금 대조할 수 없다.

### 2.6 채팅방 목록 조회 - `GET /api/v1/chat-rooms`

- **P1** `내 채팅방`과 tenant 범위가 계약에 없다. JWT subject 소유 방으로 고정한다.
- **P1** 최근 10개만 반환하고 다음 페이지가 없어 오래된 방은 영구 접근 불가하다. cursor/pageSize를 추가한다.
- **P1** 최근 대화라면서 `createdAt`만 반환한다. `lastActivityAt + chatRoomId`로 안정 정렬한다.
- **P1** 원문/LLM 요약으로 title을 만들면 민감정보가 사이드바에 노출된다. sanitized title 규칙과 길이 제한을 둔다.
- **P2** 분석 실패/취소로 생긴 빈 방의 생성 확정 시점, archived/deleted 포함 여부와 빈 결과 `[]`를 정의한다.

### 2.7 프롬프트 조회 - `GET /api/v1/chat-rooms/{chatRoomId}/prompts`

- **P0** 방 소유권/미존재 오류가 없어 타인의 request, response, 파일 URL이 노출될 수 있다.
- **P0** request가 원문이고 `fileUrl`이 직접 접근 가능하면 다운로드 인가를 우회한다. 기본은 masked request와 opaque file ID만 반환한다.
- **P1** millisecond timestamp 하나로 된 cursor는 같은 시각의 항목을 누락/중복시킨다. `(createdAt,promptId)`가 담긴 opaque cursor와 snapshot을 쓴다.
- **P1** item에 promptId/ticket/createdAt/status/model이 없어 이력과 비동기 job을 연결할 수 없다.
- **P2** pageSize 기본/최대, invalid cursor 오류가 없고 빈 결과는 null이다. 고정 page schema로 통일한다.

### 2.8 직전 마스킹 요소 탐지 요청 조회 - `GET /api/v1/chat-rooms/{chatRoomId}/recent-analyze`

- **P0** 방 소유권 오류가 없어 원문, target text, ticket, file URL이 직접 노출될 수 있다.
- **P1** `직전`이 최신 접수/완료/성공 중 무엇인지 없다. pending/failed/cancelled 포함 규칙과 revision을 반환한다.
- **P1** 조회 직후 새 분석이 접수되는 경쟁이 있다. 새 POST에서 expected latest revision을 CAS하고 stale이면 409로 처리한다.
- **P2** 감지 0건 schema, status/createdAt/completedAt/modelId가 없고 파일 URL 대신 file ID가 필요하다.

### 2.9 파일 다운로드 - `GET /api/v1/download`

- **P1** client가 임의 `fileUrl`을 보내므로 host alias, path 변조, 다른 bucket/object의 인가 lookup 우회 여지가 있다. 서버가 URL을 직접 dereference하는 구현이라면 SSRF도 가능하므로 opaque `fileId`만 받는다.
- **P0** 다른 API가 fileUrl을 직접 반환하므로 object storage가 public/서명 URL이면 이 API의 업로더 검사를 우회한다. bucket은 private이고 모든 조회는 file ID만 반환해야 한다.
- **P1** signed URL TTL, method/object scope, 재사용, 권한 변경 후 잔존, 감사 규칙이 없다. `downloadUrl/expiresAt`을 반환하고 짧게 제한한다.
- **P1** 업로더 여부뿐 아니라 parent chat 접근권한, tenant, retention, quarantine를 확인하고 타인/미존재는 동일 404로 처리한다.
- **P1** malware scan 완료 전 차단, 파일명 CRLF/path 제거, attachment/nosniff, 서버 결정 MIME 규칙이 없다.

### 2.10 모델 목록 조회 - `GET /api/v1/models`

- **P1** 표시 문자열이 요청 식별자라 rename/case/동명/stale client 문제가 생긴다. stable model ID와 별도 display name을 제공한다.
- **P1** `사용 가능`이 user/tenant/department/API key/role/policy를 모두 통과한 상태인지 없다. 목록과 실제 dispatch가 같은 규칙을 써야 한다.
- **P1** 조회 후 unavailable/deprecated/key revoked가 될 때 오류와 재검증 규칙이 없다. 자동 fallback은 데이터 거버넌스를 바꾸므로 금지 또는 opt-in으로 둔다.
- **P2** provider/version/capability/context/file limit/status/data residency를 구조화해 반환하고 빈 목록은 `[]`로 유지한다.

## 3. 마이페이지 API

### 3.1 대화 기록 요약 조회 - `GET /api/v1/message-summary`

- **P1** 기간이 없어 전체 누계인지 최근 기간인지 알 수 없다. 목록의 recent와 맞는 기간·시간대를 받거나 명시한다.
- **P1** 예시 `local=6`, `total=42`, `localPercent=14.5`는 일반적인 소수 1자리 반올림인 14.3과 맞지 않는다. 분모·공식·정밀도를 고정한다.
- **P1** `filter`가 감지된 대화 수인지 탐지 항목 수인지, masking/local이 겹치는 집합인지 없다.
- **P1** 처리 중·실패·취소·삭제/보존 만료 건과 재시도 중복 제거 기준, 집계 SLA가 없다.
- **P2** 0건일 때 count/percent와 `updatedAt` 의미를 정의하고 `dataAsOf`를 반환한다.

### 3.2 대화 기록 조회 - `GET /api/v1/messages`

- **P0** 모든 필터와 count 전에 현재 사용자 소유 범위를 강제한다는 계약이 없다. 관리자 token도 이 API에서는 개인 범위를 넓히지 않아야 한다.
- **P1** recent 기본값·시간대·경계, pageSize 최대값, 안정 정렬/snapshot이 없어 중복·누락과 과대 조회가 가능하다.
- **P1** `orderBy=claude|gpt|local`은 정렬이 아니라 모델 필터다. `model`, `sort`, `direction`을 분리하고 query와 동시 사용 가능하게 한다.
- **P1** query가 summary/원문 중 무엇을 검색하는지와 길이·정규화·민감정보 마스킹 규칙이 없다.
- **P1** processing/failed/deleted 항목 포함 여부와 `detectCnt` 확정 시점이 없어 요약 수치와 어긋날 수 있다.
- **P2** 빈 결과도 `data:[]`와 pagination metadata를 반환하고 total count의 필터 전/후 의미를 분리한다.

### 3.3 부서 정책 목록 조회 - `GET /api/v1/policies`

- **P1** 활성/비활성, 시행·종료 시각, 전사-부서 상속과 충돌 우선순위가 없어 UI 정책과 실제 집행 정책이 달라질 수 있다.
- **P1** 인증 주체의 최신 tenant+department로 범위를 고정하고 JWT의 오래된 소속 claim만 믿지 않는다고 명시한다.
- **P2** 정책 없음은 null 대신 `targetDepartment`, `policies:[]`, `totalCnt:0`으로 반환한다.
- **P2** departmentId, policy code/version, class code와 표시명을 분리하고 최대 정책 수 또는 pagination을 정의한다.

### 3.4 사용자 정보 조회 - `GET /api/v1/users/me`

- **P1** schema에는 `filter/personalLimitRate/departmentLimitRate`가 있지만 예시는 이를 누락한다. 실제 반환 필드와 null/default를 확정한다.
- **P1** 위 세 필드의 분모·기간·단위·범위·반올림이 없다. 미적용, 무제한, 부서 없음도 표현해야 한다.
- **P1** 최신 DB의 계정/소속/권한을 반환하고 오래된 JWT claim을 그대로 신뢰하지 않는다고 명시한다.
- **P2** 부서 미소속·삭제 부서·복수 소속의 cardinality와 상태 규칙을 정하고 stable departmentId/roleCode를 반환한다.

## 4. 관리자 API

### 4.1 최근 관리자 활동 조회 - `GET /admin/v1/admin-logs`

- **P1** `최근`의 기간·최대 개수·정렬이 없다. cursor/limit과 `activityAt DESC + eventId`를 둔다.
- **P1** title/adminName만으로 이름 변경, 시스템 작업, 실패 작업과 대상을 추적할 수 없다. event type, actor ID/name snapshot, target, outcome, request ID를 반환한다.
- **P2** 이벤트 유형·기간·관리자 filter와 보존기간을 정의한다.

### 4.2 운영 현황 조회 - `GET /admin/v1/dashboard`

- **P1** user/chat/filter/model/local 수치의 기간·분모·포함 상태가 없고 `chatRate:200`이 비율인지 증가 건수인지도 불명확하다.
- **P1** 활성/비활성 사용자, 성공/실패 요청, 한 prompt의 복수 탐지, 전기 대비 공식과 퍼센트 단위를 metric dictionary로 고정한다.
- **P1** 다른 대시보드 API와 같은 snapshot ID를 사용하지 않으면 한 화면 숫자가 서로 다른 시점이 된다.
- **P2** provider별 고정 필드보다 model ID 기반 배열로 확장한다.

### 4.3 부서별 위험 분포 조회 - `GET /admin/v1/department-risks`

- **P1** recent의 필수/기본값, rolling/달력 기간, 시간대와 잘못된 값 오류가 없다.
- **P1** detectRate의 분모, 0건 부서, 중복 탐지, userCnt의 전체/활성/활동 사용자 기준이 없다.
- **P2** departmentId/asOf, 전체 부서 포함 여부, 안정 정렬과 최대 건수를 추가한다.

### 4.4 부서 생성 - `POST /admin/v1/departments`

- **P0** `departmentAdminId`가 활성 DEPART_ADMIN인지 외에 이미 다른 부서를 관리하는지, 한 관리자가 복수 부서를 맡는지, 동시 배정 경쟁 규칙이 없다.
- **P1** name/code 중 무엇이 유일한지, trim·대소문자·허용문자·길이와 동시 중복 생성의 원자성이 없다.
- **P1** `departmentLimit=0` 무제한의 단위·정산 주기, 음수/소수/최대값, 비활성 사용자 포함 여부가 없다.
- **P1** local LLM 활성과 실제 모델 가용성, mustFiltering, 정책/API key 등록 전 부서 사용 가능 여부가 없다. DRAFT→ACTIVE 전제조건을 두는 편이 안전하다.
- **P1** 관리자 미존재/비활성/역할 불일치/이미 배정, 잘못된 code/limit/local model 오류가 없다.

### 4.5 부서 목록 조회 - `GET /admin/v1/departments`

- **P1** page 기본/최대/1-base, query 일치 방식, 정렬과 snapshot이 없다.
- **P1** `departLimitUsd/useUsd/percent`의 통화·기간·reset·무제한/0 한도 규칙이 없다.
- **P2** `canUseLLMModel`과 빈 목록은 `[]`, 부서 없음도 null이 아닌 빈 page로 반환한다.
- **P2** policyType/outbound는 자유문이 아니라 stable code로 주고 policy count의 활성 기준을 정한다.

### 4.6 부서 관리 요약 조회 - `GET /admin/v1/departments-summary`

- **P1** 비활성 부서·비활성/미소속 사용자의 count 포함 여부가 없다.
- **P1** averageUsePercent가 단순 평균인지 가중 평균인지, averageRate가 어느 기간의 무엇인지 없다.
- **P2** 부서 0개일 때 평균값과 부서 목록과 동일한 snapshot을 정의한다.

### 4.7 부서 API 키 조회 - `GET /admin/v1/departments/me/api-key`

- **P0** 원문 `apiKey`를 반환한다. 저장 후에는 재조회 불가로 하고 masked key/fingerprint/configuredAt/rotatedAt/status만 반환한다.
- **P0** 불가피한 secret read는 별도 권한, 재인증/MFA, 사유, 건별 감사, no-store가 필요하다.
- **P1** TOTAL_ADMIN 전용인데 `/me`가 어느 부서인지 모호하다. 명시적 departmentId 또는 actor 소속 규칙으로 고친다.
- **P1** 대소문자 비구분은 정의됐지만 service의 canonical 응답값, 앞뒤 공백 처리, 키 미등록·폐기·검증 실패 오류가 없다.

### 4.8 부서 상세 조회 - `GET /admin/v1/departments/{departmentId}`

- **P0** `(tenantId, departmentId)` 범위와 타 조직의 opaque 404가 없다.
- **P1** 관리자 부재/복수/퇴사 상태와 stable admin ID가 없고 이름·이메일만 반환한다.
- **P1** usage/limit/remain의 통화·기간·정합식과 무제한 표현이 없다.
- **P1** mustFiltering, 상위 preset과 부서 정책의 우선순위, 필수 정책 비활성 금지 규칙이 없다.
- **P2** path 타입·범위 및 부서 미존재/비활성 오류가 없다.

### 4.9 LLM API 키 검증 및 등록 - `POST /admin/v1/departments/{departmentId}/apis`

- **P0** 같은 service 키가 이미 있을 때 overwrite/복수 보관/409 중 무엇인지 없다. 검증된 새 키를 원자적으로 교체하고 이전 키 폐기/rollback/rotation을 정의한다.
- **P0** 키의 암호화 저장, 로그·APM redaction, 응답 비노출, fingerprint와 secret-read 금지 규칙이 필요하다.
- **P1** invalid key와 provider 장애·timeout·rate limit·billing/권한 부족을 모두 400으로 합치면 정상 키를 오판한다. 422와 502/503/504를 분리한다.
- **P1** service enum/모델·권한 범위, 비활성 부서/local-only 부서, 동시 등록과 멱등성 규칙이 없다.
- **P2** 교체인데도 `createdAt`만 반환한다. key version/fingerprint/verifiedAt/rotatedAt을 제공한다.

### 4.10 부서 정책 동기화 - `PUT /admin/v1/departments/{departmentId}/policies`

- **P0** 빈 배열로 모든 정책을 해제할 수 있는지, mustFiltering/전사 필수 정책을 제거할 수 있는지 없다.
- **P1** 부서 정책이 현재 활성 전사 preset의 부분집합이어야 하는지, 전사 정책 제거가 부서에 어떻게 cascade되는지 없다.
- **P1** full replace를 동시 편집하면 마지막 요청이 변경을 덮는다. policy version/ETag/If-Match로 충돌을 막는다.
- **P1** 변경 중인 분석에는 접수 시점 또는 전송 시점 중 어느 policy snapshot을 적용하는지 정의한다.
- **P2** invalid enum, empty/max size, 비활성 부서 오류와 stable policy code/version 응답이 없다.

### 4.11 부서-사용자 연동 - `POST /admin/v1/departments/{departmentId}/users`

- **P0** 이미 소속/미존재/비활성 사용자를 조용히 건너뛰고 성공 시 새 연동 사용자만 반환한다. 요청자에게 어떤 ID가 왜 실패했는지 보이지 않아 감사와 재처리가 불가능하다. per-item status/reason 또는 atomic 옵션이 필요하다.
- **P0** 두 부서가 같은 미소속 사용자를 동시에 연동할 때 단일 소속을 원자적으로 보장하는 규칙이 없다.
- **P1** 대상 부서의 활성 상태와 departmentLimit 정원, 사용자 role, 기존 관리자 수를 확인하는 규칙이 없다.
- **P1** 같은 요청을 반복하면 `연동 가능한 사용자 없음` 오류가 되어 멱등하지 않다. 이미 같은 부서인 사용자는 ALREADY_LINKED로 안정 응답한다.
- **P1** 연동 해제/부서 이동 API와 기존 소속에서의 정책·이력·quota 귀속 규칙이 없어 조직 이동을 처리할 수 없다.
- **P2** bulk 최대 개수와 부분 성공의 HTTP/status 계약이 없다.

### 4.12 시스템 상태 요약 조회 - `GET /admin/v1/health`

- **P1** 정상 외 상태, checkedAt, freshness, timeout, 임계치, total health 합성 규칙이 없다.
- **P1** 부분 장애를 200+상태로 줄지 503으로 줄지, UNKNOWN/STALE을 어떻게 표현할지 정한다.
- **P1** 내부 database/storage/monitoring 구조 노출은 별도 SYSTEM_HEALTH_READ 권한과 감사가 적절하다. 외부 liveness는 축약한다.

### 4.13 모델 상태 조회 - `GET /admin/v1/llms/health`

- **P1** service/model 입력이 없는데 단일 객체만 반환한다. 배열 또는 modelId query로 계약을 고친다.
- **P1** availability 기간·분모, averageResponse 단위, history bucket 간격/순서/기준시각이 없다.
- **P2** history 숫자 배열 대신 at/status/latencyMs와 provider/model/deployment ID, UNKNOWN/STALE을 반환한다.

### 4.14 전체 채팅 기록 요약 조회 - `GET /admin/v1/logs-summary`

- **P1** 모든 count/rate의 기간·포함 상태·분모가 없다. masking+local과 filterDetectCnt의 집합 관계도 불명확하다.
- **P1** dashboard의 유사 지표와 이름·정의가 다르다. 공통 metric code와 동일 snapshot으로 계산한다.
- **P1** 삭제·비활성 사용자와 보존 만료 로그, 재시도/중복 job 포함 여부를 정의한다.

### 4.15 보안 정책 목록 조회 - `GET /admin/v1/policies`

- **P1** 응답이 presetName과 한국어 정책명뿐이라 rename·동명·다국어에서 식별이 깨진다. presetId/version과 policy ID/code/displayName을 분리한다.
- **P1** 여러 active preset 허용 여부, 전사 preset과 부서 custom 정책의 상속/override 우선순위와 적용 시점이 없다.
- **P2** 빈 결과를 `[]`로 고정하고 정책 version/effective time을 반환한다.

### 4.16 보안 정책 동기화 - `PUT /admin/v1/policies`

- **P1** `presetName+policies`는 새 preset 생성, `presetName`만 있으면 기존 preset 선택으로 구분되지만 optional field 조합으로 operation을 암시한다. 동일 이름 충돌, 기존 preset 수정 가능 여부를 정의하고 create/update/activate를 분리하거나 operation을 명시한다.
- **P0** 전사 정책 제거가 각 부서의 활성 정책과 mustFiltering을 무효화할 때 reject/cascade 중 무엇인지 없다.
- **P1** preset 이름의 유일성/정규화, 존재하지 않는 preset, empty/invalid policies, active preset cardinality 오류가 없다.
- **P1** 동시 변경을 막는 version/If-Match와 effectiveAt, 진행 중 분석의 policy snapshot, rollback이 없다.
- **P1** 응답에 preset ID/name/version이 없어 실제 활성화된 정책 집합을 감사할 수 없다.

### 4.17 정책별 감지 건수 조회 - `GET /admin/v1/policy-detect`

- **P1** 기간과 asOf가 없어 대시보드의 다른 숫자와 비교할 수 없다.
- **P1** 여러 정책 동시 매칭, 한 prompt 내 반복, 마스킹하지 않은 탐지, 삭제 로그와 0건 정책의 count 규칙이 없다.
- **P2** category/detailCategory 자유문 대신 policy code/ID/version을 사용한다.

### 4.18 프롬프트 상세 조회 - `GET /admin/v1/prompts/{promptId}`

- **P0** 모든 TOTAL_ADMIN에게 originalText/sendText/targetText와 사용자 이메일을 그대로 노출한다. 기본 redaction과 별도 AUDIT_CONTENT_READ, 재인증, 조회 사유, 건별 감사가 필요하다.
- **P0** 타 조직 prompt는 동일 404로 처리하고 tenant scope를 강제한다.
- **P1** 예시로 end-inclusive는 드러나지만 원문·전송문·탐지 배열의 offset 기준 문자열, Unicode/index 단위와 overlap 규칙이 없다.
- **P1** limit/usage 단위·기간과 detectCnt/maskingCnt가 배열과 맞아야 하는 invariant, 데이터 보존/파기 규칙이 없다.

### 4.19 사용자 계정 요약 조회 - `GET /admin/v1/user-summary`

- **P1** total=active+disabled인지, 초대 대기·잠김·익명화·삭제 상태가 어디에 속하는지 없다.
- **P1** newUserCnt의 기간과 생성/활성화/복구 중 기준 이벤트가 없다.
- **P2** 사용자 목록과 같은 asOf/snapshot을 반환한다.

### 4.20 사용자 계정 목록 조회 - `GET /admin/v1/users`

- **P1** orderBy가 정렬과 department/role/status filter를 섞고 query와 상호배타여서 검색 결과 정렬이 불가능하다. sort/filter/query를 분리한다.
- **P1** recent의 기준, 방향, page 기본/최대, tie-breaker/snapshot, 비활성·삭제 포함 규칙이 없다.
- **P1** totalCnt/filteringCnt/dataCnt의 의미와 검색 부분일치·대소문자·Unicode 규칙이 없다.
- **P2** 빈 결과는 page 객체+`data:[]`로 유지한다.

### 4.21 사용자 생성 - `POST /admin/v1/users`

- **P0** 부서 관리자가 USER를 생성할 수 있지만 body에 departmentId가 없다. actor 부서 자동 소속인지 미소속 생성인지 결정하고, TOTAL_ADMIN의 대상 부서 지정 규칙을 둔다.
- **P0** 관리자가 평문 password를 정하는 구조다. 일회용 초대/임시 credential, 첫 로그인 강제 변경, 만료, 전달 채널과 감사 규칙이 필요하다.
- **P1** role enum, name/email/password 검증, 이메일 trim/case 유일성, 비활성 동일 이메일은 복구할지 충돌할지 없다.
- **P1** DEPART_ADMIN 생성 후 어느 부서 관리자 후보가 되는지, 기존 관리자와의 관계, 생성-부서 연결 실패 시 orphan 처리 규칙이 없다.
- **P1** 재시도 idempotency와 응답에 email/role/department/status/createdAt이 없어 생성 결과를 확정하기 어렵다.

### 4.22 전체 채팅 기록 사용자 목록 조회 - `GET /admin/v1/users-prompts`

- **P1** query의 대상 필드/일치 방식, 정렬, page 기본/최대가 없다.
- **P1** prompt 0건, 비활성·삭제 사용자의 포함 여부와 tenant 범위를 정의한다.
- **P1** usage/limit가 다른 API 예시와 1000배 차이다. 통화/토큰과 minor unit 또는 Decimal string을 전 API에서 통일한다.
- **P2** 빈 결과는 null이 아닌 빈 page로 반환한다.

### 4.23 사용자 계정 비활성화 - `DELETE /admin/v1/users/{userId}`

- **P0** 자기 자신, 마지막 TOTAL_ADMIN, 유일한 부서 관리자를 비활성화할 수 있는지 없다. 대체 관리자 지정 등 불변조건을 먼저 검사한다.
- **P0** 성공 즉시 모든 refresh family와 기존 access를 폐기하는지 없다. 비활성 계정이 계속 API를 사용할 수 있다.
- **P1** 이미 비활성인 계정의 반복 요청, 복구와의 동시 경쟁, expected version이 없다.
- **P1** 진행 중 분석/LLM job을 취소/완료/숨김 중 어떻게 처리하는지, 부서 membership과 quota count를 유지하는지 없다.
- **P1** disabled reason, actor/event ID, 보존·이메일 재사용 규칙이 없다.

### 4.24 사용자 계정 상세 조회 - `GET /admin/v1/users/{userId}`

- **P0** `(tenantId,userId)` 범위와 개인정보 조회 감사가 없다.
- **P1** 목록에는 status가 있지만 상세에는 없어 비활성 상태, disabledAt/reason을 확인할 수 없다.
- **P1** createdBy가 이름뿐이라 관리자 변경/삭제 시 추적이 깨진다. actor ID와 name snapshot을 함께 둔다.
- **P1** limit/usage/count의 단위·기간과 비활성화 후 기록 포함 여부가 없다.

### 4.25 사용자 계정 복구 - `POST /admin/v1/users/{userId}`

- **P0** 복구가 과거 refresh/access token까지 되살리면 안 된다. 모든 이전 세션은 폐기 상태를 유지하고 새 인증/비밀번호 재설정을 요구한다.
- **P0** 원래 부서가 비활성/삭제, 정원 초과, 관리자 교체, 이메일 재사용 상태일 때 원 역할·소속을 그대로 복구할지 없다.
- **P1** 이미 활성 계정의 반복 요청은 멱등 성공 또는 명확한 conflict로 고정하고 비활성화와 경쟁을 version으로 막는다.
- **P1** 보안 사유로 정지된 계정의 승인/사유, restored actor/event, 과거 데이터 가시성 규칙이 없다.

### 4.26 사용자 프롬프트 목록 조회 - `GET /admin/v1/users/{userId}/prompts`

- **P0** userId의 tenant scope와 타 조직 opaque 404가 없다.
- **P1** 최신순이지만 timestamp tie-breaker/snapshot이 없어 pageNumber 순회 중 중복·누락된다.
- **P1** 사용자 미존재와 prompt 0건, 비활성 사용자, 처리 중/실패/삭제/보존 만료의 포함 규칙이 없다.
- **P1** promptSummary가 원문 기반이면 목록만으로 민감정보가 노출된다. masked text 기반 요약 또는 redaction을 보장한다.
- **P2** usage 단위, stable model ID/version과 빈 page schema를 정의한다.

## 권장 처리 순서

1. **출시 차단 P0**: prompt/chat/file 소유권, 원문/API key/file URL 노출, 서버 생성 masked artifact, LLM job 멱등성·중복과금 방지
2. **계정 보안 P0**: refresh rotation/reuse detection, 로그아웃·비밀번호 변경·비활성화 시 세션 폐기, 관리자 불변조건
3. **핵심 상태 P1**: 분석/LLM 상태 머신, 취소 CAS, ticket/revision, retry/timeout/expiry
4. **정책·한도 P1**: preset-부서 상속/버전/snapshot, quota 예약·확정·환불, 통화·정산 기간
5. **관리·통계 P1**: metric dictionary, 공통 snapshot, 개인정보 별도 권한과 감사
6. **계약 정리 P2**: stable ID/code, pagination/cursor, 빈 결과, HTTP status와 업무 code, 날짜/단위 통일

## 승인 기준 체크리스트

- 타인의 ticket/chatRoomId/promptId/fileId/userId/departmentId로 요청한 모든 권한 테스트가 404로 끝나는가?
- 같은 analyze/LLM 요청을 동시에 여러 번 보내도 작업과 외부 과금이 정확히 1회인가?
- 분석/생성의 모든 terminal 상태에서 클라이언트가 무한 폴링하지 않는가?
- 외부 LLM에는 서버가 확정한 masked text/file만 전송되며 정책/모델/content hash가 감사되는가?
- 비밀번호 변경·로그아웃·계정 비활성화 직후 이전 refresh/access token이 거부되는가?
- 정책 변경과 quota 변경 중 실행 중인 요청이 정의된 snapshot/정산 규칙을 따르는가?
- 원문, API key, file URL, token이 일반 응답·로그·APM·브라우저 cache에 남지 않는가?
- 모든 목록의 빈 결과, 정렬, cursor/page, total count가 동일한 규칙을 따르는가?
- 네 개의 관리자 대시보드 API가 같은 기간과 snapshot으로 재현 가능한 수치를 반환하는가?
- 모든 관리자 변경을 actor, target, before/after, reason, outcome, request ID로 추적할 수 있는가?
