"""Forecast service — orchestrates Prophet-based sales forecasting."""

import logging

from app.models.sales_forecaster import SalesForecaster
from app.schemas.forecast import (
    ForecastPoint,
    ForecastResponse,
    Granularity,
)

logger = logging.getLogger(__name__)


class ForecastService:
    def __init__(self, forecaster: SalesForecaster):
        self.forecaster = forecaster

    def forecast_sales(
        self,
        horizon: int = 30,
        granularity: str = "daily",
        product_id: str | None = None,
    ) -> ForecastResponse:
        results, meta = self.forecaster.forecast(
            horizon_days=horizon,
            granularity=granularity,
        )

        points = [
            ForecastPoint(
                date=r.date,
                predicted_amount=r.predicted_amount,
                lower_bound=r.lower_bound,
                upper_bound=r.upper_bound,
            )
            for r in results
        ]

        return ForecastResponse(
            forecasts=points,
            trend=meta["trend"],
            seasonality_detected=meta["seasonality_detected"],
            confidence=meta["confidence"],
            horizon_days=horizon,
            granularity=Granularity(granularity),
            product_id=product_id,
        )
