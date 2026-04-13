"""Anomaly detector model — Isolation Forest for unusual transaction detection."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


@dataclass
class ExpenseRecord:
    """A single expense record used for feature computation."""
    expense_id: str
    amount: float
    category_id: str
    beneficiary: str
    date: datetime
    user_id: str


@dataclass
class AnomalyResult:
    """Result of anomaly detection for a single expense."""
    is_anomaly: bool
    score: float
    anomaly_type: str
    explanation: str
    severity: str


@dataclass
class CategoryStats:
    """Running statistics for a category."""
    mean: float = 0.0
    std: float = 1.0
    count: int = 0


class AnomalyDetector:
    """Isolation Forest-based anomaly detector for financial transactions.

    Features:
        1. z-score du montant par catégorie
        2. Fréquence des dépenses du même bénéficiaire (30 jours)
        3. Heure de création
        4. Jour de la semaine
        5. Écart par rapport à la moyenne historique de la catégorie
        6. Nombre de dépenses du même user ce jour
    """

    ANOMALY_TYPES = {
        "AMOUNT_OUTLIER": "Montant anormalement élevé pour cette catégorie",
        "FREQUENCY_SPIKE": "Nombre inhabituel de dépenses",
        "DUPLICATE_SUSPECT": "Dépense similaire récente détectée (même montant + bénéficiaire)",
        "OFF_HOURS": "Dépense créée en dehors des heures de bureau",
        "UNUSUAL_BENEFICIARY": "Bénéficiaire jamais vu dans cette catégorie",
    }

    # Office hours: 7h-19h, Monday-Friday
    OFFICE_HOUR_START = 7
    OFFICE_HOUR_END = 19
    OFFICE_DAYS = {0, 1, 2, 3, 4}  # Mon-Fri

    def __init__(
        self,
        model_path: str | None = None,
        contamination: float = 0.05,
        alert_threshold: float = 0.7,
        block_threshold: float = 0.9,
    ):
        self.contamination = contamination
        self.alert_threshold = alert_threshold
        self.block_threshold = block_threshold
        self.model: IsolationForest | None = None
        self.scaler: StandardScaler | None = None
        self.category_stats: dict[str, CategoryStats] = {}
        self.category_beneficiaries: dict[str, set[str]] = {}
        self.is_ready = False

        if model_path:
            self.load(model_path)

    def load(self, model_path: str) -> None:
        """Load a trained model from disk."""
        bundle = joblib.load(model_path)
        self.model = bundle["model"]
        self.scaler = bundle["scaler"]
        self.category_stats = bundle.get("category_stats", {})
        self.category_beneficiaries = bundle.get("category_beneficiaries", {})
        self.alert_threshold = bundle.get("alert_threshold", 0.7)
        self.block_threshold = bundle.get("block_threshold", 0.9)
        self.is_ready = True
        logger.info("Anomaly detector model loaded from %s", model_path)

    def save(self, model_path: str) -> None:
        """Save model to disk."""
        bundle = {
            "model": self.model,
            "scaler": self.scaler,
            "category_stats": self.category_stats,
            "category_beneficiaries": self.category_beneficiaries,
            "alert_threshold": self.alert_threshold,
            "block_threshold": self.block_threshold,
        }
        joblib.dump(bundle, model_path)
        logger.info("Anomaly detector model saved to %s", model_path)

    def train(
        self,
        expenses: list[ExpenseRecord],
        contamination: float | None = None,
    ) -> dict:
        """Train the Isolation Forest model on historical data.

        Args:
            expenses: List of historical expense records.
            contamination: Proportion of outliers in the data.

        Returns:
            Training metrics dict.
        """
        if contamination is not None:
            self.contamination = contamination

        # Build category statistics
        self._build_category_stats(expenses)

        # Build feature matrix
        features = []
        for exp in expenses:
            feat = self._extract_features(exp, expenses)
            features.append(feat)

        X = np.array(features)

        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # Train Isolation Forest
        self.model = IsolationForest(
            contamination=self.contamination,
            n_estimators=200,
            max_samples="auto",
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_scaled)
        self.is_ready = True

        # Compute training scores
        scores = self.model.decision_function(X_scaled)
        predictions = self.model.predict(X_scaled)
        n_anomalies = int(np.sum(predictions == -1))

        return {
            "n_samples": len(expenses),
            "n_features": X.shape[1],
            "n_anomalies_detected": n_anomalies,
            "anomaly_rate": n_anomalies / len(expenses) if expenses else 0,
            "score_mean": float(np.mean(scores)),
            "score_std": float(np.std(scores)),
        }

    def detect(
        self,
        expense: ExpenseRecord,
        history: list[ExpenseRecord] | None = None,
    ) -> AnomalyResult:
        """Detect anomalies in a single expense.

        Args:
            expense: The expense to check.
            history: Recent expenses context (for frequency/duplicate checks).
                     If None, rule-based checks still work but frequency features are zero.

        Returns:
            AnomalyResult with score, type, explanation, severity.
        """
        history = history or []

        # ── Rule-based checks (always work, even without trained model) ──
        rule_results = self._apply_rules(expense, history)

        # ── ML-based check (if model is ready) ──
        ml_score = 0.0
        if self.is_ready and self.model is not None and self.scaler is not None:
            feat = self._extract_features(expense, history)
            X = np.array([feat])
            X_scaled = self.scaler.transform(X)
            raw_score = self.model.decision_function(X_scaled)[0]
            # Convert to 0-1 range: lower decision_function = more anomalous
            # Typical range ~[-0.5, 0.5]; sigmoid-like mapping
            ml_score = 1.0 / (1.0 + np.exp(5 * raw_score))
            ml_score = float(np.clip(ml_score, 0, 1))

        # Combine rule-based and ML scores
        if rule_results:
            # Take the highest rule score
            best_rule = max(rule_results, key=lambda r: r.score)
            # Weighted combination: 60% rules, 40% ML
            combined_score = 0.6 * best_rule.score + 0.4 * ml_score
            combined_score = min(combined_score, 1.0)
            anomaly_type = best_rule.anomaly_type
            explanation = best_rule.explanation
        else:
            combined_score = ml_score
            anomaly_type = "AMOUNT_OUTLIER" if ml_score > 0.5 else "NONE"
            explanation = (
                f"Score ML d'anomalie: {ml_score:.2f}. "
                "Le modèle détecte un comportement inhabituel."
                if ml_score > 0.5
                else "Aucune anomalie détectée."
            )

        # Determine severity
        if combined_score >= self.block_threshold:
            severity = "HIGH"
        elif combined_score >= self.alert_threshold:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        is_anomaly = combined_score >= self.alert_threshold

        return AnomalyResult(
            is_anomaly=is_anomaly,
            score=round(combined_score, 4),
            anomaly_type=anomaly_type if is_anomaly else "NONE",
            explanation=explanation,
            severity=severity,
        )

    # ── Private methods ──────────────────────────────────────────

    def _build_category_stats(self, expenses: list[ExpenseRecord]) -> None:
        """Compute per-category mean/std from historical data."""
        from collections import defaultdict

        cat_amounts: dict[str, list[float]] = defaultdict(list)
        cat_beneficiaries: dict[str, set[str]] = defaultdict(set)

        for exp in expenses:
            cat_amounts[exp.category_id].append(exp.amount)
            cat_beneficiaries[exp.category_id].add(exp.beneficiary.strip().lower())

        self.category_stats = {}
        for cat_id, amounts in cat_amounts.items():
            arr = np.array(amounts)
            self.category_stats[cat_id] = CategoryStats(
                mean=float(np.mean(arr)),
                std=float(np.std(arr)) if len(arr) > 1 else float(np.mean(arr)) * 0.3,
                count=len(arr),
            )

        self.category_beneficiaries = {k: v for k, v in cat_beneficiaries.items()}

    def _extract_features(
        self, expense: ExpenseRecord, history: list[ExpenseRecord]
    ) -> list[float]:
        """Extract numerical features for the ML model.

        Features:
            0: z-score du montant par catégorie
            1: Fréquence bénéficiaire (30 derniers jours)
            2: Heure de création (0-23)
            3: Jour de la semaine (0=lundi, 6=dimanche)
            4: Écart relatif par rapport à la moyenne catégorie
            5: Nombre de dépenses du même user ce jour
        """
        dt = expense.date

        # Feature 0: z-score montant par catégorie
        stats = self.category_stats.get(expense.category_id, CategoryStats())
        z_score = (expense.amount - stats.mean) / stats.std if stats.std > 0 else 0.0

        # Feature 1: Fréquence bénéficiaire (30 jours)
        cutoff_30d = dt - timedelta(days=30)
        ben_lower = expense.beneficiary.strip().lower()
        ben_count_30d = sum(
            1
            for e in history
            if e.beneficiary.strip().lower() == ben_lower and e.date >= cutoff_30d
        )

        # Feature 2: Heure
        hour = float(dt.hour)

        # Feature 3: Jour de la semaine
        weekday = float(dt.weekday())

        # Feature 4: Écart relatif par rapport à la moyenne catégorie
        if stats.mean > 0:
            relative_deviation = (expense.amount - stats.mean) / stats.mean
        else:
            relative_deviation = 0.0

        # Feature 5: Nombre de dépenses du même user ce jour
        same_day = dt.date()
        user_day_count = sum(
            1 for e in history if e.user_id == expense.user_id and e.date.date() == same_day
        )

        return [z_score, ben_count_30d, hour, weekday, relative_deviation, user_day_count]

    def _apply_rules(
        self, expense: ExpenseRecord, history: list[ExpenseRecord]
    ) -> list[AnomalyResult]:
        """Apply rule-based anomaly detection."""
        results: list[AnomalyResult] = []
        dt = expense.date
        ben_lower = expense.beneficiary.strip().lower()

        # ── AMOUNT_OUTLIER ──
        stats = self.category_stats.get(expense.category_id, CategoryStats())
        if stats.std > 0 and stats.count >= 3:
            z = (expense.amount - stats.mean) / stats.std
            if abs(z) > 2:
                score = min(abs(z) / 5.0, 1.0)  # z=5 → score 1.0
                results.append(AnomalyResult(
                    is_anomaly=True,
                    score=score,
                    anomaly_type="AMOUNT_OUTLIER",
                    explanation=(
                        f"Montant de {expense.amount:,.0f} FCFA anormalement "
                        f"{'élevé' if z > 0 else 'bas'} pour la catégorie "
                        f"(moyenne: {stats.mean:,.0f}, écart-type: {stats.std:,.0f}, z-score: {z:.1f})."
                    ),
                    severity="HIGH" if score >= 0.9 else "MEDIUM" if score >= 0.7 else "LOW",
                ))

        # ── FREQUENCY_SPIKE ──
        same_day = dt.date()
        user_day_count = sum(
            1 for e in history if e.user_id == expense.user_id and e.date.date() == same_day
        )
        if user_day_count >= 10:
            score = min(user_day_count / 20.0, 1.0)
            results.append(AnomalyResult(
                is_anomaly=True,
                score=score,
                anomaly_type="FREQUENCY_SPIKE",
                explanation=(
                    f"L'utilisateur a déjà {user_day_count} dépenses aujourd'hui, "
                    f"ce qui est inhabituellement élevé."
                ),
                severity="HIGH" if score >= 0.9 else "MEDIUM" if score >= 0.7 else "LOW",
            ))

        # ── DUPLICATE_SUSPECT ──
        cutoff_dup = dt - timedelta(days=3)
        duplicates = [
            e
            for e in history
            if (
                e.expense_id != expense.expense_id
                and e.beneficiary.strip().lower() == ben_lower
                and abs(e.amount - expense.amount) < 0.01
                and e.date >= cutoff_dup
            )
        ]
        if duplicates:
            score = min(0.7 + 0.1 * len(duplicates), 1.0)
            results.append(AnomalyResult(
                is_anomaly=True,
                score=score,
                anomaly_type="DUPLICATE_SUSPECT",
                explanation=(
                    f"Dépense similaire détectée: même montant ({expense.amount:,.0f} FCFA) "
                    f"et même bénéficiaire ({expense.beneficiary}) dans les 3 derniers jours "
                    f"({len(duplicates)} occurrence(s))."
                ),
                severity="HIGH" if score >= 0.9 else "MEDIUM",
            ))

        # ── OFF_HOURS ──
        is_off_hours = (
            dt.hour < self.OFFICE_HOUR_START
            or dt.hour >= self.OFFICE_HOUR_END
            or dt.weekday() not in self.OFFICE_DAYS
        )
        if is_off_hours:
            # Weekend gets higher score than just late evening
            if dt.weekday() not in self.OFFICE_DAYS:
                score = 0.6
                time_desc = "un weekend"
            elif dt.hour < 5 or dt.hour >= 22:
                score = 0.7
                time_desc = "en pleine nuit"
            else:
                score = 0.4
                time_desc = "en dehors des heures de bureau"
            results.append(AnomalyResult(
                is_anomaly=score >= self.alert_threshold,
                score=score,
                anomaly_type="OFF_HOURS",
                explanation=(
                    f"Dépense créée {time_desc} "
                    f"({dt.strftime('%A %H:%M')}). "
                    "Les heures normales sont lundi-vendredi, 7h-19h."
                ),
                severity="MEDIUM" if score >= 0.7 else "LOW",
            ))

        # ── UNUSUAL_BENEFICIARY ──
        known = self.category_beneficiaries.get(expense.category_id, set())
        if known and ben_lower not in known:
            score = 0.5 + min(len(known) / 50.0, 0.4)  # More known = more unusual
            results.append(AnomalyResult(
                is_anomaly=score >= self.alert_threshold,
                score=score,
                anomaly_type="UNUSUAL_BENEFICIARY",
                explanation=(
                    f"Le bénéficiaire '{expense.beneficiary}' n'a jamais été vu dans "
                    f"la catégorie '{expense.category_id}' "
                    f"({len(known)} bénéficiaires connus)."
                ),
                severity="MEDIUM" if score >= 0.7 else "LOW",
            ))

        return results
