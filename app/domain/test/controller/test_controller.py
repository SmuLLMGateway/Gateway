from typing import Annotated

from fastapi import APIRouter, Depends

from app.domain.test.dependencies.test_dependencies import get_test_service
from app.domain.test.dto.test_dto import TestRequest
from app.domain.test.service.test_service import TestService


router = APIRouter(tags=["test"])

TestServiceDependency = Annotated[
    TestService,
    Depends(get_test_service),
]


@router.post("/test", response_model=str, summary="테스트 API")
def test(
    request: TestRequest,
    service: TestServiceDependency,
) -> str:
    return service.test(request.message)
