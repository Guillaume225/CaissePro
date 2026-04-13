"""Narrative report generation endpoints."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_narrative_service
from app.schemas.narrative import NarrativeRequest, NarrativeResponse
from app.services.narrative_service import NarrativeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/narrative", tags=["Narrative Reports"])


@router.post("/generate", response_model=NarrativeResponse)
async def generate_narrative(
    request: NarrativeRequest,
    service: NarrativeService = Depends(get_narrative_service),
) -> NarrativeResponse:
    """Génère un rapport narratif à partir des données financières.

    Utilise Claude API pour la rédaction, avec fallback Jinja2
    si l'API n'est pas disponible.
    """
    start = time.perf_counter()
    try:
        result = service.generate_report(request)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Narrative: type=%s module=%s offline=%s insights=%d alerts=%d (%dms)",
            result.report_type.value, result.module.value,
            result.offline_mode, len(result.key_insights), len(result.alerts), elapsed,
        )
        return result
    except Exception:
        logger.exception("Narrative generation failed")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération du rapport.")
