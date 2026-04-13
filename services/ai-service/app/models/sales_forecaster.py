"""Sales forecasting model — Prophet-based time series predictions."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Ivory Coast public holidays ──────────────────────────────────
# Recurring holidays (month, day, name)
CI_FIXED_HOLIDAYS = [
    (1, 1, "Jour de l'An"),
    (5, 1, "Fête du Travail"),
    (8, 7, "Fête Nationale"),
    (11, 15, "Journée Nationale de la Paix"),
    (12, 25, "Noël"),
    (8, 15, "Assomption"),
    (11, 1, "Toussaint"),
]


def _build_ci_holidays_df(year_start: int, year_end: int) -> pd.DataFrame:
    """Build a DataFrame of Côte d'Ivoire holidays for Prophet."""
    rows: list[dict] = []
    for year in range(year_start, year_end + 1):
        for month, day, name in CI_FIXED_HOLIDAYS:
            try:
                rows.append({"holiday": name, "ds": pd.Timestamp(year, month, day)})
            except ValueError:
                pass
        # Approximate Tabaski / Eid al-Adha (shifts ~11 days/year)
        # Rough approximation starting from 2024-06-17
        base_tabaski = pd.Timestamp("2024-06-17")
        delta_years = year - 2024
        approx = base_tabaski - pd.Timedelta(days=int(delta_years * 10.8))
        approx = approx.replace(year=year)
        rows.append({"holiday": "Tabaski (Eid al-Adha)", "ds": approx})

        # Approximate Mouloud (Eid al-Mawlid)
        base_mouloud = pd.Timestamp("2024-09-16")
        approx_m = base_mouloud - pd.Timedelta(days=int(delta_years * 10.8))
        approx_m = approx_m.replace(year=year)
        rows.append({"holiday": "Mouloud", "ds": approx_m})

    return pd.DataFrame(rows)


@dataclass
class ForecastResult:
    date: str
    predicted_amount: float
    lower_bound: float
    upper_bound: float


class SalesForecaster:
    """Prophet-based sales forecaster with Côte d'Ivoire holidays."""

    def __init__(self, model_path: str | None = None):
        self.model = None
        self.is_ready = False
        self._holidays_df: pd.DataFrame | None = None

        if model_path:
            self.load(model_path)

    def load(self, model_path: str) -> None:
        """Load a trained Prophet model from disk."""
        bundle = joblib.load(model_path)
        self.model = bundle["model"]
        self._holidays_df = bundle.get("holidays_df")
        self.is_ready = True
        logger.info("Sales forecaster loaded from %s", model_path)

    def save(self, model_path: str) -> None:
        bundle = {
            "model": self.model,
            "holidays_df": self._holidays_df,
        }
        joblib.dump(bundle, model_path)
        logger.info("Sales forecaster saved to %s", model_path)

    def train(self, df: pd.DataFrame) -> dict:
        """Train Prophet on a DataFrame with columns (ds, y).

        Args:
            df: DataFrame with 'ds' (datetime) and 'y' (sales amount).

        Returns:
            Training metrics dict.
        """
        from prophet import Prophet

        df = df.copy()
        df["ds"] = pd.to_datetime(df["ds"])
        df = df.sort_values("ds")

        year_min = df["ds"].dt.year.min()
        year_max = df["ds"].dt.year.max() + 2
        self._holidays_df = _build_ci_holidays_df(year_min, year_max)

        self.model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            holidays=self._holidays_df,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0,
            interval_width=0.80,
        )
        self.model.fit(df)
        self.is_ready = True

        # Cross-validation metrics (simple residual on training set)
        fitted = self.model.predict(df[["ds"]])
        residuals = df["y"].values - fitted["yhat"].values
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        mean_y = float(np.mean(df["y"].values))

        return {
            "n_samples": len(df),
            "date_range": f"{df['ds'].min().date()} → {df['ds'].max().date()}",
            "mae": mae,
            "rmse": rmse,
            "mape": mae / mean_y if mean_y > 0 else 0,
        }

    def forecast(
        self,
        horizon_days: int = 30,
        granularity: str = "daily",
    ) -> tuple[list[ForecastResult], dict]:
        """Generate sales forecast.

        Returns:
            (list of ForecastResult, metadata dict with trend/seasonality/confidence)
        """
        if not self.is_ready or self.model is None:
            raise RuntimeError("Le modèle de prévision n'est pas entraîné. Lancez l'entraînement d'abord.")

        # Build future dataframe
        if granularity == "weekly":
            periods = max(1, horizon_days // 7)
            freq = "W"
        elif granularity == "monthly":
            periods = max(1, horizon_days // 30)
            freq = "MS"
        else:
            periods = horizon_days
            freq = "D"

        future = self.model.make_future_dataframe(periods=periods, freq=freq)
        prediction = self.model.predict(future)

        # Take only future rows (beyond training data)
        train_end = self.model.history["ds"].max()
        future_pred = prediction[prediction["ds"] > train_end].copy()

        results: list[ForecastResult] = []
        for _, row in future_pred.iterrows():
            results.append(ForecastResult(
                date=row["ds"].strftime("%Y-%m-%d"),
                predicted_amount=round(max(0, float(row["yhat"])), 2),
                lower_bound=round(max(0, float(row["yhat_lower"])), 2),
                upper_bound=round(max(0, float(row["yhat_upper"])), 2),
            ))

        # Determine trend
        if len(results) >= 2:
            first_val = results[0].predicted_amount
            last_val = results[-1].predicted_amount
            change_pct = (last_val - first_val) / first_val if first_val > 0 else 0
            if change_pct > 0.05:
                trend = "UP"
            elif change_pct < -0.05:
                trend = "DOWN"
            else:
                trend = "STABLE"
        else:
            trend = "STABLE"

        # Detect seasonality from model components
        seasonality_detected = bool(self.model.seasonalities)

        # Confidence based on prediction interval width relative to mean
        if results:
            avg_pred = np.mean([r.predicted_amount for r in results])
            avg_width = np.mean([r.upper_bound - r.lower_bound for r in results])
            confidence = max(0.1, min(1.0, 1.0 - (avg_width / (2 * avg_pred)) if avg_pred > 0 else 0.5))
        else:
            confidence = 0.5

        meta = {
            "trend": trend,
            "seasonality_detected": seasonality_detected,
            "confidence": round(float(confidence), 4),
        }

        return results, meta
