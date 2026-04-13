"""AI Chatbot assistant endpoints."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_chatbot_service
from app.schemas.chatbot import ChatRequest, ChatResponse
from app.services.chatbot_service import ChatbotService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])


@router.post("/ask", response_model=ChatResponse)
async def ask_assistant(
    request: ChatRequest,
    service: ChatbotService = Depends(get_chatbot_service),
) -> ChatResponse:
    """Pose une question à l'assistant IA.

    L'assistant détecte l'intention, applique les contrôles RBAC,
    et génère une réponse via Claude API ou en mode hors-ligne.
    """
    start = time.perf_counter()
    try:
        result = service.ask(request)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Chatbot: intent=%s offline=%s sources=%s (%dms)",
            result.intent.value, result.offline_mode, result.sources, elapsed,
        )
        return result
    except Exception as exc:
        logger.exception("Chatbot failed")
        raise HTTPException(status_code=500, detail="Erreur interne de l'assistant IA.")
