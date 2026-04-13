"""Training script for the sales forecaster (Prophet).

Generates 18 months of synthetic daily sales data with:
- Weekly seasonality (lower on weekends)
- Yearly seasonality (peak Dec-Jan, lull Feb-Mar)
- Côte d'Ivoire holiday effects
- Random noise
- Trend growth

Usage:
    python -m ml.training.train_forecaster
"""

import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.models.sales_forecaster import SalesForecaster

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def generate_synthetic_sales(
    start_date: str = "2024-10-01",
    end_date: str = "2026-03-25",
    base_amount: float = 500_000,
) -> pd.DataFrame:
    """Generate realistic synthetic daily sales data."""
    np.random.seed(42)

    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    n = len(dates)

    # Trend: gentle growth 0.05% per day
    trend = np.linspace(0, 0.05 * n / 365, n) * base_amount

    # Yearly seasonality (peak in Dec, low in Feb-Mar)
    day_of_year = dates.dayofyear.values
    yearly = 0.15 * base_amount * np.sin(2 * np.pi * (day_of_year - 60) / 365)

    # Weekly seasonality (lower on weekends: Sat -30%, Sun -50%)
    weekday = dates.weekday.values
    weekly = np.where(weekday == 5, -0.30, np.where(weekday == 6, -0.50, 0.0)) * base_amount

    # Holiday boosts
    holiday_boost = np.zeros(n)
    ci_holidays_md = [
        (1, 1), (5, 1), (8, 7), (11, 15), (12, 25), (12, 24), (12, 31),
    ]
    for i, d in enumerate(dates):
        if (d.month, d.day) in ci_holidays_md:
            holiday_boost[i] = 0.4 * base_amount
        # Tabaski / end of Ramadan approximate boost
        if d.month == 4 and 8 <= d.day <= 12:
            holiday_boost[i] = 0.3 * base_amount

    # Random noise (10% of base)
    noise = np.random.normal(0, 0.10 * base_amount, n)

    # Combine
    sales = base_amount + trend + yearly + weekly + holiday_boost + noise
    sales = np.maximum(sales * 0.5, 50_000)  # Floor

    df = pd.DataFrame({"ds": dates, "y": sales.round(0)})
    return df


def main():
    logger.info("=" * 60)
    logger.info("TRAINING: Sales Forecaster (Prophet)")
    logger.info("=" * 60)

    # Generate synthetic data
    logger.info("Generating synthetic sales data (18 months)...")
    df = generate_synthetic_sales()
    logger.info("Generated %d data points: %s → %s", len(df), df["ds"].min().date(), df["ds"].max().date())
    logger.info("  Mean daily sales: %,.0f FCFA", df["y"].mean())
    logger.info("  Total sales: %,.0f FCFA", df["y"].sum())

    # Save synthetic data
    data_dir = Path("ml/data")
    data_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(data_dir / "synthetic_sales.csv", index=False)
    logger.info("Synthetic data saved to %s", data_dir / "synthetic_sales.csv")

    # Train
    logger.info("Training Prophet model...")
    forecaster = SalesForecaster()
    metrics = forecaster.train(df)

    logger.info("Training metrics:")
    for k, v in metrics.items():
        logger.info("  %s: %s", k, f"{v:,.4f}" if isinstance(v, float) else v)

    # Save model
    output_dir = Path("ml/models")
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "sales_forecaster.pkl"
    forecaster.save(str(model_path))
    logger.info("Model saved to %s", model_path)

    # Verify: generate a 30-day forecast
    logger.info("\n" + "=" * 60)
    logger.info("VERIFICATION: 30-day forecast")
    logger.info("=" * 60)

    results, meta = forecaster.forecast(horizon_days=30, granularity="daily")
    logger.info("Trend: %s | Seasonality: %s | Confidence: %.2f",
                meta["trend"], meta["seasonality_detected"], meta["confidence"])
    for r in results[:5]:
        logger.info("  %s: %,.0f FCFA [%,.0f — %,.0f]",
                     r.date, r.predicted_amount, r.lower_bound, r.upper_bound)
    if len(results) > 5:
        logger.info("  ... (%d more days)", len(results) - 5)

    logger.info("\nDone! Model ready at: %s", model_path)


if __name__ == "__main__":
    main()
