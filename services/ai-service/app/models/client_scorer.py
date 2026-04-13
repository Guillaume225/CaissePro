"""Client scoring model — XGBoost-based creditworthiness scoring with SHAP."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
    "days_since_registration",
    "total_purchases",
    "invoices_on_time",
    "invoices_late",
    "avg_payment_delay_days",
    "current_unpaid",
    "unpaid_ratio",
]


@dataclass
class ScoringFactor:
    name: str
    impact: float
    value: str


@dataclass
class ScoringResult:
    score: int  # 0-100
    risk_class: str  # A/B/C/D
    factors: list[ScoringFactor]
    credit_recommendation: float


class ClientScorer:
    """XGBoost-based client scorer with SHAP explanations.

    Features:
        - days_since_registration: Ancienneté (jours)
        - total_purchases: Volume total achats (FCFA)
        - invoices_on_time: Factures payées à temps
        - invoices_late: Factures payées en retard
        - avg_payment_delay_days: Délai moyen paiement (jours)
        - current_unpaid: Impayés actuels (FCFA)
        - unpaid_ratio: Ratio impayés / total achats
    """

    def __init__(self, model_path: str | None = None):
        self.model = None
        self.scaler = None
        self.shap_explainer = None
        self.is_ready = False

        if model_path:
            self.load(model_path)

    def load(self, model_path: str) -> None:
        bundle = joblib.load(model_path)
        self.model = bundle["model"]
        self.scaler = bundle.get("scaler")
        self.is_ready = True
        # Rebuild SHAP explainer for loaded model
        try:
            import shap
            self.shap_explainer = shap.TreeExplainer(self.model)
        except Exception:
            self.shap_explainer = None
            logger.warning("SHAP explainer could not be initialized — explanations will be rule-based")
        logger.info("Client scorer loaded from %s", model_path)

    def save(self, model_path: str) -> None:
        bundle = {
            "model": self.model,
            "scaler": self.scaler,
        }
        joblib.dump(bundle, model_path)
        logger.info("Client scorer saved to %s", model_path)

    def train(self, df: pd.DataFrame) -> dict:
        """Train the XGBoost model.

        Args:
            df: DataFrame with feature columns + 'score' (0-100 target).
        """
        from xgboost import XGBRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler

        feature_cols = [c for c in FEATURE_NAMES if c in df.columns]
        X = df[feature_cols].values
        y = df["score"].values

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        self.model = XGBRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            objective="reg:squarederror",
        )
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False,
        )

        # Build SHAP explainer
        try:
            import shap
            self.shap_explainer = shap.TreeExplainer(self.model)
        except Exception:
            self.shap_explainer = None

        self.is_ready = True

        # Metrics
        y_pred = self.model.predict(X_test)
        mae = float(np.mean(np.abs(y_test - y_pred)))
        rmse = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))

        return {
            "n_samples": len(df),
            "n_features": len(feature_cols),
            "mae": mae,
            "rmse": rmse,
            "feature_importance": dict(zip(feature_cols, map(float, self.model.feature_importances_))),
        }

    def score(self, features: dict) -> ScoringResult:
        """Score a single client.

        Args:
            features: dict with keys matching FEATURE_NAMES
                      (unpaid_ratio is auto-calculated if missing).

        Returns:
            ScoringResult with score, risk_class, SHAP factors, credit recommendation.
        """
        # Compute derived features
        if "unpaid_ratio" not in features:
            total = features.get("total_purchases", 0)
            unpaid = features.get("current_unpaid", 0)
            features["unpaid_ratio"] = unpaid / total if total > 0 else 0.0

        feat_values = [float(features.get(f, 0)) for f in FEATURE_NAMES]
        X = np.array([feat_values])

        if self.is_ready and self.model is not None and self.scaler is not None:
            X_scaled = self.scaler.transform(X)
            raw_score = float(self.model.predict(X_scaled)[0])
            score = int(np.clip(round(raw_score), 0, 100))

            # SHAP explanations
            factors = self._get_shap_factors(X_scaled, features)
        else:
            # Fallback: rule-based scoring
            score, factors = self._rule_based_score(features)

        risk_class = self._score_to_risk_class(score)
        credit_rec = self._compute_credit_recommendation(score, features)

        return ScoringResult(
            score=score,
            risk_class=risk_class,
            factors=factors,
            credit_recommendation=credit_rec,
        )

    # ── Private helpers ───────────────────────────────────────────

    def _get_shap_factors(self, X_scaled: np.ndarray, features: dict) -> list[ScoringFactor]:
        """Extract top-5 SHAP factors."""
        if self.shap_explainer is not None:
            try:
                shap_values = self.shap_explainer.shap_values(X_scaled)
                if isinstance(shap_values, list):
                    shap_values = shap_values[0]
                sv = shap_values[0]

                name_map = {
                    "days_since_registration": "Ancienneté client",
                    "total_purchases": "Volume total achats",
                    "invoices_on_time": "Factures payées à temps",
                    "invoices_late": "Factures en retard",
                    "avg_payment_delay_days": "Délai moyen de paiement",
                    "current_unpaid": "Impayés actuels",
                    "unpaid_ratio": "Ratio impayés/achats",
                }

                ranked = sorted(
                    zip(FEATURE_NAMES, sv),
                    key=lambda x: abs(x[1]),
                    reverse=True,
                )[:5]

                return [
                    ScoringFactor(
                        name=name_map.get(fname, fname),
                        impact=round(float(shap_val), 4),
                        value=self._format_feature_value(fname, features.get(fname, 0)),
                    )
                    for fname, shap_val in ranked
                ]
            except Exception as e:
                logger.warning("SHAP computation failed: %s", e)

        return self._fallback_factors(features)

    def _fallback_factors(self, features: dict) -> list[ScoringFactor]:
        """Rule-based factor explanation when SHAP is unavailable."""
        name_map = {
            "days_since_registration": "Ancienneté client",
            "total_purchases": "Volume total achats",
            "invoices_on_time": "Factures payées à temps",
            "invoices_late": "Factures en retard",
            "avg_payment_delay_days": "Délai moyen de paiement",
            "current_unpaid": "Impayés actuels",
            "unpaid_ratio": "Ratio impayés/achats",
        }
        factors = []
        for fname in FEATURE_NAMES[:5]:
            val = features.get(fname, 0)
            factors.append(ScoringFactor(
                name=name_map.get(fname, fname),
                impact=0.0,
                value=self._format_feature_value(fname, val),
            ))
        return factors

    def _rule_based_score(self, features: dict) -> tuple[int, list[ScoringFactor]]:
        """Fallback scoring without ML model."""
        score = 50  # baseline

        # Ancienneté: +0.02 per day, max +20
        days = features.get("days_since_registration", 0)
        score += min(20, int(days * 0.02))

        # On-time ratio
        on_time = features.get("invoices_on_time", 0)
        late = features.get("invoices_late", 0)
        total_inv = on_time + late
        if total_inv > 0:
            on_time_ratio = on_time / total_inv
            score += int((on_time_ratio - 0.5) * 30)

        # Delay penalty
        delay = features.get("avg_payment_delay_days", 0)
        if delay > 30:
            score -= min(20, int((delay - 30) * 0.5))

        # Unpaid penalty
        ratio = features.get("unpaid_ratio", 0)
        if ratio > 0.1:
            score -= int(ratio * 40)

        score = max(0, min(100, score))
        factors = self._fallback_factors(features)
        return score, factors

    def _format_feature_value(self, fname: str, value) -> str:
        if fname in ("total_purchases", "current_unpaid"):
            return f"{float(value):,.0f} FCFA"
        if fname == "unpaid_ratio":
            return f"{float(value) * 100:.1f}%"
        if fname in ("avg_payment_delay_days", "days_since_registration"):
            return f"{float(value):.0f} jours"
        return str(int(value)) if isinstance(value, (int, float)) and value == int(value) else str(value)

    @staticmethod
    def _score_to_risk_class(score: int) -> str:
        if score >= 75:
            return "A"
        if score >= 50:
            return "B"
        if score >= 25:
            return "C"
        return "D"

    @staticmethod
    def _compute_credit_recommendation(score: int, features: dict) -> float:
        """Recommend credit limit based on score and purchase volume."""
        total = features.get("total_purchases", 0)
        avg_monthly = total / max(1, features.get("days_since_registration", 30) / 30)

        if score >= 75:
            multiplier = 3.0
        elif score >= 50:
            multiplier = 1.5
        elif score >= 25:
            multiplier = 0.5
        else:
            multiplier = 0.0

        recommendation = round(avg_monthly * multiplier, -3)  # Round to nearest 1000
        return max(0, float(recommendation))
