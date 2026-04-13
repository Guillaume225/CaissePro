"""Tests for the categorization module."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.categorizer import CATEGORIES, CATEGORY_ID_BY_NAME, ExpenseCategorizer
from app.schemas.categorization import CategorizationResponse
from app.services.categorization_service import CategorizationService
from app.utils.nlp_preprocessing import build_combined_text, normalize_text, preprocess_french


# ── NLP preprocessing tests ──────────────────────────────
class TestNLPPreprocessing:
    def test_normalize_text_lowercases(self):
        assert normalize_text("ACHAT PAPIER") == "achat papier"

    def test_normalize_text_strips_special_chars(self):
        result = normalize_text("Facture #123 - TVA 19.25%")
        assert "#" not in result
        assert "%" not in result

    def test_normalize_text_collapses_whitespace(self):
        assert normalize_text("mot1    mot2   mot3") == "mot1 mot2 mot3"

    def test_preprocess_french_removes_stopwords(self):
        result = preprocess_french("achat de papier pour le bureau")
        assert "de" not in result.split()
        assert "pour" not in result.split()
        assert "le" not in result.split()

    def test_build_combined_text(self):
        result = build_combined_text("Achat papier A4", "Papeterie Centrale")
        assert len(result) > 0
        # Should contain content from both description and beneficiary
        assert "papier" in result or "papeterie" in result


# ── Category registry tests ──────────────────────────────
class TestCategoryRegistry:
    def test_all_categories_have_ids(self):
        assert len(CATEGORIES) == 10

    def test_reverse_mapping(self):
        for cat_id, cat_name in CATEGORIES.items():
            assert CATEGORY_ID_BY_NAME[cat_name] == cat_id

    def test_known_categories(self):
        assert "FOUR-BUR" in CATEGORIES
        assert "TRANSPORT" in CATEGORIES
        assert "DIVERS" in CATEGORIES
        assert CATEGORIES["FOUR-BUR"] == "Fournitures bureau"


# ── Categorizer model tests ──────────────────────────────
class TestExpenseCategorizer:
    def test_not_ready_without_model(self):
        cat = ExpenseCategorizer()
        assert not cat.is_ready

    def test_predict_raises_when_not_ready(self):
        cat = ExpenseCategorizer()
        with pytest.raises(RuntimeError, match="not loaded"):
            cat.predict("test", 1000)

    def test_load_nonexistent_file(self):
        cat = ExpenseCategorizer(model_path="/nonexistent/model.pkl")
        assert not cat.is_ready


# ── Categorization service tests ─────────────────────────
class TestCategorizationService:
    def _mock_categorizer(self, predictions: list[tuple[str, str, float]]):
        cat = MagicMock(spec=ExpenseCategorizer)
        cat.is_ready = True
        cat.predict.return_value = predictions
        return cat

    def test_predict_high_confidence(self, tmp_path):
        predictions = [
            ("FOUR-BUR", "Fournitures bureau", 0.85),
            ("DIVERS", "Divers", 0.10),
            ("TELECOM", "Télécom", 0.05),
        ]
        cat = self._mock_categorizer(predictions)
        service = CategorizationService(cat, tmp_path / "feedback.jsonl")

        result = service.predict("Achat papier", 35000)

        assert result.category_id == "FOUR-BUR"
        assert result.confidence == 0.85
        assert result.auto_categorized is True
        assert len(result.alternatives) == 2

    def test_predict_low_confidence_returns_suggestions(self, tmp_path):
        predictions = [
            ("FOUR-BUR", "Fournitures bureau", 0.45),
            ("DIVERS", "Divers", 0.30),
            ("TELECOM", "Télécom", 0.25),
        ]
        cat = self._mock_categorizer(predictions)
        service = CategorizationService(cat, tmp_path / "feedback.jsonl")

        result = service.predict("Quelque chose ambigu", 10000)

        assert result.auto_categorized is False
        assert len(result.alternatives) == 3  # Top-3 suggestions

    def test_store_feedback(self, tmp_path):
        cat = self._mock_categorizer([])
        feedback_path = tmp_path / "feedback.jsonl"
        service = CategorizationService(cat, feedback_path)

        count = service.store_feedback("Test", 1000, "Benef", "FOUR-BUR")
        assert count == 1

        count = service.store_feedback("Test2", 2000, "Benef2", "TRANSPORT")
        assert count == 2

        assert feedback_path.exists()
        lines = feedback_path.read_text(encoding="utf-8").strip().split("\n")
        assert len(lines) == 2

    def test_store_feedback_invalid_category(self, tmp_path):
        cat = self._mock_categorizer([])
        service = CategorizationService(cat, tmp_path / "feedback.jsonl")

        with pytest.raises(ValueError, match="Unknown category_id"):
            service.store_feedback("Test", 1000, "Benef", "INVALID_CAT")


# ── API endpoint tests ───────────────────────────────────
@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_categorize_returns_503_without_model(client: AsyncClient):
    """Without a trained model, the endpoint should return 503."""
    async with client:
        response = await client.post(
            "/ai/categorize",
            json={"description": "Achat papier", "amount": 35000, "beneficiary": "Test"},
        )
    assert response.status_code == 503
    assert "modèle" in response.json()["detail"].lower()


async def test_categorize_validation_error(client: AsyncClient):
    """Missing required fields should return 422."""
    async with client:
        response = await client.post("/ai/categorize", json={})
    assert response.status_code == 422


async def test_feedback_validation_error(client: AsyncClient):
    """Missing required fields should return 422."""
    async with client:
        response = await client.post("/ai/categorize/feedback", json={})
    assert response.status_code == 422
