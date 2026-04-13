"""Schemas for sales forecast endpoints."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Granularity(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ForecastPoint(BaseModel):
    date: str = Field(..., description="Date ISO 8601")
    predicted_amount: float = Field(..., description="Montant prédit (FCFA)")
    lower_bound: float = Field(..., description="Borne inférieure (intervalle de confiance)")
    upper_bound: float = Field(..., description="Borne supérieure (intervalle de confiance)")


class ForecastResponse(BaseModel):
    forecasts: list[ForecastPoint]
    trend: str = Field(..., description="Tendance : UP, DOWN, STABLE")
    seasonality_detected: bool
    confidence: float = Field(..., ge=0, le=1, description="Confiance globale (0-1)")
    horizon_days: int
    granularity: Granularity
    product_id: str | None = None
