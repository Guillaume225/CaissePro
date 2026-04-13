from __future__ import annotations

from datetime import date as DateType
from enum import Enum

from pydantic import BaseModel, Field


class OCRConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    MANUAL_REVIEW = "manual_review"


class InvoiceLine(BaseModel):
    description: str | None = None
    quantity: float | None = None
    unit_price: float | None = None
    amount: float | None = None
    confidence: float = Field(ge=0, le=100)


class OCRResult(BaseModel):
    montant: float | None = Field(None, description="Montant total extrait")
    date: DateType | None = Field(None, description="Date du document")
    fournisseur: str | None = Field(None, description="Nom du fournisseur")
    numero_facture: str | None = Field(None, description="Numéro de facture")
    lignes: list[InvoiceLine] = Field(default_factory=list, description="Lignes de facture détectées")
    confiance_globale: float = Field(ge=0, le=100, description="Score de confiance global (0-100)")
    confidence_level: OCRConfidenceLevel = OCRConfidenceLevel.MANUAL_REVIEW
    manual_review_required: bool = True
    raw_text: str = Field("", description="Texte brut extrait par OCR")
    warnings: list[str] = Field(default_factory=list)


class OCRResponse(BaseModel):
    success: bool
    data: OCRResult | None = None
    error: str | None = None
    processing_time_ms: float | None = None
