"""AI Alerts endpoint — provides proactive alerts from AI analysis."""

import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter

from app.schemas.alerts import AiAlert, AlertSeverity, AlertType, AlertsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["AI Alerts"])


@router.get("", response_model=AlertsResponse)
async def get_alerts() -> AlertsResponse:
    """Retourne les alertes IA actives.

    Les alertes sont générées par les modules d'analyse :
    - Détection d'anomalies sur les dépenses
    - Surveillance des budgets
    - Prévisions de trésorerie
    - Créances en retard

    À terme, ce endpoint agrégera les résultats des analyses
    périodiques stockées en base. Pour l'instant, retourne
    une liste vide (les alertes sont générées à la demande).
    """
    logger.info("GET /alerts — returning current AI alerts")
    return AlertsResponse(data=[])
