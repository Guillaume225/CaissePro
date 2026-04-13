"""Module-aware AI chat endpoint — bridges frontend to chatbot engine."""

import logging
import re
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_chatbot_service
from app.prompts.module_prompts import get_module_prompt, get_module_suggestions
from app.schemas.chatbot import (
    ChatIntent,
    ConversationalRequest,
    ConversationalResponse,
    ModuleChatRequest,
    ModuleChatResponse,
    SuggestedAction,
)
from app.services.chatbot_service import ChatbotService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Module Chat"])


@router.post("", response_model=ModuleChatResponse)
async def module_chat(
    request: ModuleChatRequest,
    service: ChatbotService = Depends(get_chatbot_service),
) -> ModuleChatResponse:
    """Chat endpoint aligned with the frontend format.

    Accepts a simplified request with module context and returns
    a response shaped for the frontend ChatMessage type.
    """
    start = time.perf_counter()
    try:
        # 1. Detect intent
        intent_str = service.engine.detect_intent(request.message)
        intent = ChatIntent(intent_str)

        # 2. Build module-specific system prompt
        system_prompt = get_module_prompt(
            module=request.module,
            role=request.user_role,
        )

        # 3. Convert conversation history
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.conversation_history
        ]

        # 4. Generate response via Claude (or fallback)
        response_text, offline = service.engine.generate_response(
            message=request.message,
            conversation_history=history,
            system_prompt=system_prompt,
            module=request.module,
        )

        # 5. Parse inline actions from response
        actions = _extract_actions(response_text)
        # Clean action markers from the displayed text
        clean_text = _clean_action_markers(response_text)

        # 6. Build module-aware suggested actions
        if not actions:
            actions = _build_module_suggestions(intent, request.module, request.allowed_modules)

        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "ModuleChat: module=%s intent=%s offline=%s (%dms)",
            request.module, intent.value, offline, elapsed,
        )

        return ModuleChatResponse(
            id=f"bot-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            role="assistant",
            content=clean_text,
            chartData=None,
            suggested_actions=actions,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    except Exception:
        logger.exception("ModuleChat failed")
        raise HTTPException(status_code=500, detail="Erreur interne de l'assistant IA.")


@router.get("/suggestions")
async def get_suggestions(module: str = "expense") -> list[dict[str, str]]:
    """Return quick suggestions for a given module."""
    return get_module_suggestions(module)


_CONVERSATIONAL_SYSTEM_PROMPT = (
    "Tu es un assistant IA conversationnel de culture générale, intégré dans **CaisseFlow Pro**, "
    "un logiciel SaaS de gestion de caisse pour les entreprises en Afrique de l'Ouest.\n\n"
    "RÈGLES STRICTES :\n"
    "- Tu peux répondre à des questions de culture générale (histoire, science, géographie, maths, technologie, etc.).\n"
    "- Réponds en français par défaut, sauf si l'utilisateur écrit dans une autre langue.\n"
    "- Sois concis, clair et utile. Utilise le markdown (gras, listes).\n"
    "- Rappelle régulièrement à l'utilisateur que tu es l'assistant IA de CaisseFlow Pro "
    "et que pour les questions liées à la gestion de caisse, dépenses, ou l'application, "
    "il faut utiliser le volet **Agent IA**.\n"
    "- Sois empathique et professionnel."
)

_LIMIT_REACHED_MESSAGE = (
    "Vous avez atteint la limite de **10 questions** pour le chatbot conversationnel. 🎓\n\n"
    "N'oubliez pas que je suis avant tout l'assistant IA de **CaisseFlow Pro**, "
    "votre logiciel de gestion de caisse.\n\n"
    "Pour toute question liée à :\n"
    "- 💰 La gestion de caisse et dépenses\n"
    "- 📊 Les rapports et KPIs\n"
    "- 👥 La gestion des utilisateurs\n"
    "- 📋 Le suivi des opérations\n\n"
    "➡️ Basculez sur le volet **Agent IA** pour une assistance complète !\n\n"
    "*Vous pouvez effacer la conversation (🗑️) pour relancer 10 nouvelles questions.*"
)


_MAX_CHATBOT_QUESTIONS = 10


@router.post("/conversational", response_model=ConversationalResponse)
async def conversational_chat(
    request: ConversationalRequest,
    service: ChatbotService = Depends(get_chatbot_service),
) -> ConversationalResponse:
    """Free-form conversational chatbot endpoint.

    Limited to 10 questions per session. Answers general culture
    questions and reminds the user about the CaisseFlow Pro context.
    """
    start = time.perf_counter()
    try:
        # Count user messages in history to enforce limit
        user_msg_count = sum(
            1 for msg in request.conversation_history if msg.role == "user"
        )

        if user_msg_count >= _MAX_CHATBOT_QUESTIONS:
            return ConversationalResponse(
                id=f"conv-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                role="assistant",
                content=_LIMIT_REACHED_MESSAGE,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

        history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.conversation_history
        ]

        # Add remaining question count hint
        remaining = _MAX_CHATBOT_QUESTIONS - user_msg_count - 1
        context_hint = (
            f"\n\nINSTRUCTION SYSTÈME: L'utilisateur a encore {remaining} question(s) restante(s) "
            f"(sur {_MAX_CHATBOT_QUESTIONS}). "
        )
        if remaining <= 3:
            context_hint += (
                "Rappelle-lui gentiment qu'il approche de la limite et que pour les questions "
                "sur la gestion de caisse, il devrait utiliser le volet Agent IA."
            )

        system_prompt = _CONVERSATIONAL_SYSTEM_PROMPT + context_hint

        response_text, offline = service.engine.generate_response(
            message=request.message,
            conversation_history=history,
            system_prompt=system_prompt,
        )

        # Fallback conversationnel si offline
        if offline:
            response_text = _conversational_fallback(request.message)

        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Conversational: offline=%s questions=%d/%d (%dms)",
            offline, user_msg_count + 1, _MAX_CHATBOT_QUESTIONS, elapsed,
        )

        return ConversationalResponse(
            id=f"conv-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            role="assistant",
            content=response_text,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    except Exception:
        logger.exception("Conversational chat failed")
        raise HTTPException(status_code=500, detail="Erreur interne du chatbot.")


def _conversational_fallback(message: str) -> str:
    """Smart fallback for conversational chatbot when Claude is unavailable."""
    msg = message.lower()

    if any(w in msg for w in ["bonjour", "salut", "hello", "hi", "bonsoir", "coucou"]):
        return (
            "Bonjour ! Je suis votre assistant conversationnel CaisseFlow. "
            "Je peux discuter de tout sujet, vous aider avec des calculs, "
            "rédiger des textes, ou répondre à vos questions. "
            "Que puis-je faire pour vous ?"
        )
    if any(w in msg for w in ["merci", "thank"]):
        return "De rien ! N'hésitez pas si vous avez d'autres questions. 😊"
    if any(w in msg for w in ["qui es-tu", "qui êtes-vous", "tu es qui", "what are you", "qui es tu"]):
        return (
            "Je suis l'assistant IA conversationnel de **CaisseFlow Pro**. "
            "Je suis là pour discuter, répondre à vos questions, et vous aider "
            "dans vos tâches quotidiennes. Pensez à moi comme votre ChatGPT intégré !"
        )
    if any(w in msg for w in ["calcul", "combien fait", "addition", "somme", "pourcentage"]):
        return (
            "Je peux vous aider avec des calculs ! Malheureusement, "
            "le mode IA avancé n'est pas disponible pour le moment. "
            "Réessayez plus tard pour des calculs complexes, ou posez-moi "
            "la question différemment."
        )
    if any(w in msg for w in ["blague", "joke", "drôle", "humour", "rire"]):
        return (
            "Pourquoi les comptables ne font-ils jamais de régime ?\n\n"
            "Parce qu'ils aiment trop les **gros bilans** ! 😄\n\n"
            "Plus sérieusement, je suis là pour vous aider. Que souhaitez-vous savoir ?"
        )
    if any(w in msg for w in ["heure", "date", "jour", "time"]):
        return (
            "Je n'ai pas accès à l'heure en temps réel, mais vous pouvez "
            "la vérifier sur votre appareil. Je suis disponible 24h/24 pour "
            "répondre à vos questions !"
        )
    if any(w in msg for w in ["caisseflow", "application", "logiciel", "app"]):
        return (
            "**CaisseFlow Pro** est un logiciel SaaS de gestion de caisse complet :\n\n"
            "• **Module Dépenses** — Gestion des dépenses et clôture de caisse\n"
            "• **Module FNE** — Factures normalisées électroniques\n"
            "• **Module Admin** — Gestion des utilisateurs, rôles et sociétés\n"
            "• **Module Décisionnaire** — Validation et vue exécutive\n"
            "• **Module Manager Caisse** — Suivi des clôtures et comptabilité\n\n"
            "Que souhaitez-vous savoir de plus ?"
        )
    if any(w in msg for w in ["ça va", "comment vas", "how are"]):
        return (
            "Merci de demander ! En tant qu'IA, je fonctionne parfaitement bien. "
            "Et vous, comment puis-je vous aider aujourd'hui ?"
        )

    return (
        "Je suis votre assistant conversationnel CaisseFlow. "
        "En mode hors-ligne, mes capacités sont limitées, mais je fais de mon mieux.\n\n"
        "Essayez de me poser une question plus spécifique, ou attendez "
        "que la connexion IA soit rétablie pour des réponses plus complètes !"
    )


# ── Helpers ──────────────────────────────────────────────────────

_ACTION_RE = re.compile(r"\[ACTION:\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\]")


def _extract_actions(text: str) -> list[SuggestedAction]:
    """Extract [ACTION: type | label | payload] markers from LLM response."""
    actions = []
    for match in _ACTION_RE.finditer(text):
        actions.append(SuggestedAction(
            label=match.group(2).strip(),
            action_type=match.group(1).strip(),
            payload=match.group(3).strip(),
        ))
    return actions[:5]


def _clean_action_markers(text: str) -> str:
    """Remove [ACTION: ...] markers from displayed text."""
    return _ACTION_RE.sub("", text).strip()


def _build_module_suggestions(
    intent: ChatIntent,
    module: str,
    allowed_modules: list[str],
) -> list[SuggestedAction]:
    """Generate context-aware suggested actions based on module and intent."""
    suggestions: list[SuggestedAction] = []

    _MODULE_ACTIONS: dict[str, list[SuggestedAction]] = {
        "expense": [
            SuggestedAction(label="Voir les dépenses", action_type="navigate", payload="/expenses"),
            SuggestedAction(label="Créer une dépense", action_type="navigate", payload="/expenses/new"),
            SuggestedAction(label="Demandes en attente", action_type="navigate", payload="/pending-requests"),
        ],
        "fne": [
            SuggestedAction(label="Voir les factures FNE", action_type="navigate", payload="/fne/invoices"),
            SuggestedAction(label="Créer une facture", action_type="navigate", payload="/fne/invoices/new"),
            SuggestedAction(label="Solde vignettes", action_type="api_call", payload="GET /fne-invoices/sticker-balance"),
        ],
        "admin": [
            SuggestedAction(label="Gestion utilisateurs", action_type="navigate", payload="/admin/users"),
            SuggestedAction(label="Journaux d'audit", action_type="navigate", payload="/admin/audit"),
            SuggestedAction(label="Gestion des rôles", action_type="navigate", payload="/admin/roles"),
        ],
        "decision": [
            SuggestedAction(label="Validation dépenses", action_type="navigate", payload="/validation"),
            SuggestedAction(label="Dépenses du mois", action_type="navigate", payload="/month-expenses"),
            SuggestedAction(label="Liste des devis", action_type="navigate", payload="/devis"),
        ],
        "manager-caisse": [
            SuggestedAction(label="Dashboard manager", action_type="navigate", payload="/manager-caisse/dashboard"),
            SuggestedAction(label="Historique clôtures", action_type="navigate", payload="/manager-caisse/closing-history"),
            SuggestedAction(label="Écritures comptables", action_type="navigate", payload="/manager-caisse/accounting-entries"),
        ],
    }

    if module in _MODULE_ACTIONS:
        suggestions = _MODULE_ACTIONS[module][:3]

    return suggestions
