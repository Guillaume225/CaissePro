"""Schemas for narrative report generation endpoints."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class ReportType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class ReportModule(str, Enum):
    SALES = "sales"
    EXPENSES = "expenses"
    INVENTORY = "inventory"
    CLIENTS = "clients"
    ALL = "all"


class DateRange(BaseModel):
    start: str = Field(..., description="Date de début (ISO 8601)")
    end: str = Field(..., description="Date de fin (ISO 8601)")


class KPIData(BaseModel):
    total_sales: float = Field(0, description="Total des ventes (FCFA)")
    total_expenses: float = Field(0, description="Total des dépenses (FCFA)")
    transaction_count: int = Field(0, description="Nombre de transactions")
    average_ticket: float = Field(0, description="Panier moyen (FCFA)")
    top_products: list[dict] = Field(default_factory=list, description="Top produits")
    top_clients: list[dict] = Field(default_factory=list, description="Top clients")
    anomaly_count: int = Field(0, description="Nombre d'anomalies détectées")
    growth_rate: float | None = Field(None, description="Taux de croissance (%)")
    profit_margin: float | None = Field(None, description="Marge bénéficiaire (%)")


class NarrativeRequest(BaseModel):
    report_type: ReportType = Field(..., description="Type de rapport")
    date_range: DateRange = Field(..., description="Période du rapport")
    module: ReportModule = Field(ReportModule.ALL, description="Module à couvrir")
    data: KPIData = Field(..., description="Données KPI du rapport")
    language: str = Field("fr", description="Langue du rapport (fr, en)")
    include_recommendations: bool = Field(True, description="Inclure des recommandations")


class KeyInsight(BaseModel):
    title: str = Field(..., description="Titre de l'insight")
    description: str = Field(..., description="Description détaillée")
    severity: str = Field("info", description="Sévérité : info, warning, critical")
    module: str = Field(..., description="Module concerné")


class Alert(BaseModel):
    message: str = Field(..., description="Message d'alerte")
    severity: str = Field(..., description="Sévérité : warning, critical")
    metric: str = Field(..., description="Métrique concernée")
    value: float = Field(..., description="Valeur observée")
    threshold: float | None = Field(None, description="Seuil de référence")


class NarrativeResponse(BaseModel):
    narrative: str = Field(..., description="Texte narratif du rapport")
    key_insights: list[KeyInsight] = Field(default_factory=list)
    alerts: list[Alert] = Field(default_factory=list)
    report_type: ReportType
    period: str = Field(..., description="Période lisible (ex: 'Janvier 2025')")
    module: ReportModule
    offline_mode: bool = Field(False, description="True si généré via template Jinja2")
