"""Schemas for AI alerts endpoint."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class AlertType(str, Enum):
    ANOMALY = "ANOMALY"
    BUDGET = "BUDGET"
    RECEIVABLE = "RECEIVABLE"
    FORECAST = "FORECAST"


class AiAlert(BaseModel):
    id: str
    type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    entityType: str = ""
    entityId: str = ""
    entityRoute: str = ""
    createdAt: str
    isRead: bool = False


class AlertsResponse(BaseModel):
    data: list[AiAlert] = Field(default_factory=list)
