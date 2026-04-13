"""Categorization business logic — prediction orchestration + feedback storage."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.models.categorizer import CATEGORIES, ExpenseCategorizer
from app.schemas.categorization import (
    CategoryAlternative,
    CategorizationResponse,
)

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.60
TOP_K_ALTERNATIVES = 3


class CategorizationService:
    def __init__(self, categorizer: ExpenseCategorizer, feedback_path: Path):
        self.categorizer = categorizer
        self.feedback_path = feedback_path
        self.feedback_path.parent.mkdir(parents=True, exist_ok=True)

    def predict(
        self, description: str, amount: float, beneficiary: str = ""
    ) -> CategorizationResponse:
        """Run categorization and apply confidence threshold logic."""
        results = self.categorizer.predict(description, amount, beneficiary)

        if not results:
            return CategorizationResponse(
                category_id="DIVERS",
                category_name="Divers",
                confidence=0.0,
                alternatives=[],
                auto_categorized=False,
            )

        top_id, top_name, top_conf = results[0]

        alternatives = [
            CategoryAlternative(
                category_id=cid, category_name=cname, confidence=round(conf, 4)
            )
            for cid, cname, conf in results[1 : TOP_K_ALTERNATIVES + 1]
        ]

        auto_categorized = top_conf >= CONFIDENCE_THRESHOLD

        if not auto_categorized:
            # Return top-3 as suggestions without auto-categorizing
            alternatives = [
                CategoryAlternative(
                    category_id=cid, category_name=cname, confidence=round(conf, 4)
                )
                for cid, cname, conf in results[:TOP_K_ALTERNATIVES]
            ]
            return CategorizationResponse(
                category_id=top_id,
                category_name=top_name,
                confidence=round(top_conf, 4),
                alternatives=alternatives,
                auto_categorized=False,
            )

        return CategorizationResponse(
            category_id=top_id,
            category_name=top_name,
            confidence=round(top_conf, 4),
            alternatives=alternatives,
            auto_categorized=True,
        )

    def store_feedback(
        self,
        description: str,
        amount: float,
        beneficiary: str,
        correct_category_id: str,
    ) -> int:
        """Append feedback to a JSONL file for future retraining. Returns total count."""
        if correct_category_id not in CATEGORIES:
            raise ValueError(
                f"Unknown category_id '{correct_category_id}'. "
                f"Valid: {list(CATEGORIES.keys())}"
            )

        record = {
            "description": description,
            "amount": amount,
            "beneficiary": beneficiary,
            "category_id": correct_category_id,
            "category_name": CATEGORIES[correct_category_id],
        }
        with open(self.feedback_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

        # Count total feedbacks
        count = sum(1 for _ in open(self.feedback_path, encoding="utf-8"))
        logger.info(
            "Feedback stored: '%s' → %s (total: %d)",
            description[:50],
            correct_category_id,
            count,
        )
        return count
