# 마스킹 요소 탐지 요청·결과 조회 API HTTP 테스트 시나리오

## 1. 테스트 대상과 현재 제약

- Gateway 요청: `POST /api/v1/analyze`
- 분석 여부 및 결과 조회: `GET /api/v1/analyze?ticket={UUID}`
- 파일 다운로드 URL 생성: `GET /api/v1/download`, JSON Body `{ "fileUrl": "String" }`
- NER 결과 콜백: `POST /internal/v1/ner/callback`
- 요청 형식: `multipart/form-data`
  - `json`: 필수 JSON 문자열
  - `file`: 선택 파일
- 인증: Gateway 요청과 결과 조회는 JWT Access Token이 필요합니다.
- 역할 제한은 없어 활성 `USER`, `DEPART_ADMIN`, `TOTAL_ADMIN` 모두 요청할 수 있습니다.
- 결과 조회는 Access Token의 `userId`와 `masking_report.member_id`가 일치하는
  요청만 허용합니다. 다른 사용자의 티켓도 존재하지 않는 티켓과 동일하게
  `404 / PROM404_1`을 반환합니다.
- 실제 개인정보, 운영 API Key 또는 운영 파일을 테스트 데이터로 사용하지 않습니다.

## 2. 선행조건

| 구분 | 조건 |
|---|---|
| Gateway | `http://localhost:3000`에서 실행 |
| 회원 | 활성 상태이며 로그인이 가능한 테스트 회원 |
| 부서 | 회원에 대응하는 `member_department` 행 존재 |
| 모델 권한 | 요청 모델의 `llm_detail_model`과 연결되고, 같은 부서의 `active_api_key`를 참조하는 `active_llm` 행 존재 |
| 채팅방 | 요청 회원 소유의 `prompt_room` 행 존재 |
| 정책 | 같은 부서에서 활성화된 `PRIVATE` `department_policy` 항목 존재 |
| MinIO | 설정된 비공개 버킷에 읽기·쓰기·삭제 가능 |
| 테스트 파일 | 확장자·MIME·magic byte가 일치하는 10MiB 이하 PDF/JPEG/JPG/PNG |

LLM API 키 등록 API는 검증된 키를 AES로 암호화해 `active_api_key`에 저장하고,
등록 서비스와 일치하는 모델을 `active_llm`으로 연결합니다. 테스트용 부서와
`llm_detail_model` 모델 마스터를 먼저 준비한 뒤 `TOTAL_ADMIN` Access Token으로
등록 API를 호출하거나, 같은 관계를 fixture/SQL로 준비합니다.
`masking_report`와 `masking_detail`은 분석 API가 생성하므로 미리 넣지 않습니다.

정규식 탐지 코드는 `PHONE`, `RESIDENT`, `CARD`, `EMAIL`, `API_KEY`를
지원하지만, 이번 단계에서는 `masking_class=PRIVATE`인 정책만 사용합니다.
등록 서비스는 대소문자와 관계없이 `Gemini`, `GPT`, `Claude`만 허용합니다.
모델 연결은 서비스별 모델명 접두사 `Gemini → gemini`, `GPT → gpt`,
`Claude → claude`를 대소문자 없이 비교해 생성됩니다. 분석 요청은 같은
부서의 `active_api_key → active_llm → llm_detail_model` 연결로 해당 모델의
사용 가능 여부를 검증합니다.

실행 전 MinIO와 현재 NER 모듈 초기화에 필요한 설정을 `.env`에 추가합니다.
분석 요청 자체는 NER 서버를 호출하지 않습니다.

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_PUBLIC_ENDPOINT=localhost
MINIO_PUBLIC_PORT=9000
MINIO_PUBLIC_USE_SSL=false
MINIO_ACCESS_KEY=<테스트 MinIO Access Key>
MINIO_SECRET_KEY=<테스트 MinIO Secret Key>
MINIO_BUCKET=llm-gateway-private
MINIO_REGION=us-east-1
MINIO_PRESIGNED_GET_TTL_SECONDS=600
NER_SERVER_IP=127.0.0.1:8000
NER_CALLBACK_SECRET=test-ner-callback-secret
```

MinIO 버킷은 애플리케이션이 자동으로 만들지 않으므로 미리 생성해야 합니다.
NER 서버 호출은 현재 비활성화되어 별도 mock이 필요하지 않습니다.

## 3. 공통 준비: 로그인

```bash
export BASE_URL=http://localhost:3000

