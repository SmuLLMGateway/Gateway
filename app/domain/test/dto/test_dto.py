from pydantic import BaseModel, Field


class TestRequest(BaseModel):
    message: str = Field(min_length=1, description="테스트 메시지")
