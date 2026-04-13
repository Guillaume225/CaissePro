"""Training script for the client scorer (XGBoost + SHAP).

Generates synthetic client data with realistic payment behaviors,
trains an XGBoost regressor, and saves the model.

Usage:
    python -m ml.training.train_scorer
"""

import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.models.client_scorer import ClientScorer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def generate_synthetic_clients(n: int = 1000) -> pd.DataFrame:
    """Generate synthetic client data with scores.

    Client profiles:
    - Excellent (A-class): old clients, high volume, few late payments
    - Good (B-class): decent clients, moderate behavior
    - Risky (C-class): newer, some late payments, unpaid
    - Bad (D-class): lots of late payments, high unpaid ratio
    """
    np.random.seed(42)

    records = []
    for i in range(n):
        # Assign profile distribution: 30% A, 30% B, 25% C, 15% D
        r = np.random.random()
        if r < 0.30:
            profile = "A"
        elif r < 0.60:
            profile = "B"
        elif r < 0.85:
            profile = "C"
        else:
            profile = "D"

        if profile == "A":
            days = np.random.randint(365, 2000)
            total = np.random.uniform(5_000_000, 50_000_000)
            on_time = np.random.randint(20, 100)
            late = np.random.randint(0, 5)
            delay = np.random.uniform(1, 15)
            unpaid = np.random.uniform(0, total * 0.03)
            base_score = np.random.uniform(75, 98)
        elif profile == "B":
            days = np.random.randint(180, 800)
            total = np.random.uniform(1_000_000, 15_000_000)
            on_time = np.random.randint(10, 50)
            late = np.random.randint(2, 12)
            delay = np.random.uniform(10, 30)
            unpaid = np.random.uniform(0, total * 0.10)
            base_score = np.random.uniform(50, 74)
        elif profile == "C":
            days = np.random.randint(30, 365)
            total = np.random.uniform(200_000, 5_000_000)
            on_time = np.random.randint(2, 15)
            late = np.random.randint(5, 20)
            delay = np.random.uniform(25, 60)
            unpaid = np.random.uniform(total * 0.05, total * 0.30)
            base_score = np.random.uniform(25, 49)
        else:  # D
            days = np.random.randint(10, 180)
            total = np.random.uniform(50_000, 2_000_000)
            on_time = np.random.randint(0, 5)
            late = np.random.randint(10, 40)
            delay = np.random.uniform(45, 120)
            unpaid = np.random.uniform(total * 0.20, total * 0.80)
            base_score = np.random.uniform(0, 24)

        unpaid_ratio = unpaid / total if total > 0 else 0

        # Add noise to score
        score = int(np.clip(base_score + np.random.normal(0, 3), 0, 100))

        records.append({
            "client_id": f"client_{i:04d}",
            "days_since_registration": days,
            "total_purchases": round(total, 0),
            "invoices_on_time": on_time,
            "invoices_late": late,
            "avg_payment_delay_days": round(delay, 1),
            "current_unpaid": round(unpaid, 0),
            "unpaid_ratio": round(unpaid_ratio, 4),
            "score": score,
        })

    return pd.DataFrame(records)


def main():
    logger.info("=" * 60)
    logger.info("TRAINING: Client Scorer (XGBoost + SHAP)")
    logger.info("=" * 60)

    # Generate synthetic data
    logger.info("Generating %d synthetic client records...", 1000)
    df = generate_synthetic_clients(1000)

    # Stats
    logger.info("Score distribution:")
    for cls, (lo, hi) in {"A": (75, 100), "B": (50, 74), "C": (25, 49), "D": (0, 24)}.items():
        count = len(df[(df["score"] >= lo) & (df["score"] <= hi)])
        logger.info("  Class %s (score %d-%d): %d clients (%.0f%%)", cls, lo, hi, count, count / 10)

    # Save synthetic data
    data_dir = Path("ml/data")
    data_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(data_dir / "synthetic_clients.csv", index=False)
    logger.info("Synthetic data saved to %s", data_dir / "synthetic_clients.csv")

    # Train
    logger.info("Training XGBoost model...")
    scorer = ClientScorer()
    metrics = scorer.train(df)

    logger.info("Training metrics:")
    for k, v in metrics.items():
        if isinstance(v, dict):
            logger.info("  %s:", k)
            for fk, fv in v.items():
                logger.info("    %s: %.4f", fk, fv)
        else:
            logger.info("  %s: %s", k, f"{v:.4f}" if isinstance(v, float) else v)

    # Save model
    output_dir = Path("ml/models")
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "client_scorer.pkl"
    scorer.save(str(model_path))
    logger.info("Model saved to %s", model_path)

    # Verify: score sample clients
    logger.info("\n" + "=" * 60)
    logger.info("VERIFICATION: Scoring sample clients")
    logger.info("=" * 60)

    test_clients = [
        {
            "name": "Excellent client",
            "days_since_registration": 1000,
            "total_purchases": 25_000_000,
            "invoices_on_time": 60,
            "invoices_late": 2,
            "avg_payment_delay_days": 5,
            "current_unpaid": 100_000,
        },
        {
            "name": "Risky client",
            "days_since_registration": 60,
            "total_purchases": 500_000,
            "invoices_on_time": 2,
            "invoices_late": 8,
            "avg_payment_delay_days": 55,
            "current_unpaid": 300_000,
        },
        {
            "name": "New client",
            "days_since_registration": 15,
            "total_purchases": 100_000,
            "invoices_on_time": 1,
            "invoices_late": 0,
            "avg_payment_delay_days": 10,
            "current_unpaid": 0,
        },
    ]

    for tc in test_clients:
        name = tc.pop("name")
        result = scorer.score(tc)
        logger.info(
            "  [%s] score=%d class=%s credit=%,.0f FCFA",
            name, result.score, result.risk_class, result.credit_recommendation,
        )
        for f in result.factors[:3]:
            logger.info("    → %s: impact=%.3f (%s)", f.name, f.impact, f.value)

    logger.info("\nDone! Model ready at: %s", model_path)


if __name__ == "__main__":
    main()