curl --request POST "$BASE_URL/auth/v1/login" \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "gateway-test@example.com",
    "password": "Gateway123!"
  }'
```

예상 응답은 HTTP `200`, `AUTH200_1`입니다. 응답의
`result.accessToken`을 복사합니다.

```bash
export ACCESS_TOKEN='<로그인 응답의 accessToken>'
export CHAT_ROOM_ID='<요청 회원 소유의 prompt_room UUID>'
```

## 4. 시나리오 A: 텍스트만 분석

새 UUID를 생성합니다. 같은 티켓을 다시 사용하면 중복 요청으로 처리됩니다.

```bash
export TICKET=$(uuidgen | tr '[:upper:]' '[:lower:]')

curl --include --request POST "$BASE_URL/api/v1/analyze" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --form-string "json={\"model\":\"Claude Sonnet 5\",\"text\":\"전화번호 010-1234-5678, 주민번호 900101-1234567, 카드번호 4111 1111 1111 1111, 이메일 member@example.com\",\"ticket\":\"$TICKET\",\"recentTicket\":null,\"chatRoomId\":\"$CHAT_ROOM_ID\"}"
```

예상 응답:

```json
{
  "isSuccess": true,
  "code": "PROM200_1",
  "message": "성공적으로 마스킹 요소 분석을 요청했습니다.",
  "result": null
}
```

검증사항:

- NER 서버는 호출되지 않습니다.
- `masking_report`는 `status=DONE`, `regex_status=DONE`, `ner_status=DONE`입니다.
- 활성 `PRIVATE` 부서 정책에 등록된 항목만 `masking_detail`에 저장됩니다.
- 상세에는 `original_text`, `start_idx`, `end_idx`, `masking_text`가 저장됩니다.
  `masking_text`는 `[ 전화번호 ]`, `[ 이메일 ]`처럼 정책별 토큰입니다.

## 5. 시나리오 B: 파일과 원문 텍스트 분석

실제로 파싱 가능한 테스트 파일을 지정하고 새로운 티켓을 사용합니다.

```bash
export FILE_PATH=./sample.pdf
export TICKET=$(uuidgen | tr '[:upper:]' '[:lower:]')

curl --include --request POST "$BASE_URL/api/v1/analyze" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --form-string "json={\"model\":\"Claude Sonnet 5\",\"text\":\"담당자 연락처는 010-1234-5678이고 이메일은 member@example.com입니다.\",\"ticket\":\"$TICKET\",\"recentTicket\":null,\"chatRoomId\":\"$CHAT_ROOM_ID\"}" \
  --form "file=@$FILE_PATH;type=application/pdf"
```

Gateway는 파일 확정 저장과 정규식 탐지를 마친 뒤 `PROM200_1`을 반환합니다.

접수 직후 검증사항:

- `masking_report`는 `status=DONE`, `regex_status=DONE`, `ner_status=DONE`입니다.
- MinIO에 `masking/{uuid}.pdf` 객체가 존재합니다.
- `prompt_file.file_url`은 `s3://{bucket}/masking/{uuid}.pdf` 형식입니다.
- `incoming/` 임시 객체는 요청 종료 후 삭제됩니다.
- NER 서버는 호출되지 않습니다.

## 6. 시나리오 C: NER 완료 콜백

콜백의 `maskingContent`는 해당 회원의 부서 정책에 존재해야 합니다.

