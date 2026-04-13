"""Tests for Pydantic schemas validation."""

import uuid
from datetime import datetime

import pytest
from pydantic import ValidationError

from app.enums import JobStatus, ReportFormat, ReportType, ScheduleFrequency
from app.schemas import (
    GenerateReportRequest,
    GenerateReportResponse,
    JobStatusResponse,
    ReportJobResponse,
    ReportTemplateResponse,
    ScheduleReportRequest,
    ScheduledReportResponse,
)


class TestGenerateReportRequest:
    def test_valid_request(self):
        req = GenerateReportRequest(
            report_type=ReportType.DAILY_CASH_JOURNAL,
            format=ReportFormat.PDF,
            params={"date": "2026-03-30"},
        )
        assert req.report_type == ReportType.DAILY_CASH_JOURNAL
        assert req.format == ReportFormat.PDF
        assert req.params["date"] == "2026-03-30"

    def test_default_format_is_pdf(self):
        req = GenerateReportRequest(
            report_type=ReportType.BUDGET_STATUS,
            params={},
        )
        assert req.format == ReportFormat.PDF

    def test_invalid_report_type(self):
        with pytest.raises(ValidationError):
            GenerateReportRequest(report_type="invalid_type", params={})

    def test_empty_params_allowed(self):
        req = GenerateReportRequest(
            report_type=ReportType.DAILY_CASH_JOURNAL,
        )
        assert req.params == {}


class TestScheduleReportRequest:
    def test_valid_schedule(self):
        req = ScheduleReportRequest(
            report_type=ReportType.MONTHLY_CONSOLIDATED,
            format=ReportFormat.EXCEL,
            params={"year": 2026, "month": 3},
            frequency=ScheduleFrequency.MONTHLY,
            cron_expression="0 8 1 * *",
            recipients_emails=["admin@caisseflow.ci"],
        )
        assert req.frequency == ScheduleFrequency.MONTHLY
        assert req.cron_expression == "0 8 1 * *"

    def test_invalid_cron_expression(self):
        with pytest.raises(ValidationError):
            ScheduleReportRequest(
                report_type=ReportType.DAILY_CASH_JOURNAL,
                frequency=ScheduleFrequency.DAILY,
                cron_expression="invalid; DROP TABLE;",
            )


class TestGenerateReportResponse:
    def test_response_creation(self):
        resp = GenerateReportResponse(
            job_id=uuid.uuid4(),
            status=JobStatus.PENDING,
            message="Rapport en cours de génération",
        )
        assert resp.status == JobStatus.PENDING


class TestJobStatusResponse:
    def test_response_creation(self):
        resp = JobStatusResponse(
            id=uuid.uuid4(),
            status=JobStatus.COMPLETED,
            progress="Terminé",
            file_name="report.pdf",
            created_at=datetime.now(),
            completed_at=datetime.now(),
        )
        assert resp.status == JobStatus.COMPLETED
        assert resp.file_name == "report.pdf"


class TestReportTemplateResponse:
    def test_response_creation(self):
        resp = ReportTemplateResponse(
            report_type=ReportType.DAILY_CASH_JOURNAL,
            name="Journal de caisse",
            description="Test",
            required_params=["date"],
            optional_params=[],
            formats=[ReportFormat.PDF, ReportFormat.EXCEL],
        )
        assert resp.report_type == ReportType.DAILY_CASH_JOURNAL
        assert len(resp.formats) == 2
