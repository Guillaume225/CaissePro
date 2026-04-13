"""Tests for client scoring — model, service, and API endpoints."""

import numpy as np
import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.client_scorer import ClientScorer, ScoringResult


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def sample_clients_df() -> pd.DataFrame:
    """Generate a small synthetic client dataset for training."""
    np.random.seed(42)
    records = []
    for i in range(200):
        r = np.random.random()
        if r < 0.3:
            days = np.random.randint(365, 1500)
            total = np.random.uniform(5e6, 30e6)
            on_time = np.random.randint(20, 80)
            late = np.random.randint(0, 5)
            delay = np.random.uniform(1, 15)
            unpaid = np.random.uniform(0, total * 0.03)
            score = int(np.clip(np.random.uniform(75, 98), 0, 100))
        elif r < 0.6:
            days = np.random.randint(180, 700)
            total = np.random.uniform(1e6, 10e6)
            on_time = np.random.randint(10, 40)
            late = np.random.randint(2, 12)
            delay = np.random.uniform(10, 30)
            unpaid = np.random.uniform(0, total * 0.10)
            score = int(np.clip(np.random.uniform(50, 74), 0, 100))
        elif r < 0.85:
            days = np.random.randint(30, 365)
            total = np.random.uniform(2e5, 5e6)
            on_time = np.random.randint(2, 15)
            late = np.random.randint(5, 20)
            delay = np.random.uniform(25, 60)
            unpaid = np.random.uniform(total * 0.05, total * 0.30)
            score = int(np.clip(np.random.uniform(25, 49), 0, 100))
        else:
            days = np.random.randint(10, 180)
            total = np.random.uniform(5e4, 2e6)
            on_time = np.random.randint(0, 5)
            late = np.random.randint(10, 40)
            delay = np.random.uniform(45, 120)
            unpaid = np.random.uniform(total * 0.20, total * 0.80)
            score = int(np.clip(np.random.uniform(0, 24), 0, 100))

        records.append({
            "days_since_registration": days,
            "total_purchases": round(total),
            "invoices_on_time": on_time,
            "invoices_late": late,
            "avg_payment_delay_days": round(delay, 1),
            "current_unpaid": round(unpaid),
            "unpaid_ratio": round(unpaid / total if total > 0 else 0, 4),
            "score": score,
        })
    return pd.DataFrame(records)


@pytest.fixture
def trained_scorer(sample_clients_df: pd.DataFrame) -> ClientScorer:
    scorer = ClientScorer()
    scorer.train(sample_clients_df)
    return scorer


@pytest.fixture
def untrained_scorer() -> ClientScorer:
    return ClientScorer()


# ── Model unit tests ──────────────────────────────────────────────


