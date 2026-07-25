# Docker Compose 로컬 실행

이 구성은 Gateway, MySQL, MinIO를 한 번에 실행하고 Gateway가 사용할
비공개 MinIO 버킷을 자동으로 생성합니다.

## 1. 환경변수 준비

```bash
cp .env.docker.example .env.docker
```

`.env.docker`의 JWT, MySQL, MinIO, NER 공유값을 로컬 환경에 맞게
변경합니다. 이 파일은 Git에서 제외됩니다.

기본적으로 모든 공개 포트는 `127.0.0.1`에만 바인딩됩니다. 다른 장비에서
접근해야 하는 개발 환경에서만 `BIND_ADDRESS`를 별도로 변경합니다.

기본 NER 설정은 호스트의 `8000` 포트를 가리킵니다.

```env
NER_SERVER_IP=host.docker.internal:8000
```

## 2. 전체 서비스 실행

```bash
docker compose --env-file .env.docker up --build --detach --wait
```

| 서비스 | 주소 |
|---|---|
| Gateway | `http://localhost:3000` |
| Swagger | `http://localhost:3000/api-docs` |
| MySQL | `localhost:3307` |
| MinIO S3 API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |

`minio-init` 컨테이너는 MinIO가 준비된 뒤 `MINIO_BUCKET` 버킷을 생성하고
정상 종료합니다. 버킷은 기본적으로 비공개입니다.

## 3. 실행 상태와 로그 확인

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --follow gateway mysql minio minio-init
```

Gateway 컨테이너는 MySQL healthcheck와 MinIO 버킷 초기화가 모두 끝난 뒤
시작합니다. TypeORM의 `synchronize: true` 설정으로 빈 데이터베이스에
테이블은 생성되지만 회원, 부서, API Key, 정책 데이터는 생성되지 않습니다.

## 4. MinIO 내부 주소와 공개 주소

Gateway의 저장 작업은 Docker DNS 주소를 사용합니다.

```env
MINIO_ENDPOINT=minio
MINIO_PORT=9000
```

NER 서버에 전달되는 presigned URL은 별도의 공개 주소 설정을 사용합니다.
NER가 호스트에서 실행되는 기본 구성은 다음과 같습니다.

```env
MINIO_PUBLIC_ENDPOINT=localhost
MINIO_PUBLIC_PORT=9000
MINIO_PUBLIC_USE_SSL=false
```

NER 서버가 다른 장비에서 실행된다면 `localhost` 대신 NER 서버가 접근할
수 있는 Gateway 호스트의 IP 또는 DNS 이름을 입력하고 MinIO API 포트를
개방해야 합니다. NER가 `llm-gateway-network`에 참여하는 컨테이너라면
`MINIO_PUBLIC_ENDPOINT=minio`를 사용할 수 있습니다.

## 5. 종료와 데이터 삭제

컨테이너만 종료하고 MySQL·MinIO 데이터는 유지합니다.

```bash
docker compose --env-file .env.docker down
```

로컬 데이터까지 전부 삭제할 때만 `--volumes`를 사용합니다.

```bash
docker compose --env-file .env.docker down --volumes
```

이 Compose 구성과 고정된 MinIO Community 이미지는 로컬 개발·테스트용입니다.
운영 환경에서는 해당 이미지를 그대로 사용하지 말고, 기본 자격증명 대신 MinIO
전용 서비스 계정을 사용하며 TypeORM `synchronize` 대신 migration을 적용해야
합니다.
