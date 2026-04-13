"""OCR endpoints — POST /ai/ocr/extract."""

import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.dependencies import get_ocr_engine
from app.models.ocr_engine import OCREngine
from app.schemas.ocr import OCRResponse
from app.services.ocr_service import OCRService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("/extract", response_model=OCRResponse)
async def extract_document(
    file: UploadFile,
    engine: OCREngine = Depends(get_ocr_engine),
    settings: Settings = Depends(get_settings),
):
    """Extract structured data from an invoice/receipt image or PDF.

    Accepts: PNG, JPG, JPEG, TIFF, BMP, PDF.
    Returns: montant, date, fournisseur, numero_facture, lignes[], confiance_globale.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=400,
            detail=f"Extension '.{ext}' non supportée. Extensions autorisées: {settings.ocr_allowed_extensions}",
        )

    file_bytes = await file.read()
    max_bytes = settings.ocr_max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux ({len(file_bytes) / 1024 / 1024:.1f} MB). Maximum: {settings.ocr_max_file_size_mb} MB",
        )

    service = OCRService(engine)
    try:
        result, processing_time = await service.process_file(file_bytes, file.filename)
    except ValueError as e:
        logger.warning("OCR processing error: %s", e)
        return OCRResponse(success=False, error=str(e))
    except Exception:
        logger.exception("Unexpected OCR error for file %s", file.filename)
        raise HTTPException(status_code=500, detail="Erreur interne lors du traitement OCR")

    return OCRResponse(success=True, data=result, processing_time_ms=round(processing_time, 2))
