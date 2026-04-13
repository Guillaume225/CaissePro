"""Tests for auth module."""

import uuid

import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock
from jose import jwt

from app.auth import get_current_user
from app.config import get_settings

settings = get_settings()


class TestGetCurrentUser:
    def _make_request(self, token: str | None = None) -> MagicMock:
        req = MagicMock()
        if token:
            req.headers.get.return_value = f"Bearer {token}"
        else:
            req.headers.get.return_value = None
        return req

    def test_valid_token(self):
        user_id = str(uuid.uuid4())
        payload = {
            "sub": user_id,
            "email": "test@caisseflow.ci",
            "roleName": "ADMIN",
            "permissions": ["reports:generate"],
            "departmentId": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
        req = self._make_request(token)

        user = get_current_user(req, settings)
        assert user["id"] == user_id
        assert user["email"] == "test@caisseflow.ci"
        assert user["role_name"] == "ADMIN"

    def test_missing_auth_header(self):
        req = self._make_request(None)
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(req, settings)
        assert exc_info.value.status_code == 401

    def test_invalid_token(self):
        req = self._make_request("invalid-token")
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(req, settings)
        assert exc_info.value.status_code == 401

    def test_token_without_sub(self):
        payload = {"email": "no-sub@test.ci"}
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
        req = self._make_request(token)
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(req, settings)
        assert exc_info.value.status_code == 401

    def test_token_with_id_instead_of_sub(self):
        user_id = str(uuid.uuid4())
        payload = {"id": user_id, "email": "alt@test.ci"}
        token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
        req = self._make_request(token)

        user = get_current_user(req, settings)
        assert user["id"] == user_id
