"""Training script for the anomaly detector model.

Generates synthetic expense data with known anomalies,
trains an Isolation Forest model, and saves it to disk.

Usage:
    python -m ml.training.train_anomaly_detector
"""

import logging
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.models.anomaly_detector import AnomalyDetector, ExpenseRecord

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Category configuration ────────────────────────────────────────
CATEGORIES = {
    "FOUR-BUR": {"mean": 25_000, "std": 15_000, "min": 1_000, "max": 150_000},
    "TRANSPORT": {"mean": 15_000, "std": 10_000, "min": 500, "max": 100_000},
    "MAINT": {"mean": 50_000, "std": 30_000, "min": 5_000, "max": 300_000},
    "SALAIRES": {"mean": 250_000, "std": 100_000, "min": 50_000, "max": 800_000},
    "CHG-SOC": {"mean": 80_000, "std": 40_000, "min": 10_000, "max": 300_000},
    "LOYERS": {"mean": 200_000, "std": 50_000, "min": 80_000, "max": 500_000},
    "ENERGIE": {"mean": 35_000, "std": 20_000, "min": 5_000, "max": 150_000},
    "TELECOM": {"mean": 20_000, "std": 10_000, "min": 3_000, "max": 80_000},
    "FORMATION": {"mean": 100_000, "std": 60_000, "min": 10_000, "max": 500_000},
}

BENEFICIARIES_BY_CATEGORY = {
    "FOUR-BUR": ["Papeterie Centrale", "Bureau Plus", "Librairie Moderne", "Office Depot", "Fourni-Pro"],
    "TRANSPORT": ["Total Energies", "Station MRS", "Taxi Express", "Transport Mbouombouo", "Uber"],
    "MAINT": ["Brico Service", "Maintenance Pro", "Plomberie Rapide", "Electricien Expert", "CleanPro"],
    "SALAIRES": ["Jean Kamga", "Marie Ndongo", "Pierre Fotso", "Aïcha Bello", "André Mbarga"],
    "CHG-SOC": ["CNPS", "NSIF", "Assurance Sanlam", "AXA Cameroun", "Mutuelle Santé"],
    "LOYERS": ["SCI Immobilier", "Agence Centrale", "Propriétaire Local", "Résidence Pro", "Bureau Central"],
    "ENERGIE": ["ENEO", "AES-SONEL", "ENERCA", "Groupe Électrogène SARL", "Énergie Verte"],
    "TELECOM": ["MTN Cameroun", "Orange Cameroun", "Nexttel", "CAMTEL", "Starlink Africa"],
    "FORMATION": ["Centre Formation", "ESSEC", "ISTIC", "FormaPro", "Cabinet RH Plus"],
}

USERS = [f"user_{i}" for i in range(1, 11)]


def generate_normal_expense(
    idx: int,
    base_date: datetime,
    day_offset_range: tuple[int, int] = (0, 90),
) -> ExpenseRecord:
    """Generate a normal expense record."""
    cat_id = random.choice(list(CATEGORIES.keys()))
    cat = CATEGORIES[cat_id]
    beneficiary = random.choice(BENEFICIARIES_BY_CATEGORY[cat_id])
    amount = max(cat["min"], min(cat["max"], random.gauss(cat["mean"], cat["std"])))
    amount = round(amount, 0)

    # Normal business hours: Mon-Fri, 8h-18h
    day_offset = random.randint(*day_offset_range)
    dt = base_date - timedelta(days=day_offset)
    # Ensure weekday
    while dt.weekday() >= 5:
        dt -= timedelta(days=1)
    hour = random.randint(8, 17)
    minute = random.randint(0, 59)
    dt = dt.replace(hour=hour, minute=minute, second=0)

    return ExpenseRecord(
        expense_id=f"normal_{idx}",
        amount=amount,
        category_id=cat_id,
        beneficiary=beneficiary,
        date=dt,
        user_id=random.choice(USERS),
    )


def generate_amount_outlier(idx: int, base_date: datetime) -> ExpenseRecord:
    """Generate an AMOUNT_OUTLIER anomaly."""
    cat_id = random.choice(list(CATEGORIES.keys()))
    cat = CATEGORIES[cat_id]
    # 3-8x the mean
    multiplier = random.uniform(3, 8)
    amount = round(cat["mean"] * multiplier, 0)
    beneficiary = random.choice(BENEFICIARIES_BY_CATEGORY[cat_id])

    day_offset = random.randint(0, 30)
    dt = base_date - timedelta(days=day_offset)
    dt = dt.replace(hour=random.randint(8, 17), minute=random.randint(0, 59))

    return ExpenseRecord(
        expense_id=f"anomaly_amount_{idx}",
        amount=amount,
        category_id=cat_id,
        beneficiary=beneficiary,
        date=dt,
        user_id=random.choice(USERS),
    )


