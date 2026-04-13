"""Report service API router."""

import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.enums import JobStatus, ReportType, REPORT_TEMPLATES
from app.models import ReportJob, ScheduledReport
from app.schemas import (
    GenerateReportRequest,
    GenerateReportResponse,
    JobStatusResponse,
    ReportJobResponse,
    ReportTemplateResponse,
    ScheduleReportRequest,
    ScheduledReportResponse,
)
from app.tasks import generate_report_task

router = APIRouter(prefix="/reports", tags=["Reports"])


# ──────────────────────────────────────────────
# POST /reports/generate
# ──────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=GenerateReportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_report(
    body: GenerateReportRequest,
    db: AsyncSession = Depends(get_db),
    user: dict[str, Any] = Depends(get_current_user),
):
    """Lancer la génération asynchrone d'un rapport."""
    # Validate report type has requested format
    tmpl = REPORT_TEMPLATES.get(body.report_type)
    if not tmpl:
        raise HTTPException(status_code=400, detail="Type de rapport inconnu")
    if body.format not in tmpl["formats"]:
        raise HTTPException(
            status_code=400,
            detail=f"Format {body.format.value} non disponible pour ce type de rapport",
        )

    # Validate required params
    missing = [p for p in tmpl["required_params"] if p not in body.params]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Paramètres requis manquants: {', '.join(missing)}",
        )

    # Create job record
    job = ReportJob(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user["id"]),
        report_type=body.report_type,
        format=body.format,
        status=JobStatus.PENDING,
        params=body.params,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Dispatch Celery task
    token = None  # Will be injected from request header in production
    generate_report_task.delay(
        job_id=str(job.id),
        report_type=body.report_type.value,
        format=body.format.value,
        params=body.params,
        token=token,
    )

    return GenerateReportResponse(
        job_id=job.id,
        status=JobStatus.PENDING,
        message="Rapport en cours de génération",
    )


# ──────────────────────────────────────────────
# GET /reports/:job_id/status
# ──────────────────────────────────────────────

@router.get(
    "/{job_id}/status",
    response_model=JobStatusResponse,
)
async def get_report_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict[str, Any] = Depends(get_current_user),
):
    """Vérifier le statut d'un job de génération."""
    result = await db.execute(
        select(ReportJob).where(
            ReportJob.id == job_id,
            ReportJob.user_id == uuid.UUID(user["id"]),
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job introuvable")

    progress = None
    if job.status == JobStatus.PROCESSING:
        progress = "En cours de génération..."
    elif job.status == JobStatus.COMPLETED:
        progress = "Terminé"

    return JobStatusResponse(
        id=job.id,
        status=job.status,
        progress=progress,
        error_message=job.error_message,
        file_name=job.file_name,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


# ──────────────────────────────────────────────
# GET /reports/:job_id/download
# ──────────────────────────────────────────────

MIME_TYPES = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
}


@router.get("/{job_id}/download")
async def download_report(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict[str, Any] = Depends(get_current_user),
):
    """Télécharger le fichier de rapport généré."""
    result = await db.execute(
        select(ReportJob).where(
            ReportJob.id == job_id,
            ReportJob.user_id == uuid.UUID(user["id"]),
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job introuvable")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Le rapport n'est pas prêt (statut: {job.status.value})",
        )

    if not job.file_path or not os.path.exists(job.file_path):
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    ext = job.format.value
    media_type = MIME_TYPES.get(ext, "application/octet-stream")

    return FileResponse(
        path=job.file_path,
        filename=job.file_name,
        media_type=media_type,
    )


# ──────────────────────────────────────────────
# POST /reports/schedule
# ──────────────────────────────────────────────

@router.post(
    "/schedule",
    response_model=ScheduledReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def schedule_report(
    body: ScheduleReportRequest,
    db: AsyncSession = Depends(get_db),
    user: dict[str, Any] = Depends(get_current_user),
):
    """Programmer un rapport récurrent."""
    tmpl = REPORT_TEMPLATES.get(body.report_type)
    if not tmpl:
        raise HTTPException(status_code=400, detail="Type de rapport inconnu")
    if body.format not in tmpl["formats"]:
        raise HTTPException(
            status_code=400,
            detail=f"Format {body.format.value} non disponible pour ce type de rapport",
        )

    schedule = ScheduledReport(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user["id"]),
        report_type=body.report_type,
        format=body.format,
        params=body.params,
        frequency=body.frequency,
        cron_expression=body.cron_expression,
        recipients_emails=body.recipients_emails,
        is_active="true",
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    return ScheduledReportResponse(
        id=schedule.id,
        user_id=schedule.user_id,
        report_type=schedule.report_type,
        format=schedule.format,
        params=schedule.params,
        frequency=schedule.frequency,
        cron_expression=schedule.cron_expression,
        recipients_emails=schedule.recipients_emails,
        is_active=schedule.is_active,
        last_run_at=schedule.last_run_at,
        next_run_at=schedule.next_run_at,
        created_at=schedule.created_at,
    )


# ──────────────────────────────────────────────
# GET /reports/templates
# ──────────────────────────────────────────────

@router.get(
    "/templates",
    response_model=list[ReportTemplateResponse],
)
async def list_templates(
    user: dict[str, Any] = Depends(get_current_user),
):
    """Lister les modèles de rapports disponibles."""
    templates = []
    for rtype, meta in REPORT_TEMPLATES.items():
        templates.append(ReportTemplateResponse(
            report_type=rtype,
            name=meta["name"],
            description=meta["description"],
            required_params=meta["required_params"],
            optional_params=meta["optional_params"],
            formats=meta["formats"],
        ))
    return templates
