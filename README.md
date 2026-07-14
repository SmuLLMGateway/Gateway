# Enterprise LLM Gateway

기업용 LLM Gateway 개발을 위한 FastAPI 프로젝트 골격입니다.

## 포함된 프로젝트 설정

- FastAPI 애플리케이션 팩토리
- `.env` 기반 환경설정
- `pyproject.toml` 의존성 관리
- Uvicorn 개발 서버
- Docker 이미지 설정
- Pytest 기본 구동 테스트

## 로컬 실행

Python 3.12~3.14가 필요합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload
```

- API 문서: <http://localhost:8000/docs>

## 테스트

```bash
pytest
```

현재는 기능 API를 구현하지 않은 초기 세팅 상태입니다.
