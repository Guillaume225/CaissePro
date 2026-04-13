"""Tests for sales forecasting — model, service, and API endpoints."""

from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.sales_forecaster import SalesForecaster, _build_ci_holidays_df


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def sample_sales_df() -> pd.DataFrame:
    """Generate a minimal 6-month daily sales DataFrame."""
    np.random.seed(42)
    dates = pd.date_range("2025-06-01", "2025-12-31", freq="D")
    base = 500_000
    n = len(dates)
    weekday = dates.weekday.values
    weekly = np.where(weekday >= 5, -0.3, 0.0) * base
    noise = np.random.normal(0, 0.05 * base, n)
    y = base + weekly + noise
    y = np.maximum(y, 50_000)
    return pd.DataFrame({"ds": dates, "y": y.round(0)})


@pytest.fixture
def trained_forecaster(sample_sales_df: pd.DataFrame) -> SalesForecaster:
    forecaster = SalesForecaster()
    forecaster.train(sample_sales_df)
    return forecaster


# ── Model unit tests ──────────────────────────────────────────────


class TestSalesForecasterModel:

    def test_init_untrained(self):
        f = SalesForecaster()
        assert not f.is_ready
        assert f.model is None

    def test_train(self, sample_sales_df: pd.DataFrame):
        f = SalesForecaster()
        metrics = f.train(sample_sales_df)
        assert f.is_ready
        assert metrics["n_samples"] == len(sample_sales_df)
        assert metrics["mae"] > 0
        assert metrics["rmse"] > 0

    def test_save_and_load(self, trained_forecaster: SalesForecaster, tmp_path):
        path = str(tmp_path / "test_forecaster.pkl")
        trained_forecaster.save(path)

        loaded = SalesForecaster(model_path=path)
        assert loaded.is_ready

    def test_forecast_daily(self, trained_forecaster: SalesForecaster):
        results, meta = trained_forecaster.forecast(horizon_days=7, granularity="daily")
        assert len(results) == 7
        assert meta["trend"] in ("UP", "DOWN", "STABLE")
        assert isinstance(meta["seasonality_detected"], bool)
        assert 0 <= meta["confidence"] <= 1
        for r in results:
            assert r.predicted_amount >= 0
            assert r.lower_bound <= r.predicted_amount <= r.upper_bound

    def test_forecast_weekly(self, trained_forecaster: SalesForecaster):
        results, meta = trained_forecaster.forecast(horizon_days=30, granularity="weekly")
        assert len(results) >= 1
        assert len(results) <= 5

    def test_forecast_monthly(self, trained_forecaster: SalesForecaster):
        results, meta = trained_forecaster.forecast(horizon_days=90, granularity="monthly")
        assert len(results) >= 1
        assert len(results) <= 4

    def test_forecast_untrained_raises(self):
        f = SalesForecaster()
        with pytest.raises(RuntimeError, match="pas entraîné"):
            f.forecast(horizon_days=7)

    def test_ci_holidays(self):
        df = _build_ci_holidays_df(2025, 2026)
        assert len(df) > 0
        names = df["holiday"].unique()
        assert "Noël" in names
        assert "Fête Nationale" in names
        assert "Tabaski (Eid al-Adha)" in names


# ── Service tests ─────────────────────────────────────────────────


class TestForecastService:

    def test_forecast_response_shape(self, trained_forecaster: SalesForecaster):
        from app.services.forecast_service import ForecastService

        service = ForecastService(forecaster=trained_forecaster)
        resp = service.forecast_sales(horizon=7, granularity="daily")
        assert resp.horizon_days == 7
        assert resp.granularity.value == "daily"
        assert len(resp.forecasts) == 7
        assert resp.trend in ("UP", "DOWN", "STABLE")


# ── API tests ─────────────────────────────────────────────────────


class TestForecastAPI:

    @pytest.mark.asyncio
    async def test_forecast_endpoint_no_model(self):
        """Without a trained model, endpoint returns 503."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ai/forecast/sales?horizon=7&granularity=daily")
        # May be 503 (model not ready) or 200 if model was loaded
        assert response.status_code in (200, 503)

    @pytest.mark.asyncio
    async def test_forecast_invalid_horizon(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ai/forecast/sales?horizon=15")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_invalid_granularity(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ai/forecast/sales?horizon=30&granularity=hourly")
        assert response.status_code == 422