```bash
export NER_CALLBACK_SECRET=test-ner-callback-secret

curl --include --request POST "$BASE_URL/internal/v1/ner/callback" \
  --header 'Content-Type: application/json' \
  --header "x-ner-callback-secret: $NER_CALLBACK_SECRET" \
  --data "{
    \"ticket\": \"$TICKET\",
    \"status\": \"DONE\",
    \"detections\": [
      {\"maskingContent\": \"PHONE\"},
      {\"maskingContent\": \"EMAIL\"}
    ]
  }"
```

예상 응답은 HTTP `200`, `PROM200_8`입니다.

```json
{
  "isSuccess": true,
  "code": "PROM200_8",
  "message": "성공적으로 파일 분석 결과를 반영했습니다.",
  "result": null
}
```

콜백 후 검증사항:

- `masking_report`는 `status=DONE`, `regex_status=DONE`, `ner_status=DONE`입니다.
- NER 탐지 상세는 `original_text`, `start_idx`, `end_idx`가 `NULL`입니다.
- 같은 완료 콜백을 다시 보내도 상세 데이터가 중복 삽입되지 않습니다.

## 7. 시나리오 D: 분석 여부 및 결과 조회

분석 요청에 사용한 티켓을 Query Parameter로 전달합니다.

```bash
curl --include --get "$BASE_URL/api/v1/analyze" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "ticket=$TICKET"
```

Gateway는 Access Token의 `userId`와 `masking_report.member_id`가 일치하는지
확인한 뒤 상태에 따라 다음과 같이 응답합니다.

| 조건 | 예상 HTTP | 예상 code | 결과 |
|---|---:|---|---|
| 본인 요청이며 `status=DONE` | 200 | `PROM200_2` | 탐지 결과 반환 |
| 본인 요청이며 `status=PENDING` | 200 | `PROM200_2_1` | `result: null`, 아직 분석 중 |
| 본인 요청이며 `status=CANCEL` | 503 | `PROM503_1` | 분석 처리 불가 |
| 티켓이 없거나 다른 사용자의 요청 | 404 | `PROM404_1` | 요청 존재 여부를 구분하지 않음 |
| `ticket`이 UUID 형식이 아님 | 400 | `PROM400_3` | 저장소 조회 전 거절 |

`DONE` 상태에서 텍스트 탐지 결과가 있는 경우의 응답 예시는 다음과 같습니다.

```json
{
  "isSuccess": true,
  "code": "PROM200_2",
  "message": "성공적으로 마스킹 요소를 탐지했습니다.",
  "result": {
    "originText": "연락처는 010-1234-5678입니다.",
    "masking": {
      "file": null,
      "text": [
        {
          "targetText": "010-1234-5678",
          "startIdx": 5,
          "endIdx": 18,
          "maskingCategory": "개인정보",
          "detailCategory": "전화번호"
        }
      ]
    }
  }
}
```

탐지 항목이 없는 `DONE` 요청은 HTTP `200`, `PROM200_2`와 함께
`result: null`을 반환합니다. `PENDING` 요청은 HTTP `200`,
`PROM200_2_1`과 `result: null`을 반환합니다.

파일 탐지 결과가 있으면 `masking.file.fileUrl`에는 `prompt_file.file_url`에
저장된 `s3://{bucket}/{objectKey}` 형식의 식별자가 반환됩니다. 이 값 자체는
다운로드 주소가 아니며 다음 API의 요청 본문에 전달합니다.

## 8. 시나리오 E: 파일 다운로드 URL 생성

분석 결과에서 받은 `fileUrl`을 그대로 전달합니다.

```bash
curl --include --request GET "$BASE_URL/api/v1/download" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{
    "fileUrl": "s3://llm-gateway-private/masking/<FILE_UUID>.pdf"
  }'
```

Gateway는 `prompt_file.file_url`과 일치하는 DB 행을 찾고, 연결된
`masking_report.member_id`가 Access Token의 `userId`와 같은지 확인한 뒤
10분 유효 presigned URL을 `result` 문자열로 반환합니다.