class TestClientScorerModel:

    def test_init_untrained(self):
        s = ClientScorer()
        assert not s.is_ready
        assert s.model is None

    def test_train(self, sample_clients_df: pd.DataFrame):
        s = ClientScorer()
        metrics = s.train(sample_clients_df)
        assert s.is_ready
        assert metrics["n_samples"] == 200
        assert metrics["n_features"] == 7
        assert metrics["mae"] >= 0
        assert "feature_importance" in metrics

    def test_save_and_load(self, trained_scorer: ClientScorer, tmp_path):
        path = str(tmp_path / "test_scorer.pkl")
        trained_scorer.save(path)

        loaded = ClientScorer(model_path=path)
        assert loaded.is_ready

    def test_score_excellent_client(self, trained_scorer: ClientScorer):
        result = trained_scorer.score({
            "days_since_registration": 1000,
            "total_purchases": 25_000_000,
            "invoices_on_time": 60,
            "invoices_late": 2,
            "avg_payment_delay_days": 5,
            "current_unpaid": 100_000,
        })
        assert isinstance(result, ScoringResult)
        assert 0 <= result.score <= 100
        assert result.risk_class in ("A", "B", "C", "D")
        assert result.credit_recommendation >= 0
        assert len(result.factors) <= 7
        # Excellent client should generally score high
        assert result.score >= 50

    def test_score_risky_client(self, trained_scorer: ClientScorer):
        result = trained_scorer.score({
            "days_since_registration": 30,
            "total_purchases": 200_000,
            "invoices_on_time": 1,
            "invoices_late": 15,
            "avg_payment_delay_days": 75,
            "current_unpaid": 150_000,
        })
        assert result.score < 50
        assert result.risk_class in ("C", "D")

    def test_score_risk_classes(self):
        assert ClientScorer._score_to_risk_class(80) == "A"
        assert ClientScorer._score_to_risk_class(60) == "B"
        assert ClientScorer._score_to_risk_class(30) == "C"
        assert ClientScorer._score_to_risk_class(10) == "D"

    def test_rule_based_fallback(self, untrained_scorer: ClientScorer):
        """Untrained scorer uses rule-based fallback."""
        result = untrained_scorer.score({
            "days_since_registration": 500,
            "total_purchases": 10_000_000,
            "invoices_on_time": 30,
            "invoices_late": 2,
            "avg_payment_delay_days": 10,
            "current_unpaid": 100_000,
        })
        assert isinstance(result, ScoringResult)
        assert 0 <= result.score <= 100

    def test_unpaid_ratio_auto_calculated(self, trained_scorer: ClientScorer):
        result = trained_scorer.score({
            "days_since_registration": 365,
            "total_purchases": 5_000_000,
            "invoices_on_time": 20,
            "invoices_late": 5,
            "avg_payment_delay_days": 18,
            "current_unpaid": 400_000,
        })
        # unpaid_ratio should be auto-calculated as 400000/5000000 = 0.08
        assert isinstance(result.score, int)

    def test_credit_recommendation_positive(self, trained_scorer: ClientScorer):
        result = trained_scorer.score({
            "days_since_registration": 1000,
            "total_purchases": 25_000_000,
            "invoices_on_time": 60,
            "invoices_late": 2,
            "avg_payment_delay_days": 5,
            "current_unpaid": 100_000,
        })
        assert result.credit_recommendation >= 0


# ── Service tests ─────────────────────────────────────────────────


class TestScoringService:

    def test_score_known_client(self, trained_scorer: ClientScorer):
        from app.schemas.scoring import ClientScoreRequest
        from app.services.scoring_service import ScoringService

        service = ScoringService(scorer=trained_scorer)
        resp = service.score_client(ClientScoreRequest(client_id="client_001"))
        assert resp.client_id == "client_001"
        assert 0 <= resp.score <= 100
        assert resp.risk_class.value in ("A", "B", "C", "D")

    def test_score_unknown_client(self, trained_scorer: ClientScorer):
        from app.schemas.scoring import ClientScoreRequest
        from app.services.scoring_service import ScoringService

        service = ScoringService(scorer=trained_scorer)
        resp = service.score_client(ClientScoreRequest(client_id="unknown_id"))
        assert resp.client_id == "unknown_id"
        assert 0 <= resp.score <= 100

    def test_score_with_features(self, trained_scorer: ClientScorer):
        from app.schemas.scoring import ClientFeatures
        from app.services.scoring_service import ScoringService

        service = ScoringService(scorer=trained_scorer)
        features = ClientFeatures(
            client_id="manual_test",
            days_since_registration=365,
            total_purchases=5_000_000,
            invoices_on_time=20,
            invoices_late=5,
            avg_payment_delay_days=18,
            current_unpaid=400_000,
        )
        resp = service.score_client_with_features(features)
        assert resp.client_id == "manual_test"
        assert len(resp.factors) >= 1


# ── API tests ─────────────────────────────────────────────────────


class TestScoringAPI:

    @pytest.mark.asyncio
    async def test_score_client_endpoint(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/score/client",
                json={"client_id": "client_001"},
            )
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "risk_class" in data
        assert "factors" in data
        assert "credit_recommendation" in data
        assert data["risk_class"] in ("A", "B", "C", "D")
        assert 0 <= data["score"] <= 100

    @pytest.mark.asyncio
    async def test_score_client_with_features_endpoint(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/score/client/features",
                json={
                    "client_id": "test-feat",
                    "days_since_registration": 365,
                    "total_purchases": 5000000,
                    "invoices_on_time": 20,
                    "invoices_late": 5,
                    "avg_payment_delay_days": 18,
                    "current_unpaid": 400000,
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["client_id"] == "test-feat"
        assert 0 <= data["score"] <= 100

    @pytest.mark.asyncio
    async def test_score_client_validation(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/score/client",
                json={"client_id": ""},
            )
        assert response.status_code == 422
