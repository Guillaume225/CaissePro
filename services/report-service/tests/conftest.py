"""Shared test fixtures and helpers."""

import os
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Override settings before importing app
os.environ["POSTGRES_DB"] = "test_reports"
os.environ["CELERY_BROKER_URL"] = "memory://"
os.environ["CELERY_RESULT_BACKEND"] = "cache+memory://"
os.environ["REPORTS_STORAGE_PATH"] = "/tmp/test_reports"
os.environ["JWT_SECRET"] = "test-secret"

from app.config import get_settings, Settings


@pytest.fixture
def settings() -> Settings:
    return get_settings()


@pytest.fixture
def mock_user() -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "email": "test@caisseflow.ci",
        "role_name": "ADMIN",
        "permissions": ["reports:generate", "reports:view"],
        "department_id": str(uuid.uuid4()),
    }


@pytest.fixture
def auth_token() -> str:
    from jose import jwt
    payload = {
        "sub": str(uuid.uuid4()),
        "email": "test@caisseflow.ci",
        "roleName": "ADMIN",
        "permissions": ["reports:generate"],
        "departmentId": str(uuid.uuid4()),
    }
    return jwt.encode(payload, "test-secret", algorithm="HS256")


@pytest.fixture
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}
