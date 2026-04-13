"""Client scoring endpoints — XGBoost + SHAP."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_scoring_service
from app.schemas.scoring import (
    ClientFeatures,
    ClientScoreRequest,
    ClientScoreResponse,
)
from app.services.scoring_service import ScoringService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/score", tags=["Client Scoring"])


@router.post("/client", response_model=ClientScoreResponse)
async def score_client(
    request: ClientScoreRequest,
    service: ScoringService = Depends(get_scoring_service),
) -> ClientScoreResponse:
    """Score un client et retourne sa classe de risque.

    Le scoring utilise XGBoost et les explications SHAP.
    - Score 0-100 (100 = meilleur client)
    - Classes: A (≥75), B (≥50), C (≥25), D (<25)
    """
    start = time.perf_counter()
    try:
        result = service.score_client(request)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Client scoring: %s → score=%d class=%s credit=%.0f (%dms)",
            request.client_id, result.score, result.risk_class.value,
            result.credit_recommendation, elapsed,
        )
        return result
    except Exception as exc:
        logger.exception("Scoring failed for client %s", request.client_id)
        raise HTTPException(status_code=500, detail="Erreur interne lors du scoring client.")


@router.post("/client/features", response_model=ClientScoreResponse)
async def score_client_with_features(
    features: ClientFeatures,
    service: ScoringService = Depends(get_scoring_service),
) -> ClientScoreResponse:
    """Score un client en fournissant directement ses features.

    Utile pour les simulations ou quand les données ne sont pas dans le système.
    """
    start = time.perf_counter()
    try:
        result = service.score_client_with_features(features)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Client scoring (features): %s → score=%d class=%s (%dms)",
            features.client_id, result.score, result.risk_class.value, elapsed,
        )
        return result
    except Exception as exc:
        logger.exception("Scoring with features failed for %s", features.client_id)
        raise HTTPException(status_code=500, detail="Erreur interne lors du scoring client.")
