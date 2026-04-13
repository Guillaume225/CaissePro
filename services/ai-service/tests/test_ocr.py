"""Tests for the OCR endpoint and service."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_health(client: AsyncClient):
    async with client:
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-service"


async def test_ocr_extract_no_file(client: AsyncClient):
    async with client:
        response = await client.post("/ai/ocr/extract")
    assert response.status_code == 422  # Missing required file


async def test_ocr_extract_invalid_extension(client: AsyncClient):
    async with client:
        response = await client.post(
            "/ai/ocr/extract",
            files={"file": ("test.exe", b"fake content", "application/octet-stream")},
        )
    assert response.status_code == 400
    assert "non supportée" in response.json()["detail"]
