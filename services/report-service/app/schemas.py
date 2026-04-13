from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.enums import (
    JobStatus,
    ReportFormat,
    ReportType,
    ScheduleFrequency,
)


# ── Request schemas ──


class GenerateReportRequest(BaseModel):
    report_type: ReportType
    format: ReportFormat = ReportFormat.PDF
    params: dict[str, Any] = Field(default_factory=dict)

    model_config = {"json_schema_extra": {
        "examples": [
            {
                "report_type": "daily_cash_journal",
                "format": "pdf",
                "params": {"date": "2026-03-30"},
            }
        ]
    }}


class ScheduleReportRequest(BaseModel):
    report_type: ReportType
    format: ReportFormat = ReportFormat.PDF
    params: dict[str, Any] = Field(default_factory=dict)
    frequency: ScheduleFrequency
    cron_expression: str = Field(
        ...,
        pattern=r"^[\d\*\/\-\,\s]+$",
        description="Expression cron (ex: '0 8 * * 1' pour chaque lundi à 8h)",
    )
    recipients_emails: list[str] = Field(default_factory=list)


# ── Response schemas ──


class ReportJobResponse(BaseModel):
    id: UUID
    user_id: UUID
    report_type: ReportType
    format: ReportFormat
    status: JobStatus
    params: dict[str, Any] | None = None
    file_name: str | None = None
    file_size: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobStatusResponse(BaseModel):
    id: UUID
    status: JobStatus
    progress: str | None = None
    error_message: str | None = None
    file_name: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScheduledReportResponse(BaseModel):
    id: UUID
    user_id: UUID
    report_type: ReportType
    format: ReportFormat
    params: dict[str, Any] | None = None
    frequency: ScheduleFrequency
    cron_expression: str
    recipients_emails: list[str] | None = None
    is_active: str
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportTemplateResponse(BaseModel):
    report_type: ReportType
    name: str
    description: str
    required_params: list[str]
    optional_params: list[str]
    formats: list[ReportFormat]


class GenerateReportResponse(BaseModel):
    job_id: UUID
    status: JobStatus
    message: str
