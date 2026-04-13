"""Schemas for client scoring endpoints."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class RiskClass(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class ScoringFactor(BaseModel):
    name: str = Field(..., description="Nom du facteur")
    impact: float = Field(..., description="Impact SHAP (positif = augmente le score)")
    value: str = Field(..., description="Valeur du facteur pour ce client")


class ClientScoreRequest(BaseModel):
    client_id: str = Field(..., min_length=1, description="Identifiant du client")


class ClientFeatures(BaseModel):
    """Features brutes du client — fournies en input ou calculées en interne."""
    client_id: str
    days_since_registration: int = Field(..., ge=0, description="Ancienneté en jours")
    total_purchases: float = Field(..., ge=0, description="Volume total des achats (FCFA)")
    invoices_on_time: int = Field(..., ge=0, description="Factures payées à temps")
    invoices_late: int = Field(..., ge=0, description="Factures payées en retard")
    avg_payment_delay_days: float = Field(..., ge=0, description="Délai moyen de paiement (jours)")
    current_unpaid: float = Field(..., ge=0, description="Montant des impayés actuels (FCFA)")


class ClientScoreResponse(BaseModel):
    client_id: str
    score: int = Field(..., ge=0, le=100, description="Score global (0-100)")
    risk_class: RiskClass
    factors: list[ScoringFactor] = Field(..., description="Top facteurs explicatifs (SHAP)")
    credit_recommendation: float = Field(..., ge=0, description="Crédit recommandé (FCFA)")
