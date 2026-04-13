"""Anomaly detection service — orchestrates detection logic."""

import logging
from datetime import datetime

from app.models.anomaly_detector import AnomalyDetector, AnomalyResult, ExpenseRecord
from app.schemas.anomaly import (
    AnomalyDetectRequest,
    AnomalyDetectResponse,
    AnomalyBatchResponse,
    AnomalySeverity,
)

logger = logging.getLogger(__name__)


class AnomalyService:
    """Service layer for anomaly detection on expenses."""

    def __init__(self, detector: AnomalyDetector):
        self.detector = detector
        # In-memory cache of recent expenses for context
        # In production, this would query the expense-service DB
        self._recent_expenses: list[ExpenseRecord] = []
        self._max_history = 5000

    def detect_single(self, request: AnomalyDetectRequest) -> AnomalyDetectResponse:
        """Detect anomalies in a single expense."""
        expense = self._request_to_record(request)
        result = self.detector.detect(expense, self._recent_expenses)

        # Add to history for future context
        self._add_to_history(expense)

        return self._result_to_response(request.expense_id, result)

    def detect_batch(self, requests: list[AnomalyDetectRequest]) -> AnomalyBatchResponse:
        """Detect anomalies in a batch of expenses."""
        results: list[AnomalyDetectResponse] = []

        for req in requests:
            expense = self._request_to_record(req)
            result = self.detector.detect(expense, self._recent_expenses)
            self._add_to_history(expense)
            results.append(self._result_to_response(req.expense_id, result))

        anomalies = [r for r in results if r.is_anomaly]
        high_severity = [r for r in anomalies if r.severity == AnomalySeverity.HIGH]

        return AnomalyBatchResponse(
            results=results,
            total=len(results),
            anomalies_count=len(anomalies),
            high_severity_count=len(high_severity),
        )

    def _request_to_record(self, req: AnomalyDetectRequest) -> ExpenseRecord:
        """Convert API request to internal record."""
        dt = datetime.fromisoformat(req.date)
        return ExpenseRecord(
            expense_id=req.expense_id,
            amount=req.amount,
            category_id=req.category_id,
            beneficiary=req.beneficiary,
            date=dt,
            user_id=req.user_id,
        )

    def _result_to_response(
        self, expense_id: str, result: AnomalyResult
    ) -> AnomalyDetectResponse:
        """Convert internal result to API response."""
        return AnomalyDetectResponse(
            expense_id=expense_id,
            is_anomaly=result.is_anomaly,
            score=result.score,
            anomaly_type=result.anomaly_type,
            explanation=result.explanation,
            severity=AnomalySeverity(result.severity),
        )

    def _add_to_history(self, expense: ExpenseRecord) -> None:
        """Add expense to in-memory history (bounded)."""
        self._recent_expenses.append(expense)
        if len(self._recent_expenses) > self._max_history:
            self._recent_expenses = self._recent_expenses[-self._max_history:]
