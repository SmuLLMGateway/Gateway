from fastapi import FastAPI

from app.domain.test.controller.test_controller import router as test_router
from app.resources.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
    )
    application.include_router(test_router)
    return application


app = create_app()
