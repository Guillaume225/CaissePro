"""Scoring service — orchestrates XGBoost-based client scoring."""

import logging

from app.models.client_scorer import ClientScorer
from app.schemas.scoring import (
    ClientFeatures,
    ClientScoreRequest,
    ClientScoreResponse,
    RiskClass,
    ScoringFactor,
)

logger = logging.getLogger(__name__)

# ── Demo client data (in production: fetched from sales-service DB) ──────
_DEMO_CLIENTS: dict[str, dict] = {
    "client_001": {
        "days_since_registration": 730,
        "total_purchases": 12_500_000,
        "invoices_on_time": 45,
        "invoices_late": 3,
        "avg_payment_delay_days": 8,
        "current_unpaid": 250_000,
    },
    "client_002": {
        "days_since_registration": 180,
        "total_purchases": 2_000_000,
        "invoices_on_time": 5,
        "invoices_late": 7,
        "avg_payment_delay_days": 42,
        "current_unpaid": 800_000,
    },
    "client_003": {
        "days_since_registration": 365,
        "total_purchases": 6_000_000,
        "invoices_on_time": 20,
        "invoices_late": 5,
        "avg_payment_delay_days": 18,
        "current_unpaid": 400_000,
    },
}


class ScoringService:
    def __init__(self, scorer: ClientScorer):
        self.scorer = scorer

    def score_client(self, request: ClientScoreRequest) -> ClientScoreResponse:
        features = self._get_client_features(request.client_id)

        result = self.scorer.score(features)

        return ClientScoreResponse(
            client_id=request.client_id,
            score=result.score,
            risk_class=RiskClass(result.risk_class),
            factors=[
                ScoringFactor(name=f.name, impact=f.impact, value=f.value)
                for f in result.factors
            ],
            credit_recommendation=result.credit_recommendation,
        )

    def score_client_with_features(self, features: ClientFeatures) -> ClientScoreResponse:
        feat_dict = {
            "days_since_registration": features.days_since_registration,
            "total_purchases": features.total_purchases,
            "invoices_on_time": features.invoices_on_time,
            "invoices_late": features.invoices_late,
            "avg_payment_delay_days": features.avg_payment_delay_days,
            "current_unpaid": features.current_unpaid,
        }

        result = self.scorer.score(feat_dict)

        return ClientScoreResponse(
            client_id=features.client_id,
            score=result.score,
            risk_class=RiskClass(result.risk_class),
            factors=[
                ScoringFactor(name=f.name, impact=f.impact, value=f.value)
                for f in result.factors
            ],
            credit_recommendation=result.credit_recommendation,
        )

    def _get_client_features(self, client_id: str) -> dict:
        """Get client features. In production this calls sales-service API."""
        if client_id in _DEMO_CLIENTS:
            return _DEMO_CLIENTS[client_id]
        # Default features for unknown clients
        return {
            "days_since_registration": 30,
            "total_purchases": 0,
            "invoices_on_time": 0,
            "invoices_late": 0,
            "avg_payment_delay_days": 0,
            "current_unpaid": 0,
        }
