"""Celery tasks for async report generation."""

import asyncio
import os
import uuid
from datetime import datetime

from app.celery_app import celery_app
from app.config import get_settings
from app.database import SyncSessionLocal
from app.enums import JobStatus, ReportFormat, ReportType
from app.generators.report_builders import build_report
from app.generators.pdf_generator import generate_pdf
from app.generators.excel_generator import generate_excel
from app.generators.csv_generator import generate_csv
from app.models import ReportJob

settings = get_settings()


def _get_loop():
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


@celery_app.task(name="app.tasks.generate_report", bind=True, max_retries=2)
def generate_report_task(self, job_id: str, report_type: str, format: str, params: dict, token: str | None = None):
    """Generate a report file asynchronously."""
    db = SyncSessionLocal()
    try:
        # Mark as processing
        job = db.query(ReportJob).filter(ReportJob.id == uuid.UUID(job_id)).first()
        if not job:
            return {"error": "Job not found"}

        job.status = JobStatus.PROCESSING
        job.started_at = datetime.utcnow()
        db.commit()

        # Build report data
        loop = _get_loop()
        rt = ReportType(report_type)
        report_data = loop.run_until_complete(build_report(rt, params, token))

        # Generate file
        fmt = ReportFormat(format)
        safe_name = report_data["title"].replace(" ", "_").replace("/", "-").replace("—", "-")
        file_name = f"{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        output_dir = os.path.join(settings.reports_storage_path, job_id)
        os.makedirs(output_dir, exist_ok=True)

        if fmt == ReportFormat.PDF:
            file_name += ".pdf"
            output_path = os.path.join(output_dir, file_name)
            generate_pdf(report_data["template"], report_data["context"], output_path)

        elif fmt == ReportFormat.EXCEL:
            file_name += ".xlsx"
            output_path = os.path.join(output_dir, file_name)
            generate_excel(
                title=report_data["title"],
                sheets_data=[{
                    "name": report_data["title"][:31],
                    "headers": report_data["table_headers"],
                    "rows": report_data["table_rows"],
                }],
                output_path=output_path,
                summary=report_data.get("summary"),
            )

        elif fmt == ReportFormat.CSV:
            file_name += ".csv"
            output_path = os.path.join(output_dir, file_name)
            generate_csv(
                headers=report_data["table_headers"],
                rows=report_data["table_rows"],
                output_path=output_path,
            )
        else:
            raise ValueError(f"Format non supporté: {fmt}")

        # Update job as completed
        file_size = os.path.getsize(output_path)
        job.status = JobStatus.COMPLETED
        job.file_path = output_path
        job.file_name = file_name
        job.file_size = _format_size(file_size)
        job.completed_at = datetime.utcnow()
        job.error_message = None
        db.commit()

        return {"status": "completed", "file_name": file_name}

    except Exception as exc:
        db.rollback()
        # Update job as failed
        try:
            job = db.query(ReportJob).filter(ReportJob.id == uuid.UUID(job_id)).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc)[:500]
                job.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass

        raise self.retry(exc=exc, countdown=30)

    finally:
        db.close()


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
