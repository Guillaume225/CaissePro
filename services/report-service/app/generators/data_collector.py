"""Base report data collector — fetches data from other services."""

from typing import Any
from datetime import date, datetime

import httpx

from app.config import get_settings

settings = get_settings()

TIMEOUT = 30.0


def _headers(token: str | None = None) -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


async def fetch_expenses(
    params: dict[str, Any], token: str | None = None
) -> list[dict[str, Any]]:
    """Fetch expenses from expense-service."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{settings.expense_service_url}/expenses",
            params=params,
            headers=_headers(token),
        )
        if resp.status_code == 200:
            body = resp.json()
            return body.get("data", body) if isinstance(body, dict) else body
    return []


async def fetch_sales(
    params: dict[str, Any], token: str | None = None
) -> list[dict[str, Any]]:
    """Fetch sales from sales-service."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{settings.sales_service_url}/sales",
            params=params,
            headers=_headers(token),
        )
        if resp.status_code == 200:
            body = resp.json()
            return body.get("data", body) if isinstance(body, dict) else body
    return []


async def fetch_budgets(
    params: dict[str, Any], token: str | None = None
) -> list[dict[str, Any]]:
    """Fetch budgets from expense-service."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{settings.expense_service_url}/budgets",
            params=params,
            headers=_headers(token),
        )
        if resp.status_code == 200:
            body = resp.json()
            return body.get("data", body) if isinstance(body, dict) else body
    return []


async def fetch_receivables(
    params: dict[str, Any], token: str | None = None
) -> list[dict[str, Any]]:
    """Fetch receivables from sales-service."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{settings.sales_service_url}/receivables",
            params=params,
            headers=_headers(token),
        )
        if resp.status_code == 200:
            body = resp.json()
            return body.get("data", body) if isinstance(body, dict) else body
    return []


async def fetch_cash_register(
    register_id: str, token: str | None = None
) -> dict[str, Any] | None:
    """Fetch cash register details."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{settings.sales_service_url}/cash-registers/{register_id}",
            headers=_headers(token),
        )
        if resp.status_code == 200:
            return resp.json()
    return None


async def fetch_client(
    client_id: str, token: str | None = None
) -> dict[str, Any] | None:
    """Fetch client details from sales-service."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{settings.sales_service_url}/clients/{client_id}",
            headers=_headers(token),
        )
        if resp.status_code == 200:
            return resp.json()
    return None


def format_xof(amount: float | int) -> str:
    """Format amount in XOF style (space as thousand separator)."""
    return f"{int(amount):,}".replace(",", " ") + " XOF"


def parse_date(d: str | date | None) -> date | None:
    if d is None:
        return None
    if isinstance(d, date):
        return d
    return datetime.strptime(d, "%Y-%m-%d").date()


def aging_bracket(days_overdue: int) -> str:
    if days_overdue <= 30:
        return "0-30 jours"
    elif days_overdue <= 60:
        return "31-60 jours"
    elif days_overdue <= 90:
        return "61-90 jours"
    else:
        return "90+ jours"