def generate_frequency_spike(idx: int, base_date: datetime) -> list[ExpenseRecord]:
    """Generate a FREQUENCY_SPIKE anomaly (many expenses same user same day)."""
    user = random.choice(USERS)
    day_offset = random.randint(0, 30)
    dt = base_date - timedelta(days=day_offset)
    while dt.weekday() >= 5:
        dt -= timedelta(days=1)

    expenses = []
    for j in range(random.randint(12, 18)):
        cat_id = random.choice(list(CATEGORIES.keys()))
        cat = CATEGORIES[cat_id]
        amount = round(random.gauss(cat["mean"], cat["std"] * 0.5), 0)
        amount = max(cat["min"], amount)
        expenses.append(ExpenseRecord(
            expense_id=f"anomaly_freq_{idx}_{j}",
            amount=amount,
            category_id=cat_id,
            beneficiary=random.choice(BENEFICIARIES_BY_CATEGORY[cat_id]),
            date=dt.replace(hour=random.randint(8, 17), minute=random.randint(0, 59)),
            user_id=user,
        ))
    return expenses


def generate_duplicate_suspect(idx: int, base_date: datetime) -> list[ExpenseRecord]:
    """Generate a DUPLICATE_SUSPECT anomaly (same amount + beneficiary within 3 days)."""
    cat_id = random.choice(list(CATEGORIES.keys()))
    cat = CATEGORIES[cat_id]
    amount = round(random.gauss(cat["mean"], cat["std"]), 0)
    amount = max(cat["min"], amount)
    beneficiary = random.choice(BENEFICIARIES_BY_CATEGORY[cat_id])
    user = random.choice(USERS)

    day_offset = random.randint(1, 30)
    dt1 = base_date - timedelta(days=day_offset)
    dt2 = dt1 + timedelta(days=random.randint(0, 2), hours=random.randint(1, 6))

    return [
        ExpenseRecord(
            expense_id=f"anomaly_dup_{idx}_a",
            amount=amount,
            category_id=cat_id,
            beneficiary=beneficiary,
            date=dt1.replace(hour=10, minute=0),
            user_id=user,
        ),
        ExpenseRecord(
            expense_id=f"anomaly_dup_{idx}_b",
            amount=amount,
            category_id=cat_id,
            beneficiary=beneficiary,
            date=dt2.replace(hour=14, minute=30),
            user_id=user,
        ),
    ]


def generate_off_hours(idx: int, base_date: datetime) -> ExpenseRecord:
    """Generate an OFF_HOURS anomaly."""
    cat_id = random.choice(list(CATEGORIES.keys()))
    cat = CATEGORIES[cat_id]
    amount = round(random.gauss(cat["mean"], cat["std"]), 0)
    amount = max(cat["min"], amount)

    day_offset = random.randint(0, 30)
    dt = base_date - timedelta(days=day_offset)

    # Either weekend or night
    if random.random() < 0.5:
        # Weekend
        while dt.weekday() < 5:
            dt += timedelta(days=1)
        hour = random.randint(8, 17)
    else:
        # Night (0h-5h or 22h-23h)
        hour = random.choice([0, 1, 2, 3, 4, 22, 23])

    dt = dt.replace(hour=hour, minute=random.randint(0, 59))

    return ExpenseRecord(
        expense_id=f"anomaly_offhours_{idx}",
        amount=amount,
        category_id=cat_id,
        beneficiary=random.choice(BENEFICIARIES_BY_CATEGORY[cat_id]),
        date=dt,
        user_id=random.choice(USERS),
    )


def generate_unusual_beneficiary(idx: int, base_date: datetime) -> ExpenseRecord:
    """Generate an UNUSUAL_BENEFICIARY anomaly."""
    cat_id = random.choice(list(CATEGORIES.keys()))
    cat = CATEGORIES[cat_id]
    amount = round(random.gauss(cat["mean"], cat["std"]), 0)
    amount = max(cat["min"], amount)

    # Pick a beneficiary from a completely different category
    other_cats = [c for c in CATEGORIES if c != cat_id]
    other_cat = random.choice(other_cats)
    beneficiary = random.choice(BENEFICIARIES_BY_CATEGORY[other_cat])

    day_offset = random.randint(0, 30)
    dt = base_date - timedelta(days=day_offset)
    dt = dt.replace(hour=random.randint(8, 17), minute=random.randint(0, 59))

    return ExpenseRecord(
        expense_id=f"anomaly_beneficiary_{idx}",
        amount=amount,
        category_id=cat_id,
        beneficiary=beneficiary,
        date=dt,
        user_id=random.choice(USERS),
    )