> 파일 다운로드 URL 생성 API는 현재 명세에 따라 GET 요청 본문을 사용합니다.
> 브라우저 Fetch는 GET 본문을 지원하지 않으므로 프론트 연동 전에 호출 방식
> 또는 HTTP Method를 별도로 합의해야 합니다.

## 9. DB 확인 쿼리

```sql
SELECT masking_report_id, status, regex_status, ner_status, member_id, original_text
FROM masking_report
WHERE masking_report_id = '<TICKET>';

SELECT masking_detail_id, original_text, start_idx, end_idx, policy_id
FROM masking_detail
WHERE masking_report_id = '<TICKET>'
ORDER BY masking_detail_id;

SELECT prompt_file_id, file_url, masking_report_id
FROM prompt_file
WHERE masking_report_id = '<TICKET>';
```

## 10. 실패 시나리오 표

각 시나리오는 기존 성공 티켓과 겹치지 않는 새 UUID로 수행합니다.

| ID | 변경 조건 | 예상 HTTP | 예상 code | 추가 검증 |
|---|---|---:|---|---|
| F-01 | Authorization 헤더 제거 | 401 | `AUTH401_1` | DB와 MinIO 변경 없음 |
| F-02 | 위조되거나 잘못된 Access Token | 401 | `AUTH401_2` | DB와 MinIO 변경 없음 |
| F-03 | 만료된 Access Token | 400 | `AUTH400_2` | DB와 MinIO 변경 없음 |
| F-03B | Refresh Token으로 분석 요청 | 400 | `AUTH400_4` | DB와 MinIO 변경 없음 |
| F-04 | `json` 누락, 잘못된 JSON, 빈 text, 잘못된 UUID 또는 추가 필드 | 400 | `PROM400_3` | 리포트 생성 없음 |
| F-05 | `.txt`, 10MiB 초과, 확장자·MIME·magic byte 불일치 파일 | 400 | `PROM400_1` | `incoming/` 객체 정리 |
| F-05B | 일반 multipart 필드 2개 또는 파일 2개 전송 | 400 | `PROM400_1` | Multer 제한 및 staging 정리 확인 |
| F-06 | 요청 모델에 대응하는 부서 `active_llm` 연결이 없음 | 403 | `PROM403_1` | 리포트 생성 없음, staging 정리 |
| F-07 | 이미 성공한 ticket으로 재요청 | 400 | `PROM400_2` | 기존 리포트 유지 |
| F-08 | 존재하지 않거나 다른 회원 소유의 chatRoomId | 404 | `PROM404_6` | 리포트 생성 없음, staging 정리 |
| F-09 | 존재하지 않거나 다른 회원 소유의 recentTicket | 404 | `PROM404_5` | 리포트 생성 없음 |
| F-10 | DB 또는 MinIO 처리 실패 | 503 | `PROM503_1` | 생성 단계에 따른 보상 처리 확인 |
| F-11 | 콜백 secret 누락 또는 불일치 | 401 | `AUTH401_2` | 리포트 변경 없음 |
| F-12 | 콜백 형식 오류 또는 부서 정책에 없는 `maskingContent` | 400 | `PROM400_4` | NER 상태 `DONE` 유지 |
| F-13 | 존재하지 않는 ticket으로 DONE 콜백 | 404 | `PROM404_1` | 상세 생성 없음 |

## 11. 완료 기준

- HTTP 상태와 공통 응답의 `isSuccess`, `code`, `message`, `result`가 일치합니다.
- NER 호출 없이 정규식 완료 후 NER와 최종 상태가 `DONE`으로 유지됩니다.
- 성공·실패에 따라 DB 상태가 예상대로 전이됩니다.
- 실패한 파일 요청은 staging 및 최종 MinIO 객체를 남기지 않습니다.
- 실제 개인정보나 운영용 자격증명이 로그, 요청 예제 또는 테스트 파일에 포함되지 않습니다.
