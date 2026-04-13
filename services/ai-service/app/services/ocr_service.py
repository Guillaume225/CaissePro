"""OCR business logic: orchestrates image preprocessing, OCR, and NLP post-processing."""

import io
import logging
import time

import fitz  # PyMuPDF
import numpy as np

from app.models.ocr_engine import OCREngine
from app.schemas.ocr import InvoiceLine, OCRConfidenceLevel, OCRResult
from app.utils.feature_engineering import (
    extract_amounts,
    extract_dates,
    extract_invoice_number,
    extract_supplier_name,
)

logger = logging.getLogger(__name__)


class OCRService:
    def __init__(self, engine: OCREngine):
        self.engine = engine

    async def process_file(self, file_bytes: bytes, filename: str) -> tuple[OCRResult, float]:
        """Process an uploaded file (image or PDF) and return structured OCR data.

        Returns (result, processing_time_ms).
        """
        start = time.perf_counter()
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if ext == "pdf":
            raw_text, confidence = self._process_pdf(file_bytes)
        else:
            raw_text, confidence = self._process_image(file_bytes)

        result = self._post_process(raw_text, confidence)
        elapsed_ms = (time.perf_counter() - start) * 1000
        return result, elapsed_ms

    def _process_image(self, file_bytes: bytes) -> tuple[str, float]:
        image = self.engine.image_from_bytes(file_bytes)
        return self.engine.extract_text(image)

    def _process_pdf(self, file_bytes: bytes) -> tuple[str, float]:
        """Extract text from all pages of a PDF."""
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        all_text: list[str] = []
        all_confidences: list[float] = []

        for page in doc:
            # Render page to image at 300 DPI for quality OCR
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")
            nparr = np.frombuffer(img_bytes, np.uint8)

            import cv2

            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is not None:
                text, conf = self.engine.extract_text(image)
                all_text.append(text)
                all_confidences.append(conf)

        doc.close()
        combined_text = "\n".join(all_text)
        avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        return combined_text, avg_conf

    def _post_process(self, raw_text: str, confidence: float) -> OCRResult:
        """Apply NLP post-processing to extract structured fields from raw OCR text."""
        warnings: list[str] = []

        # Extract amounts
        amounts = extract_amounts(raw_text)
        montant = amounts[0] if amounts else None
        if not montant:
            warnings.append("Montant total non détecté")

        # Extract dates
        dates = extract_dates(raw_text)
        doc_date = dates[0] if dates else None
        if not doc_date:
            warnings.append("Date du document non détectée")

        # Extract invoice number
        numero_facture = extract_invoice_number(raw_text)
        if not numero_facture:
            warnings.append("Numéro de facture non détecté")

        # Extract supplier
        fournisseur = extract_supplier_name(raw_text)
        if not fournisseur:
            warnings.append("Fournisseur non détecté")

        # Build line items (basic: amounts from text excluding the total)
        lignes: list[InvoiceLine] = []
        if len(amounts) > 1:
            for amt in amounts[1:]:
                lignes.append(InvoiceLine(amount=amt, confidence=confidence))

        # Determine confidence level
        needs_review = self.engine.needs_manual_review(confidence)
        if confidence >= 90:
            level = OCRConfidenceLevel.HIGH
        elif confidence >= 70:
            level = OCRConfidenceLevel.MEDIUM
        elif confidence >= 50:
            level = OCRConfidenceLevel.LOW
        else:
            level = OCRConfidenceLevel.MANUAL_REVIEW

        if needs_review:
            warnings.append(
                f"Confiance faible ({confidence:.1f}%) — vérification manuelle requise"
            )

        return OCRResult(
            montant=montant,
            date=doc_date,
            fournisseur=fournisseur,
            numero_facture=numero_facture,
            lignes=lignes,
            confiance_globale=round(confidence, 2),
            confidence_level=level,
            manual_review_required=needs_review,
            raw_text=raw_text,
            warnings=warnings,
        )
