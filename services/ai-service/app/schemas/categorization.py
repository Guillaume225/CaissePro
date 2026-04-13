"""Pydantic schemas for the categorization module."""

from pydantic import BaseModel, Field


class CategoryAlternative(BaseModel):
    category_id: str
    category_name: str
    confidence: float = Field(ge=0, le=1)


class CategorizationRequest(BaseModel):
    description: str = Field(..., min_length=3, max_length=1000, examples=["Achat ramettes papier A4 et cartouches encre"])
    amount: float = Field(..., gt=0, examples=[45000])
    beneficiary: str = Field("", max_length=255, examples=["Papeterie du Centre"])
    ocr_data: dict | None = Field(None, description="Données OCR brutes optionnelles")


class CategorizationResponse(BaseModel):
    category_id: str
    category_name: str
    confidence: float = Field(ge=0, le=1)
    alternatives: list[CategoryAlternative] = Field(default_factory=list)
    auto_categorized: bool = Field(True, description="False si confiance < 60% (suggestions uniquement)")


class FeedbackRequest(BaseModel):
    description: str = Field(..., min_length=3, max_length=1000)
    amount: float = Field(..., gt=0)
    beneficiary: str = Field("", max_length=255)
    correct_category_id: str = Field(..., description="ID de la catégorie correcte validée par l'utilisateur")


class FeedbackResponse(BaseModel):
    success: bool
    message: str
    feedback_count: int = Field(0, description="Nombre total de feedbacks enregistrés")
