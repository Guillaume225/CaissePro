"""Expense categorizer model — TF-IDF + LinearSVC pipeline with amount features."""

from __future__ import annotations

import logging
import pickle
from pathlib import Path

import numpy as np
from scipy.sparse import hstack
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import LinearSVC

from app.utils.nlp_preprocessing import build_combined_text

logger = logging.getLogger(__name__)

# ── Category registry (aligned with expense-service seed) ─
CATEGORIES: dict[str, str] = {
    "FOUR-BUR": "Fournitures bureau",
    "TRANSPORT": "Transport",
    "MAINT": "Maintenance",
    "SALAIRES": "Salaires",
    "CHG-SOC": "Charges sociales",
    "LOYERS": "Loyers",
    "ENERGIE": "Énergie",
    "TELECOM": "Télécom",
    "FORMATION": "Formation",
    "DIVERS": "Divers",
}

CATEGORY_ID_BY_NAME = {v: k for k, v in CATEGORIES.items()}


class ExpenseCategorizer:
    """ML model: TF-IDF vectorized text + normalized amount → CalibratedLinearSVC."""

    def __init__(self, model_path: str | None = None):
        self.tfidf: TfidfVectorizer | None = None
        self.scaler: StandardScaler | None = None
        self.classifier: CalibratedClassifierCV | None = None
        self.label_encoder: LabelEncoder | None = None
        self._ready = False

        if model_path:
            self.load(model_path)

    # ── Persistence ──────────────────────────────────────
    def load(self, model_path: str) -> None:
        """Load a trained model bundle from disk."""
        path = Path(model_path)
        if not path.exists():
            logger.warning("Model file not found: %s — categorizer will be unavailable", path)
            return
        with open(path, "rb") as f:
            bundle = pickle.load(f)  # noqa: S301
        self.tfidf = bundle["tfidf"]
        self.scaler = bundle["scaler"]
        self.classifier = bundle["classifier"]
        self.label_encoder = bundle["label_encoder"]
        self._ready = True
        logger.info("Categorizer model loaded from %s (%d classes)", path, len(self.label_encoder.classes_))

    def save(self, model_path: str) -> None:
        """Persist the trained model bundle to disk."""
        bundle = {
            "tfidf": self.tfidf,
            "scaler": self.scaler,
            "classifier": self.classifier,
            "label_encoder": self.label_encoder,
        }
        path = Path(model_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(bundle, f)
        logger.info("Categorizer model saved to %s", path)

    @property
    def is_ready(self) -> bool:
        return self._ready

    # ── Training ─────────────────────────────────────────
    def train(
        self,
        descriptions: list[str],
        amounts: list[float],
        beneficiaries: list[str],
        labels: list[str],
    ) -> dict:
        """Train the full pipeline from raw data. Returns metrics dict."""
        from sklearn.metrics import classification_report
        from sklearn.model_selection import train_test_split

        # Preprocess text
        texts = [build_combined_text(d, b) for d, b in zip(descriptions, beneficiaries)]

        # Encode labels
        self.label_encoder = LabelEncoder()
        y = self.label_encoder.fit_transform(labels)

        # TF-IDF on text
        self.tfidf = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
        )
        X_text = self.tfidf.fit_transform(texts)

        # Normalize amount as additional feature
        self.scaler = StandardScaler()
        amounts_arr = np.array(amounts).reshape(-1, 1)
        X_amount = self.scaler.fit_transform(amounts_arr)

        # Combine features
        X = hstack([X_text, X_amount])

        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # LinearSVC wrapped in CalibratedClassifierCV for probability estimates
        base_svc = LinearSVC(max_iter=5000, class_weight="balanced", random_state=42)
        self.classifier = CalibratedClassifierCV(base_svc, cv=3)
        self.classifier.fit(X_train, y_train)

        self._ready = True

        # Evaluate
        y_pred = self.classifier.predict(X_test)
        report = classification_report(
            y_test,
            y_pred,
            target_names=self.label_encoder.classes_,
            output_dict=True,
        )
        logger.info(
            "Training complete — accuracy: %.3f, macro-F1: %.3f",
            report["accuracy"],
            report["macro avg"]["f1-score"],
        )
        return report

    # ── Prediction ───────────────────────────────────────
    def predict(
        self, description: str, amount: float, beneficiary: str = ""
    ) -> list[tuple[str, str, float]]:
        """Predict category. Returns sorted list of (category_id, category_name, confidence)."""
        if not self._ready:
            raise RuntimeError("Categorizer model not loaded — run training first")

        text = build_combined_text(description, beneficiary)
        X_text = self.tfidf.transform([text])
        X_amount = self.scaler.transform(np.array([[amount]]))
        X = hstack([X_text, X_amount])

        probas = self.classifier.predict_proba(X)[0]
        class_names = self.label_encoder.classes_

        results = []
        for idx in np.argsort(probas)[::-1]:
            cat_name = class_names[idx]
            cat_id = CATEGORY_ID_BY_NAME.get(cat_name, cat_name)
            results.append((cat_id, cat_name, float(probas[idx])))

        return results
