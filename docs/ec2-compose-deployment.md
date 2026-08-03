# EC2 Compose 배포

`compose.ec2.yaml`은 EC2 호스트에 설치한 MySQL을 사용하고 Gateway, MinIO,
버킷 초기화 컨테이너만 실행한다. MySQL 컨테이너는 포함하지 않는다.

## 1. MySQL 준비

Gateway 컨테이너는 Docker bridge 네트워크에서 호스트 MySQL로 접속한다. MySQL에
DB와 전용 계정을 만들고, 컨테이너 대역에서의 접속을 허용한다. `<DB_PASSWORD>`를
실제 강력한 비밀번호로 바꾼다.

```bash
sudo mysql
```

```sql
CREATE DATABASE IF NOT EXISTS llm_gateway
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'gateway'@'172.%' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON llm_gateway.* TO 'gateway'@'172.%';
FLUSH PRIVILEGES;
```

`sudo ss -lntp | grep 3306`로 MySQL 리스닝 주소를 확인한다.
`bind-address=127.0.0.1`이면 Docker bridge에서 접속할 수 없으므로
`/etc/mysql/mysql.conf.d/mysqld.cnf`의 `bind-address`를 `0.0.0.0` 또는
`docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}'`의
출력값으로 변경한 뒤 MySQL을 재시작한다. MySQL 보안 그룹과 UFW에는 외부 3306을
허용하지 않는다.

## 2. 환경 변수 파일 준비

```bash
mkdir -p /opt/ll-gateway
cp .env.ec2.example /opt/ll-gateway/.env.ec2
chmod 600 /opt/ll-gateway/.env.ec2
```

`.env.ec2`의 모든 `change-this-...` 값을 교체한다. NER가 같은 EC2에서 실행 중이면
기본값을 유지한다. NER가 다른 서버에 있으면 `MINIO_PUBLIC_ENDPOINT`를 NER가
도달 가능한 private DNS 또는 IP로 변경하고, MinIO API 포트 9000을 그 보안 그룹에만
허용한다.

## 3. 실행 및 확인

이전에 `docker run --name minio ...`로 MinIO를 실행했다면, Compose와 포트가
충돌하지 않도록 컨테이너만 제거한다. `minio-data` 볼륨은 Compose가 그대로
재사용하므로 삭제하지 않는다.

```bash
docker stop minio && docker rm minio
```

```bash
docker compose --env-file /opt/ll-gateway/.env.ec2 -f compose.ec2.yaml up -d --wait
docker compose --env-file /opt/ll-gateway/.env.ec2 -f compose.ec2.yaml ps
docker compose --env-file /opt/ll-gateway/.env.ec2 -f compose.ec2.yaml logs -f gateway minio minio-init
```

Gateway는 ALB 보안 그룹에서만 3000 포트를 허용한다. MinIO API와 Console은 기본값으로
localhost에만 바인딩한다.

## 4. 이미지 업데이트

```bash
docker compose --env-file /opt/ll-gateway/.env.ec2 -f compose.ec2.yaml pull gateway
docker compose --env-file /opt/ll-gateway/.env.ec2 -f compose.ec2.yaml up -d --wait gateway
```
