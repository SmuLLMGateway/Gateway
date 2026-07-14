from app.main import app


def test_app_metadata() -> None:
    schema = app.openapi()

    assert schema["info"]["title"] == "Enterprise LLM Gateway"
    assert "/test" in schema["paths"]
    assert "post" in schema["paths"]["/test"]
