# API 비즈니스 로직 흐름 감사

> 재검토일: 2026-08-08  
> 범위: 컨트롤러, DTO, 서비스, Repository 및 LPL/Provider 연동 코드의 정적 분석과 단위 테스트  
> 제외: 운영 DB·LPL·외부 Provider의 실제 데이터 및 배포 상태

## 현재 계약 요약

| 구분 | 식별자 | 실제 값 | 다음 API에서의 용도 |
| --- | --- | --- | --- |
| 프롬프트 상세/목록 | `promptId: number` | `prompt_log.prompt_log_id` | `GET /api/v1/prompts/{promptId}`, `GET /admin/v1/prompts/{promptId}` |
| 분석·LLM 전송 | `ticket: UUID` | `masking_report.masking_report_id` | `GET/DELETE /api/v1/analyze`, `POST/GET /api/v1/prompt` |
| 채팅방 | `chatRoomId: UUID` | `prompt_room.prompt_room_id` | 채팅방별 분석·프롬프트 목록 |

`promptId`와 `ticket`은 서로 대체할 수 없습니다. 프롬프트 목록에서 숫자 `promptId`를 반환하는 API는 상세 조회에, UUID `ticket`을 반환하는 API는 분석/LLM 상태 확인과 전송에 사용해야 합니다.

## 반영된 정책과 구현 상태

### 1. 파일은 탐지 결과만 기록하며 마스킹 사본을 만들지 않음

첨부 PDF/PNG/JPEG는 MinIO 원본을 유지합니다. 파일을 실제로 가린 별도 객체를 만들지 않으며, 파일 분석 결과는 어떤 보안 정책에 걸렸는지 기록·응답하는 용도입니다. 따라서 “마스킹 사본이 없다”는 제품 결정이며 결함으로 분류하지 않습니다.

외부 LLM으로 파일을 보내는 현재 동작도 이 결정의 일부입니다. 파일 원문 외부 전송 자체를 금지하거나 별도 처리해야 한다면, 이는 파일 마스킹 기능 추가가 아니라 외부 전송 정책 변경으로 다뤄야 합니다.

### 2. 24시간 미전송 MASKING 로그 만료

- 시작 시와 매 1시간마다 정리 작업을 실행합니다.
- `masking_report.created_at` 기준 24시간이 지난 `prompt_log.status = MASKING`만 대상으로 합니다.
- 대상 `prompt_log`는 삭제합니다.
- 관련 `masking_report.status`는 `CANCEL`로 변경합니다.
- `masking_report`, `masking_detail`, 정규식/NER 분기 상태, 파일 메타데이터는 감사 기록으로 남깁니다.
- 행 잠금과 `status = MASKING` 조건 삭제를 사용하므로, 만료 처리 중 `PENDING`으로 바뀐 로그를 삭제하지 않습니다.

따라서 만료된 ticket은 분석 결과 기록은 남아도 `POST /api/v1/prompt`의 전송 대상 로그가 없어 재전송할 수 없습니다.

### 3. 사용자 취소 규칙

`DELETE /api/v1/analyze`는 본인 소유의 `MASKING` 프롬프트 로그가 있을 때만 성공합니다.

- `MASKING` 로그 삭제 후 보고서 최종 상태를 `CANCEL`로 바꿉니다.
- `PENDING`, `DONE`, `ERROR` 로그는 이 API의 취소 대상이 아닙니다.
- 취소와 전송 예약이 경합하면 로그 잠금·조건 삭제로 `PENDING` 로그가 삭제되는 것을 막습니다.
- `POST /api/v1/prompt`는 보고서 상태가 `DONE`일 때만 허용하므로 `CANCEL` 보고서는 전송할 수 없습니다.

남은 운영 고려사항: 외부 Provider 호출을 이미 시작한 뒤의 네트워크 취소, Provider idempotency key, 중복 과금 방지는 별도 outbox/idempotency 설계가 필요합니다.

### 4. `mustFiltering` 외부 LLM 전송 규칙

