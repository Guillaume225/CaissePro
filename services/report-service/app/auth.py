from typing import Any

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt

from app.config import Settings, get_settings


def get_current_user(
    request: Request, settings: Settings = Depends(get_settings)
) -> dict[str, Any]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant",
        )

    token = auth_header.split(" ", 1)[1]

    try:
        key = settings.jwt_public_key or settings.jwt_secret
        payload = jwt.decode(token, key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
        )

    user_id = payload.get("sub") or payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide: identifiant utilisateur manquant",
        )

    return {
        "id": user_id,
        "email": payload.get("email"),
        "role_name": payload.get("roleName"),
        "permissions": payload.get("permissions", []),
        "department_id": payload.get("departmentId"),
    }
