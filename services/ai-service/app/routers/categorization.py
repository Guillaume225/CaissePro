"""Categorization endpoints — POST /ai/categorize and /ai/categorize/feedback."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_categorization_service
from app.schemas.categorization import (
    CategorizationRequest,
    CategorizationResponse,
    FeedbackRequest,
    FeedbackResponse,
)
from app.services.categorization_service import CategorizationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/categorize", tags=["Categorization"])


@router.post("", response_model=CategorizationResponse)
async def categorize_expense(
    body: CategorizationRequest,
    service: CategorizationService = Depends(get_categorization_service),
):
    """Predict expense category from description, amount and beneficiary.

    If confidence < 60%, returns the top-3 suggestions with auto_categorized=false.
    """
    if not service.categorizer.is_ready:
        raise HTTPException(
            status_code=503,
            detail="Le modèle de catégorisation n'est pas chargé. Lancez l'entraînement d'abord.",
        )

    return service.predict(
        description=body.description,
        amount=body.amount,
        beneficiary=body.beneficiary,
    )


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    body: FeedbackRequest,
    service: CategorizationService = Depends(get_categorization_service),
):
    """Submit a correction to improve future categorization accuracy."""
    try:
        count = service.store_feedback(
            description=body.description,
            amount=body.amount,
            beneficiary=body.beneficiary,
            correct_category_id=body.correct_category_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return FeedbackResponse(
        success=True,
        message="Feedback enregistré avec succès",
        feedback_count=count,
    )