외부 LLM에만 적용합니다. 로컬 LLM은 기존대로 마스킹된 텍스트를 LPL `/generate`에 보냅니다.

| `mustFiltering` | `masking_detail` 존재 | 외부 LLM 전송 |
| --- | --- | --- |
| `true` | 없음 | 허용 |
| `true` | 하나 이상 | 거부 (`PROM403_4`) |
| `false` | 무관 | 허용 |

부서 목록의 외부 전송 표시는 이 의미에 맞춰 `조건부`(`true`) 또는 `허용`(`false`)로 반환합니다. 부서 설정을 읽을 수 없는 경합 상황은 허용하지 않고 모델 접근 오류로 차단합니다.

### 5. 부서 관리자 프롬프트·파일 접근 범위

| 역할 | 사용자 프롬프트 목록/상세 | 파일 다운로드 |
| --- | --- | --- |
| `TOTAL_ADMIN` | 모든 사용자·부서 | 모든 파일 |
| `DEPART_ADMIN` | 자신의 부서 `USER` 역할만 | 자신의 부서 `USER` 역할 파일만 |
| 일반 사용자 | 일반 관리자 API 불가 | 본인 파일만 |

같은 부서에 있더라도 부서 관리자의 프롬프트·파일은 다른 부서 관리자가 조회·다운로드할 수 없습니다. 다른 부서 일반 사용자도 동일하게 거부됩니다.

### 6. 보안 정책별 분석 범위

- Gateway 정규식 분석 대상은 활성화된 `PRIVATE` 보안 정책 중 정규식 구현이 있는 항목뿐입니다.
- `SENSITIVE`, `CONTRACT`, `AUDIT` 등 나머지 활성 정책은 정규식으로 억지로 저장하지 않습니다.
- 해당 정책은 NER/LLM 분석을 재개할 때 전달할 전체 정책 목록에는 유지됩니다.
- 현재 NER 요청·상태 전이·결과 저장은 NER 서버 개발 완료 전까지 비활성화되어 있으며, OCR만 진단 로그 목적으로 실행됩니다.

이는 정책 카탈로그 전체를 Gateway 정규식으로 처리하려는 설계가 아니라, PRIVATE의 정규식 가능 항목만 Gateway가 확정한다는 정책입니다.

### 7. NER 응답 처리 규칙

NER 연동 재개 시 다음 규칙을 적용합니다.

- `maskingText`가 없는 탐지는 마스킹할 요소가 없는 것으로 취급하고 저장하지 않습니다.
- 활성 부서 정책에 매핑되지 않는 NER type은 전체 요청 실패가 아니라 무시합니다.
- 유효한 탐지만 `masking_detail`에 저장합니다.
- 파일 탐지는 원문·인덱스 없이 파일 URL과 정책 연결만 저장합니다.

### 8. 로컬 LLM Deployment ID 계약

- 로컬 LLM 등록 시 `deploymentId`는 반드시 `local-*`이며 DB `llm_detail_model.llm_name`에도 같은 값을 저장합니다.
- Gateway는 LPL `GET /deployments/llm`에서 `enabled=true`인 `local-*`의 **deploymentId**를 기준으로 동기화합니다. 상세 `modelName`을 DB 키로 쓰지 않습니다.
- LPL `/generate`의 `llmDeploymentId`에는 DB의 `llm_detail_model.llm_name` 값을 그대로 보냅니다.
- 레거시 `ollama-*`처럼 `local-*` 규칙을 만족하지 않는 Deployment는 새 로컬 모델 매핑에 사용하지 않습니다.

### 9. 사용자 모델 목록 및 부서 목록

- 사용자 `GET /api/v1/models`는 DB `active_llm` 매핑과 LPL의 현재 `enabled local-*` 상태의 교집합만 반환합니다.
- LPL에서 비활성화됐거나 사라진 로컬 모델은 DB에 매핑이 남아 있어도 사용자 목록·실행에서 제외합니다.
- 부서 목록/상세도 `active_llm` 실제 매핑이 하나 이상 있을 때만 Local LLM 사용 가능으로 표시합니다.

