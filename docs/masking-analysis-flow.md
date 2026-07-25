# 마스킹 요소 탐지 요청 흐름

```mermaid
sequenceDiagram
    autonumber
    actor Client as 클라이언트
    participant Guard as JWT Guard
    participant Upload as MinIO Upload Storage
    participant API as PromptController
    participant Service as PromptService
    participant DB as MySQL
    participant Regex as PromptService 내부 정규식
    participant MinIO
    participant NER
    participant Callback as NER Callback API

    Client->>Guard: JWT + multipart(json, file?)
    Guard-->>Client: 인증 실패 시 AUTH 오류
    Guard->>Upload: 인증된 파일 stream
    Upload->>MinIO: incoming/ 영역으로 streaming upload
    MinIO-->>Upload: objectKey, SHA-256, size
    Upload->>API: JSON DTO + StoredPromptFile
    API->>Service: DTO, 파일, 인증 사용자 전달
    Service->>DB: 회원 부서 및 부서 API Key 조회
    Service->>DB: 부서 마스킹 정책 조회
    Service->>DB: masking_report INSERT (ticket PK + original_text 원문)
    Note over Service,DB: 중복 ticket은 PK 제약으로 원자적으로 거부
    Service->>Regex: 정책에 포함된 항목만 탐지
    Service->>DB: masking_detail 저장, regex_status=DONE

    alt 파일이 있음
        Service->>MinIO: incoming 객체를 masking/{ticket}/source로 복사
        Service->>MinIO: 단기 presigned GET URL 생성
        Service->>NER: JSON POST(ticket + 원문 text + 파일 URL/메타데이터)
        NER-->>Service: HTTP 2xx 접수 응답
        Service-->>Client: PROM200_1
        NER->>Callback: 분석 완료 후 ticket + DONE/CANCEL + 탐지 결과
        Callback->>Callback: x-ner-callback-secret 검증
        Callback->>Service: 콜백 DTO 전달
        Service->>DB: 파일 탐지 상세 및 ner_status 반영
        Note over Service,DB: regex와 NER가 모두 DONE이면 status=DONE
    else 파일이 없음
        Note over Service,DB: ner_status는 생성 시 DONE
        Service-->>Client: PROM200_1
    end
```

## 계층별 책임 경계

| 구성요소 | 책임 |
|---|---|
| `ParsePrePromptJsonPipe` | multipart의 JSON 파싱 및 요청 형식 검증 |
| `PromptFileInspectorTransform` | 파일 형식·크기 검증과 SHA-256 계산 |
| `PromptMinioStorage` | 업로드 stream을 MinIO `incoming/`으로 전달 |
| `PromptController` | HTTP 입력을 받아 `PromptService`에 전달하고 응답을 통일 |
| `PromptService` | 분석 요청·권한·정책·정규식 탐지·NER 콜백 비즈니스 로직 수행 |
| `MaskingReportRepository` | 티켓 생성, 상세 저장 및 상태 전이 |
| `MinioObjectStorageService` | MinIO 객체 I/O와 서명 URL 생성 |
| `global/ner/NerClient` | 텍스트·서명 파일 URL을 NER 서버에 JSON POST |
| `NerCallbackController` | NER 콜백 입력을 `PromptService`에 전달 |

`incoming/` 객체는 요청 종료 시 보상 삭제합니다. 최종 파일은 티켓으로
결정되는 `masking/{ticket}/source`에 저장하므로 별도 DB 객체 키 컬럼이
필요하지 않습니다. 운영 환경에서는 `incoming/` prefix에 lifecycle 만료
정책을 적용해 비정상 종료로 남은 객체를 정리합니다.

`.env`의 `NER_SERVER_IP`에는 `127.0.0.1:8000` 또는
`https://ner.internal`처럼 NER 서버 주소 하나만 설정합니다. 현재 분석 API
경로는 명세가 없어 루트(`/`)를 사용하며, 경로 확정 시 `NerConfig`의
`NER_ANALYZE_PATH`만 변경합니다.

## 운영 전 정책

- `masking/` 원본에는 서비스 보존 기간에 맞춘 비공개 버킷 lifecycle 정책을 적용합니다.
- 운영 환경의 MinIO·NER·콜백 URL은 TLS 구간으로 구성합니다.
- DB 기록 직후 프로세스가 종료되어 `PENDING`이 남는 경우를 복구하려면
  Outbox 또는 주기적인 재처리 워커를 추가합니다.
- 요청 이후 회원 부서나 정책이 변경되어도 동일 기준으로 콜백을 처리해야 한다면
  요청 시점의 `department_id`와 정책 snapshot을 리포트에 보존합니다.
