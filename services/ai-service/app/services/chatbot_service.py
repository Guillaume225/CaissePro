"""Chatbot service — orchestrates intent detection, RBAC, and response generation."""

import logging

from app.models.chatbot_engine import ChatbotEngine
from app.schemas.chatbot import (
    ChatIntent,
    ChatRequest,
    ChatResponse,
    ChartData,
    SuggestedAction,
)

logger = logging.getLogger(__name__)


class ChatbotService:
    def __init__(self, engine: ChatbotEngine):
        self.engine = engine

    def ask(self, request: ChatRequest) -> ChatResponse:
        """Process a user question and return a response."""
        # 1. Detect intent
        intent_str = self.engine.detect_intent(request.message)
        intent = ChatIntent(intent_str)

        # 2. Build system prompt with RBAC context
        system_prompt = self.engine.build_system_prompt(
            user_role=request.user_context.role.value,
            allowed_modules=request.user_context.allowed_modules,
        )

        # 3. Convert conversation history
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.conversation_history
        ]

        # 4. Generate response
        response_text, offline = self.engine.generate_response(
            message=request.message,
            conversation_history=history,
            system_prompt=system_prompt,
        )

        # 5. Build suggested actions based on intent
        suggested = self._build_suggestions(intent, request.user_context.allowed_modules)

        # 6. Determine sources
        sources = self._detect_sources(request.message, request.user_context.allowed_modules)

        return ChatResponse(
            response=response_text,
            intent=intent,
            data=None,
            chart_data=None,
            suggested_actions=suggested,
            sources=sources,
            offline_mode=offline,
        )

    @staticmethod
    def _build_suggestions(
        intent: ChatIntent,
        allowed_modules: list[str],
    ) -> list[SuggestedAction]:
        """Generate suggested follow-up actions."""
        suggestions = []

        if intent == ChatIntent.QUERY_DATA:
            if "sales" in allowed_modules:
                suggestions.append(SuggestedAction(
                    label="Voir les ventes du jour",
                    action_type="navigate",
                    payload="/dashboard/sales/today",
                ))
            if "expenses" in allowed_modules:
                suggestions.append(SuggestedAction(
                    label="Voir les dépenses récentes",
                    action_type="navigate",
                    payload="/dashboard/expenses/recent",
                ))
        elif intent == ChatIntent.RECOMMENDATION:
            suggestions.append(SuggestedAction(
                label="Générer un rapport",
                action_type="navigate",
                payload="/reports/generate",
            ))
        elif intent == ChatIntent.EXPLANATION:
            suggestions.append(SuggestedAction(
                label="Voir le tableau de bord",
                action_type="navigate",
                payload="/dashboard",
            ))

        return suggestions[:3]  # max 3 suggestions

    @staticmethod
    def _detect_sources(message: str, allowed_modules: list[str]) -> list[str]:
        """Detect which modules are referenced in the user's question."""
        msg_lower = message.lower()
        sources = []

        module_keywords = {
            "sales": ["vente", "chiffre", "ca", "revenue", "transaction", "sales"],
            "expenses": ["dépense", "expense", "coût", "cost", "charge"],
            "inventory": ["stock", "inventaire", "produit", "inventory"],
            "clients": ["client", "customer", "fidélité", "score"],
        }

        for module, keywords in module_keywords.items():
            if module in allowed_modules:
                if any(kw in msg_lower for kw in keywords):
                    sources.append(module)

        return sources
