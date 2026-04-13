import uuid

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SAEnum,
    String,
    Text,
    func,
)
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import DeclarativeBase

from app.enums import JobStatus, ReportFormat, ReportType, ScheduleFrequency


class Base(DeclarativeBase):
    pass


class ReportJob(Base):
    __tablename__ = "report_jobs"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, nullable=False, index=True)
    report_type = Column(SAEnum(ReportType), nullable=False)
    format = Column(SAEnum(ReportFormat), nullable=False, default=ReportFormat.PDF)
    status = Column(SAEnum(JobStatus), nullable=False, default=JobStatus.PENDING)
    params = Column(JSON, nullable=True)
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, nullable=False, index=True)
    report_type = Column(SAEnum(ReportType), nullable=False)
    format = Column(SAEnum(ReportFormat), nullable=False, default=ReportFormat.PDF)
    params = Column(JSON, nullable=True)
    frequency = Column(SAEnum(ScheduleFrequency), nullable=False)
    cron_expression = Column(String(100), nullable=False)
    recipients_emails = Column(JSON, nullable=True)
    is_active = Column(String(5), nullable=False, default="true")
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
