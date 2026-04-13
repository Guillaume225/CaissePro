"""Schemas for anomaly detection endpoints."""

from enum import Enum

from pydantic import BaseModel, Field


class AnomalySeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class AnomalyType(str, Enum):
    AMOUNT_OUTLIER = "AMOUNT_OUTLIER"
    FREQUENCY_SPIKE = "FREQUENCY_SPIKE"
    DUPLICATE_SUSPECT = "DUPLICATE_SUSPECT"
    OFF_HOURS = "OFF_HOURS"
    UNUSUAL_BENEFICIARY = "UNUSUAL_BENEFICIARY"


class AnomalyDetectRequest(BaseModel):
    expense_id: str = Field(..., min_length=1, description="Identifiant de la dépense")
    amount: float = Field(..., gt=0, description="Montant de la dépense")
    category_id: str = Field(..., min_length=1, description="Identifiant de la catégorie")
    beneficiary: str = Field(..., min_length=1, description="Nom du bénéficiaire")
    date: str = Field(..., description="Date de la dépense (ISO 8601)")
    user_id: str = Field(..., min_length=1, description="Identifiant de l'utilisateur")


class AnomalyDetectResponse(BaseModel):
    expense_id: str
    is_anomaly: bool
    score: float = Field(..., ge=0, le=1, description="Score d'anomalie (0 = normal, 1 = très anormal)")
    anomaly_type: str = Field(..., description="Type d'anomalie détectée")
    explanation: str = Field(..., description="Explication en français")
    severity: AnomalySeverity


class AnomalyBatchRequest(BaseModel):
    expenses: list[AnomalyDetectRequest] = Field(
        ..., min_length=1, max_length=100, description="Liste de dépenses à analyser"
    )


class AnomalyBatchResponse(BaseModel):
    results: list[AnomalyDetectResponse]
    total: int
    anomalies_count: int
    high_severity_count: int