## 한도 배분 상태

다음 경로는 부서의 활성 사용자 수 `N`으로 개인 한도를 `department.limit / N`으로 재배분하고, 대상 외부 API 키별 `member_limit.usage`를 `0`으로 초기화합니다.

- `POST /admin/v1/departments/{departmentId}/users` 부서-사용자 연동
- 부서 관리자의 일반 사용자 생성 후 자동 부서 배정
- 외부 API 키 등록/갱신

로컬 LLM은 API 키·비용 사용량이 없으므로 `member_limit`을 만들지 않습니다.

### 남은 결정 필요: “입력 토큰 + 사용량” 사전 차단

현재 스키마와 외부 Provider 계약은 단위가 다릅니다.

- `department.limit`, `member_limit.limit`: Swagger와 DAO 기준 USD 한도
- `department.usage`, `member_limit.usage`: 외부 Provider 응답의 `total_usd`
- LPL 로컬 `/generate`의 `usage.inputTokens`: 토큰 수이며 비용 사용량이 아님

따라서 현재 데이터로 “입력 토큰 + USD 사용량 >= USD 한도”를 비교하면 단위가 섞여 잘못 차단됩니다. 사전 차단을 구현하려면 아래 중 하나를 먼저 확정해야 합니다.

1. 한도·사용량을 토큰 단위로 전환하고 외부 Provider가 입력 토큰을 반환하도록 계약을 바꾼다.
2. USD 한도를 유지하고, 모델별 가격표와 요청 토큰 수로 예상 비용을 계산한다.
3. Provider가 요청 전 예상 비용을 반환하는 예약/견적 API를 제공한다.

현재 구현은 안전하지 않은 임의 토큰 추정을 추가하지 않았습니다. 단위가 확정되면 전송 예약 트랜잭션에서 개인·부서 한도를 함께 조건부 차감해야 동시 요청 초과도 막을 수 있습니다.

또한 현재 공개된 부서 한도 수정 API는 없으므로, 새 한도 변경 API가 생기면 같은 재배분 헬퍼를 그 트랜잭션에서 호출해야 합니다.

## API 문서·라우트 정합성

- 동작하지 않던 `PATCH /admin/v1/users/{userId}`는 컨트롤러, 서비스, DTO, Swagger에서 제거했습니다.
- Notion의 해당 API 페이지도 폐기 표시로 변경했으며, 더 이상 프론트엔드에서 호출하면 안 됩니다.
- 분석 요청의 `chatRoomId`는 선택 값입니다. 생략 또는 `null`이면 서버가 새 UUID 채팅방을 만들고, 값을 보낼 때만 요청자 소유의 기존 채팅방 UUID를 허용합니다. 클라이언트가 새 채팅방 UUID를 임의 생성해서 보내는 방식은 지원하지 않습니다.

## 계속 확인할 항목

1. `GET /api/v1/messages`가 UUID ticket을 `promptId`라는 이름으로 반환하는 계약을 `ticket` 또는 `maskingReportId`로 분리할지 결정한다.
2. 채팅방별 프롬프트 목록에서 LLM 상태 재조회가 필요하면 숫자 `promptId`와 UUID `ticket`을 함께 반환할지 결정한다.
3. 외부 Provider 호출의 idempotency/중복 과금 방지 정책을 마련한다.
4. 한도의 단위(USD 또는 token)와 외부 Provider의 사전 비용 조회 계약을 확정한다.
5. NER 서버 계약이 확정되면 `NER_ANALYSIS_ENABLED`를 재활성화하고 통합 테스트로 file/text 탐지를 검증한다.

## 주요 근거 파일

- `src/domain/prompt/service/prompt.service.ts`
- `src/domain/prompt/repository/masking-report.repository.ts`
- `src/domain/prompt/repository/prompt-log.repository.ts`
- `src/domain/prompt/service/masking-prompt-log-cleanup.service.ts`
- `src/domain/admin/service/admin.service.ts`
- `src/global/ner/client/ner.client.ts`
- `src/global/llm/client/provider.client.ts`