def generate_dataset(
    n_normal: int = 800,
    n_amount_outliers: int = 15,
    n_frequency_spikes: int = 5,
    n_duplicates: int = 10,
    n_off_hours: int = 15,
    n_unusual_beneficiary: int = 15,
) -> list[ExpenseRecord]:
    """Generate synthetic dataset with known anomalies."""
    random.seed(42)
    np.random.seed(42)

    base_date = datetime(2026, 3, 25, 12, 0, 0)
    expenses: list[ExpenseRecord] = []

    # Normal expenses
    logger.info("Generating %d normal expenses...", n_normal)
    for i in range(n_normal):
        expenses.append(generate_normal_expense(i, base_date))

    # Amount outliers
    logger.info("Generating %d amount outlier anomalies...", n_amount_outliers)
    for i in range(n_amount_outliers):
        expenses.append(generate_amount_outlier(i, base_date))

    # Frequency spikes
    logger.info("Generating %d frequency spike anomalies...", n_frequency_spikes)
    for i in range(n_frequency_spikes):
        expenses.extend(generate_frequency_spike(i, base_date))

    # Duplicates
    logger.info("Generating %d duplicate suspect anomalies...", n_duplicates)
    for i in range(n_duplicates):
        expenses.extend(generate_duplicate_suspect(i, base_date))

    # Off hours
    logger.info("Generating %d off-hours anomalies...", n_off_hours)
    for i in range(n_off_hours):
        expenses.append(generate_off_hours(i, base_date))

    # Unusual beneficiaries
    logger.info("Generating %d unusual beneficiary anomalies...", n_unusual_beneficiary)
    for i in range(n_unusual_beneficiary):
        expenses.append(generate_unusual_beneficiary(i, base_date))

    # Sort by date
    expenses.sort(key=lambda e: e.date)

    total_anomalies = (
        n_amount_outliers
        + sum(random.randint(12, 18) for _ in range(n_frequency_spikes))  # approx
        + n_duplicates * 2
        + n_off_hours
        + n_unusual_beneficiary
    )
    logger.info(
        "Dataset: %d total expenses (~%d normal, ~%d anomalous)",
        len(expenses),
        n_normal,
        len(expenses) - n_normal,
    )

    return expenses


def main():
    logger.info("=" * 60)
    logger.info("TRAINING: Anomaly Detector (Isolation Forest)")
    logger.info("=" * 60)

    # Generate synthetic data
    expenses = generate_dataset()

    # Create & train model
    detector = AnomalyDetector(contamination=0.05)

    logger.info("Training Isolation Forest model...")
    metrics = detector.train(expenses, contamination=0.05)

    logger.info("Training metrics:")
    for k, v in metrics.items():
        logger.info("  %s: %s", k, f"{v:.4f}" if isinstance(v, float) else v)

    # Save model
    output_dir = Path("ml/models")
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "anomaly_detector.pkl"
    detector.save(str(model_path))
    logger.info("Model saved to %s", model_path)

    # Verify: test detection on a few known anomalies
    logger.info("\n" + "=" * 60)
    logger.info("VERIFICATION: Testing on sample expenses")
    logger.info("=" * 60)

    base_date = datetime(2026, 3, 25, 12, 0, 0)

    test_cases = [
        # Normal expense
        ExpenseRecord(
            expense_id="test_normal",
            amount=25_000,
            category_id="FOUR-BUR",
            beneficiary="Papeterie Centrale",
            date=base_date.replace(hour=10, minute=0),
            user_id="user_1",
        ),
        # Amount outlier
        ExpenseRecord(
            expense_id="test_amount_outlier",
            amount=500_000,
            category_id="FOUR-BUR",
            beneficiary="Papeterie Centrale",
            date=base_date.replace(hour=10, minute=0),
            user_id="user_1",
        ),
        # Off hours (3 AM)
        ExpenseRecord(
            expense_id="test_off_hours",
            amount=20_000,
            category_id="TELECOM",
            beneficiary="MTN Cameroun",
            date=base_date.replace(hour=3, minute=0),
            user_id="user_2",
        ),
        # Unusual beneficiary
        ExpenseRecord(
            expense_id="test_unusual_ben",
            amount=25_000,
            category_id="SALAIRES",
            beneficiary="Total Energies",
            date=base_date.replace(hour=14, minute=0),
            user_id="user_3",
        ),
    ]

    for tc in test_cases:
        result = detector.detect(tc, expenses[-100:])
        logger.info(
            "  [%s] anomaly=%s score=%.3f type=%-25s severity=%-6s | %s",
            tc.expense_id,
            result.is_anomaly,
            result.score,
            result.anomaly_type,
            result.severity,
            result.explanation[:80],
        )

    logger.info("\nDone! Model ready at: %s", model_path)


if __name__ == "__main__":
    main()
