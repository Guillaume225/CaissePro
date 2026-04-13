"""Schemas for AI chatbot assistant endpoints."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    CASHIER = "cashier"
    VIEWER = "viewer"


class ChatIntent(str, Enum):
    QUERY_DATA = "query_data"
    EXPLANATION = "explanation"
    RECOMMENDATION = "recommendation"
    GENERAL = "general"


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$", description="Rôle : user ou assistant")
    content: str = Field(..., min_length=1, max_length=4000)


class UserContext(BaseModel):
    role: UserRole = Field(UserRole.VIEWER, description="Rôle RBAC de l'utilisateur")
    tenant_id: str | None = Field(None, description="Identifiant du tenant")
    allowed_modules: list[str] = Field(
        default_factory=lambda: ["sales", "expenses", "inventory", "clients"],
        description="Modules auxquels l'utilisateur a accès",
    )


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="Question de l'utilisateur")
    conversation_history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=20,
        description="Historique de la conversation (max 20 messages)",
    )
    user_context: UserContext = Field(
        default_factory=UserContext,
        description="Contexte RBAC de l'utilisateur",
    )


class SuggestedAction(BaseModel):
    label: str = Field(..., description="Libellé de l'action suggérée")
    action_type: str = Field(..., description="Type : navigate, query, filter")
    payload: str = Field(..., description="Donnée associée (URL, query, filtre)")


class ChartData(BaseModel):
    chart_type: str = Field(..., description="Type de graphique : bar, line, pie, table")
    labels: list[str] = Field(default_factory=list)
    datasets: list[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str = Field(..., description="Réponse textuelle de l'assistant")
    intent: ChatIntent = Field(..., description="Intention détectée")
    data: dict | None = Field(None, description="Données structurées (optionnel)")
    chart_data: ChartData | None = Field(None, description="Données de graphique (optionnel)")
    suggested_actions: list[SuggestedAction] = Field(
        default_factory=list,
        description="Actions suggérées à l'utilisateur",
    )
    sources: list[str] = Field(
        default_factory=list,
        description="Sources / modules consultés",
    )
    offline_mode: bool = Field(False, description="True si réponse générée sans LLM")


# ── Module-aware chat schemas (used by /ai/chat) ──────────────────

class ModuleChatRequest(BaseModel):
    """Simplified chat request used by the frontend."""
    message: str = Field(..., min_length=1, max_length=2000, description="Question de l'utilisateur")
    module: str = Field("expense", description="Module actif (expense, fne, admin, decision, manager-caisse)")
    conversation_history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=20,
        description="Historique de la conversation (max 20 messages)",
    )
    user_role: str = Field("viewer", description="Rôle de l'utilisateur")
    allowed_modules: list[str] = Field(
        default_factory=lambda: ["expense"],
        description="Modules auxquels l'utilisateur a accès",
    )


class ModuleChatResponse(BaseModel):
    """Simplified chat response returned to the frontend."""
    id: str = Field(..., description="Identifiant unique du message")
    role: str = Field("assistant", description="Rôle (toujours assistant)")
    content: str = Field(..., description="Réponse textuelle")
    chart_data: ChartData | None = Field(None, alias="chartData", description="Graphique inline")
    suggested_actions: list[SuggestedAction] = Field(
        default_factory=list,
        description="Actions suggérées",
    )
    timestamp: str = Field(..., description="ISO timestamp")

    model_config = {"populate_by_name": True}


# ── Free-form conversational chatbot schemas ──────────────────────

class ConversationalRequest(BaseModel):
    """Request for the free-form conversational chatbot (ChatGPT-like)."""
    message: str = Field(..., min_length=1, max_length=4000, description="Message de l'utilisateur")
    conversation_history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=50,
        description="Historique de la conversation (max 50 messages)",
    )


class ConversationalResponse(BaseModel):
    """Response for the free-form conversational chatbot."""
    id: str = Field(..., description="Identifiant unique du message")
    role: str = Field("assistant", description="Rôle (toujours assistant)")
    content: str = Field(..., description="Réponse textuelle")
    timestamp: str = Field(..., description="ISO timestamp")
