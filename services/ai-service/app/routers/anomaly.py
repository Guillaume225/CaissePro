"""Anomaly detection endpoints."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_anomaly_service
from app.schemas.anomaly import (
    AnomalyBatchRequest,
    AnomalyBatchResponse,
    AnomalyDetectRequest,
    AnomalyDetectResponse,
)
from app.services.anomaly_service import AnomalyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/anomaly", tags=["Anomaly Detection"])


@router.post("/detect", response_model=AnomalyDetectResponse)
async def detect_anomaly(
    request: AnomalyDetectRequest,
    service: AnomalyService = Depends(get_anomaly_service),
) -> AnomalyDetectResponse:
    """Détecte les anomalies dans une dépense.

    Retourne un score d'anomalie (0-1), le type d'anomalie détectée,
    une explication et le niveau de sévérité.

    Seuils:
    - score >= 0.7 : alerte (notification)
    - score >= 0.9 : blocage (nécessite validation DAF)
    """
    start = time.perf_counter()
    try:
        result = service.detect_single(request)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Anomaly detection for expense %s: score=%.3f type=%s (%dms)",
            request.expense_id,
            result.score,
            result.anomaly_type,
            elapsed,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Anomaly detection failed for expense %s", request.expense_id)
        raise HTTPException(status_code=500, detail="Erreur interne lors de la détection d'anomalies.")


@router.post("/batch", response_model=AnomalyBatchResponse)
async def detect_anomalies_batch(
    request: AnomalyBatchRequest,
    service: AnomalyService = Depends(get_anomaly_service),
) -> AnomalyBatchResponse:
    """Analyse en lot de plusieurs dépenses.

    Accepte jusqu'à 100 dépenses. Retourne les résultats individuels
    ainsi qu'un résumé (total, nombre d'anomalies, anomalies critiques).
    """
    start = time.perf_counter()
    try:
        result = service.detect_batch(request.expenses)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Batch anomaly detection: %d expenses, %d anomalies, %d high severity (%dms)",
            result.total,
            result.anomalies_count,
            result.high_severity_count,
            elapsed,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Batch anomaly detection failed")
        raise HTTPException(status_code=500, detail="Erreur interne lors de la détection d'anomalies en lot.")
