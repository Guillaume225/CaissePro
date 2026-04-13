"""Forecast endpoints — sales forecasting with Prophet."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_forecast_service
from app.schemas.forecast import ForecastResponse, Granularity
from app.services.forecast_service import ForecastService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forecast", tags=["Forecast"])

ALLOWED_HORIZONS = {7, 30, 90}


@router.get("/sales", response_model=ForecastResponse)
async def forecast_sales(
    horizon: int = Query(30, description="Horizon de prévision en jours (7, 30, 90)"),
    granularity: Granularity = Query(Granularity.DAILY, description="Granularité"),
    product_id: str | None = Query(None, description="Filtrer par produit (optionnel)"),
    service: ForecastService = Depends(get_forecast_service),
) -> ForecastResponse:
    """Génère des prévisions de ventes.

    Utilise Prophet (Facebook) avec saisonnalité hebdomadaire/annuelle
    et les jours fériés de Côte d'Ivoire.
    """
    if horizon not in ALLOWED_HORIZONS:
        raise HTTPException(
            status_code=422,
            detail=f"Horizon doit être parmi {sorted(ALLOWED_HORIZONS)}. Reçu: {horizon}",
        )

    start = time.perf_counter()
    try:
        result = service.forecast_sales(
            horizon=horizon,
            granularity=granularity.value,
            product_id=product_id,
        )
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Forecast: horizon=%dd granularity=%s trend=%s confidence=%.2f (%dms)",
            horizon, granularity.value, result.trend, result.confidence, elapsed,
        )
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Forecast failed")
        raise HTTPException(status_code=500, detail="Erreur interne lors de la prévision.")
