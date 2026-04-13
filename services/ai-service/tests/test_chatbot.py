"""Tests for AI chatbot — engine, service, and API endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.chatbot_engine import ChatbotEngine
from app.schemas.chatbot import (
    ChatIntent,
    ChatMessage,
    ChatRequest,
    UserContext,
    UserRole,
)


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def engine() -> ChatbotEngine:
    """Chatbot engine in offline mode (no API key)."""
    return ChatbotEngine(openai_api_key=None)


@pytest.fixture
def service(engine: ChatbotEngine):
    from app.services.chatbot_service import ChatbotService
    return ChatbotService(engine=engine)


# ── Engine: Intent Detection ─────────────────────────────────────


class TestIntentDetection:

    def test_query_data_fr(self, engine: ChatbotEngine):
        assert engine.detect_intent("Combien de ventes aujourd'hui ?") == "query_data"

    def test_query_data_en(self, engine: ChatbotEngine):
        assert engine.detect_intent("How many transactions this week?") == "query_data"

    def test_explanation_fr(self, engine: ChatbotEngine):
        assert engine.detect_intent("Pourquoi cette baisse ?") == "explanation"

    def test_explanation_en(self, engine: ChatbotEngine):
        assert engine.detect_intent("Why did revenue drop?") == "explanation"

    def test_recommendation_fr(self, engine: ChatbotEngine):
        assert engine.detect_intent("Que faire pour améliorer les marges ?") == "recommendation"

    def test_recommendation_en(self, engine: ChatbotEngine):
        assert engine.detect_intent("What should I do to optimize costs?") == "recommendation"

    def test_general_intent(self, engine: ChatbotEngine):
        assert engine.detect_intent("Bonjour") == "general"

    def test_empty_keywords_general(self, engine: ChatbotEngine):
        assert engine.detect_intent("Salut, ça va ?") == "general"


# ── Engine: SQL Validation ───────────────────────────────────────


class TestSQLValidation:

    def test_valid_select(self):
        ok, err = ChatbotEngine.validate_sql("SELECT * FROM sales WHERE date > '2025-01-01'")
        assert ok
        assert err == ""

    def test_valid_select_with_join(self):
        ok, err = ChatbotEngine.validate_sql(
            "SELECT s.total, c.name FROM sales s JOIN clients c ON s.client_id = c.id"
        )
        assert ok

    def test_reject_insert(self):
        ok, err = ChatbotEngine.validate_sql("INSERT INTO sales VALUES (1, 100)")
        assert not ok
        assert "écriture" in err.lower() or "interdite" in err.lower()

    def test_reject_delete(self):
        ok, err = ChatbotEngine.validate_sql("DELETE FROM sales WHERE id = 1")
        assert not ok

    def test_reject_drop(self):
        ok, err = ChatbotEngine.validate_sql("DROP TABLE sales")
        assert not ok

    def test_reject_update(self):
        ok, err = ChatbotEngine.validate_sql("UPDATE sales SET total = 0")
        assert not ok

    def test_reject_truncate(self):
        ok, err = ChatbotEngine.validate_sql("TRUNCATE TABLE sales")
        assert not ok

    def test_reject_semicolon(self):
        ok, err = ChatbotEngine.validate_sql("SELECT * FROM sales; SELECT 1")
        assert not ok
        assert "suspects" in err.lower() or "commentaires" in err.lower()

    def test_reject_comment_injection(self):
        ok, err = ChatbotEngine.validate_sql("SELECT * FROM sales -- WHERE restricted = true")
        assert not ok

    def test_reject_union(self):
        ok, err = ChatbotEngine.validate_sql("SELECT * FROM sales UNION SELECT * FROM users")
        assert not ok
        assert "UNION" in err

    def test_reject_empty(self):
        ok, err = ChatbotEngine.validate_sql("")
        assert not ok

    def test_reject_non_select(self):
        ok, err = ChatbotEngine.validate_sql("GRANT ALL ON sales TO hacker")
        assert not ok


# ── Engine: RBAC ─────────────────────────────────────────────────


class TestRBAC:

    def test_allowed_tables(self):
        ok, denied = ChatbotEngine.check_rbac(
            query_tables=["sales", "transactions"],
            allowed_modules=["sales"],
        )
        assert ok
        assert denied == []

    def test_denied_tables(self):
        ok, denied = ChatbotEngine.check_rbac(
            query_tables=["sales", "expenses"],
            allowed_modules=["sales"],
        )
        assert not ok
        assert "expenses" in denied

    def test_all_modules_access(self):
        ok, denied = ChatbotEngine.check_rbac(
            query_tables=["sales", "expenses", "products", "clients"],
            allowed_modules=["sales", "expenses", "inventory", "clients"],
        )
        assert ok

    def test_extract_tables_simple(self):
        tables = ChatbotEngine.extract_tables("SELECT * FROM sales WHERE id = 1")
        assert tables == ["sales"]

    def test_extract_tables_join(self):
        tables = ChatbotEngine.extract_tables(
            "SELECT s.total FROM sales s JOIN clients c ON s.client_id = c.id"
        )
        assert "sales" in tables
        assert "clients" in tables


# ── Engine: Response Generation ──────────────────────────────────


class TestResponseGeneration:

    def test_offline_mode(self, engine: ChatbotEngine):
        assert not engine.is_online

    def test_fallback_response_sales(self, engine: ChatbotEngine):
        text, offline = engine.generate_response("Quel est le CA du jour ?")
        assert offline
        assert len(text) > 0
        assert "vente" in text.lower() or "module" in text.lower()

    def test_fallback_response_expenses(self, engine: ChatbotEngine):
        text, offline = engine.generate_response("Montrez-moi les dépenses")
        assert offline
        assert "dépense" in text.lower()

    def test_fallback_response_stock(self, engine: ChatbotEngine):
        text, offline = engine.generate_response("Quel est le niveau de stock ?")
        assert offline
        assert "stock" in text.lower() or "inventaire" in text.lower()

    def test_fallback_response_clients(self, engine: ChatbotEngine):
        text, offline = engine.generate_response("Qui sont mes meilleurs clients ?")
        assert offline
        assert "client" in text.lower()

    def test_fallback_response_anomaly(self, engine: ChatbotEngine):
        text, offline = engine.generate_response("Y a-t-il des anomalies détectées ?")
        assert offline
        assert "anomalie" in text.lower() or "détection" in text.lower()

    def test_fallback_response_generic(self, engine: ChatbotEngine):
        text, offline = engine.generate_response("Bonjour")
        assert offline
        assert "CaisseFlow" in text

    def test_system_prompt_contains_role(self):
        prompt = ChatbotEngine.build_system_prompt("admin", ["sales", "expenses"])
        assert "admin" in prompt
        assert "sales" in prompt
        assert "expenses" in prompt
        assert "FCFA" in prompt


# ── Service Tests ────────────────────────────────────────────────


class TestChatbotService:

    def test_ask_query_data(self, service):
        request = ChatRequest(
            message="Combien de ventes cette semaine ?",
            user_context=UserContext(role=UserRole.ADMIN),
        )
        response = service.ask(request)
        assert response.intent == ChatIntent.QUERY_DATA
        assert response.offline_mode
        assert len(response.response) > 0

    def test_ask_with_history(self, service):
        request = ChatRequest(
            message="Et pour les dépenses ?",
            conversation_history=[
                ChatMessage(role="user", content="Montre-moi les ventes"),
                ChatMessage(role="assistant", content="Voici les ventes..."),
            ],
            user_context=UserContext(role=UserRole.MANAGER),
        )
        response = service.ask(request)
        assert response.offline_mode
        assert len(response.response) > 0

    def test_ask_general(self, service):
        request = ChatRequest(
            message="Bonjour, qui es-tu ?",
            user_context=UserContext(role=UserRole.CASHIER, allowed_modules=["sales"]),
        )
        response = service.ask(request)
        assert response.intent == ChatIntent.GENERAL

    def test_suggested_actions_for_query(self, service):
        request = ChatRequest(
            message="Quel est le total des ventes ?",
            user_context=UserContext(
                role=UserRole.ADMIN,
                allowed_modules=["sales", "expenses"],
            ),
        )
        response = service.ask(request)
        assert len(response.suggested_actions) > 0

    def test_sources_detected(self, service):
        request = ChatRequest(
            message="Le chiffre d'affaires et les dépenses du mois",
            user_context=UserContext(
                role=UserRole.ADMIN,
                allowed_modules=["sales", "expenses", "inventory", "clients"],
            ),
        )
        response = service.ask(request)
        assert "sales" in response.sources
        assert "expenses" in response.sources


# ── API Tests ────────────────────────────────────────────────────


class TestChatbotAPI:

    @pytest.mark.asyncio
    async def test_ask_endpoint(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/chatbot/ask",
                json={
                    "message": "Combien de ventes aujourd'hui ?",
                    "user_context": {"role": "admin"},
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "intent" in data
        assert data["offline_mode"] is True

    @pytest.mark.asyncio
    async def test_ask_with_viewer_role(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/chatbot/ask",
                json={
                    "message": "Montrez-moi les clients",
                    "user_context": {
                        "role": "viewer",
                        "allowed_modules": ["sales"],
                    },
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] in ["query_data", "general"]

    @pytest.mark.asyncio
    async def test_ask_empty_message_rejected(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/chatbot/ask",
                json={"message": ""},
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_ask_default_context(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/chatbot/ask",
                json={"message": "Bonjour !"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == "general"
        assert "suggested_actions" in data
        assert "sources" in data
