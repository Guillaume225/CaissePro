"""Tests for narrative report generation — generator, service, and API endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.narrative_generator import NarrativeGenerator
from app.schemas.narrative import (
    DateRange,
    KPIData,
    NarrativeRequest,
    ReportModule,
    ReportType,
)


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def generator() -> NarrativeGenerator:
    """Narrative generator in offline mode (no API key)."""
    return NarrativeGenerator(anthropic_api_key=None)


@pytest.fixture
def service(generator: NarrativeGenerator):
    from app.services.narrative_service import NarrativeService
    return NarrativeService(generator=generator)


@pytest.fixture
def sample_kpi_data() -> dict:
    return {
        "total_sales": 1_500_000,
        "total_expenses": 450_000,
        "transaction_count": 120,
        "average_ticket": 12_500,
        "top_products": [
            {"name": "Riz 25kg", "amount": 350_000},
            {"name": "Huile 5L", "amount": 200_000},
            {"name": "Sucre 1kg", "amount": 150_000},
        ],
        "top_clients": [
            {"name": "Mme Koné", "amount": 180_000},
            {"name": "M. Diallo", "amount": 150_000},
        ],
        "anomaly_count": 3,
        "growth_rate": 12.5,
        "profit_margin": 25.0,
    }


@pytest.fixture
def sample_request(sample_kpi_data: dict) -> NarrativeRequest:
    return NarrativeRequest(
        report_type=ReportType.DAILY,
        date_range=DateRange(start="2025-01-15", end="2025-01-15"),
        module=ReportModule.ALL,
        data=KPIData(**sample_kpi_data),
    )


# ── Generator: Jinja2 Fallback ──────────────────────────────────


class TestNarrativeGeneratorFallback:

    def test_offline_mode(self, generator: NarrativeGenerator):
        assert not generator.is_online

    def test_generate_daily(self, generator: NarrativeGenerator, sample_kpi_data: dict):
        text, offline = generator.generate(
            report_type="daily",
            period="15/01/2025",
            data=sample_kpi_data,
        )
        assert offline
        assert "1,500,000" in text or "1 500 000" in text
        assert "FCFA" in text
        assert "120" in text

    def test_generate_weekly(self, generator: NarrativeGenerator, sample_kpi_data: dict):
        text, offline = generator.generate(
            report_type="weekly",
            period="Semaine du 13/01 au 19/01/2025",
            data=sample_kpi_data,
        )
        assert offline
        assert "hebdomadaire" in text.lower() or "semaine" in text.lower()

    def test_generate_monthly(self, generator: NarrativeGenerator, sample_kpi_data: dict):
        text, offline = generator.generate(
            report_type="monthly",
            period="Janvier 2025",
            data=sample_kpi_data,
        )
        assert offline
        assert "mensuel" in text.lower() or "mois" in text.lower()

    def test_generate_custom(self, generator: NarrativeGenerator, sample_kpi_data: dict):
        text, offline = generator.generate(
            report_type="custom",
            period="Du 01/01/2025 au 31/01/2025",
            data=sample_kpi_data,
        )
        assert offline
        assert len(text) > 50

    def test_top_products_in_narrative(self, generator: NarrativeGenerator, sample_kpi_data: dict):
        text, _ = generator.generate("daily", "15/01/2025", sample_kpi_data)
        assert "Riz 25kg" in text

    def test_anomaly_alert_in_narrative(self, generator: NarrativeGenerator, sample_kpi_data: dict):
        text, _ = generator.generate("daily", "15/01/2025", sample_kpi_data)
        assert "anomalie" in text.lower() or "3" in text

    def test_empty_data(self, generator: NarrativeGenerator):
        text, offline = generator.generate("daily", "15/01/2025", {
            "total_sales": 0,
            "total_expenses": 0,
            "transaction_count": 0,
            "average_ticket": 0,
        })
        assert offline
        assert "0" in text or "FCFA" in text


# ── Generator: Insight Extraction ────────────────────────────────


class TestInsightExtraction:

    def test_growth_insight_positive(self):
        insights = NarrativeGenerator.extract_insights({"growth_rate": 15.0})
        growth_insights = [i for i in insights if "croissance" in i["title"].lower()]
        assert len(growth_insights) == 1
        assert growth_insights[0]["severity"] == "info"

    def test_growth_insight_negative(self):
        insights = NarrativeGenerator.extract_insights({"growth_rate": -15.0})
        decline = [i for i in insights if "baisse" in i["title"].lower()]
        assert len(decline) == 1
        assert decline[0]["severity"] == "warning"

    def test_no_growth_insight_for_small_change(self):
        insights = NarrativeGenerator.extract_insights({"growth_rate": 3.0})
        growth = [i for i in insights if "croissance" in i["title"].lower() or "baisse" in i["title"].lower()]
        assert len(growth) == 0

    def test_margin_warning(self):
        insights = NarrativeGenerator.extract_insights({"profit_margin": 5.0})
        margin = [i for i in insights if "marge" in i["title"].lower()]
        assert len(margin) == 1
        assert margin[0]["severity"] == "warning"

    def test_anomaly_insight(self):
        insights = NarrativeGenerator.extract_insights({"anomaly_count": 3})
        anomaly = [i for i in insights if "anomalie" in i["title"].lower()]
        assert len(anomaly) == 1

    def test_anomaly_critical(self):
        insights = NarrativeGenerator.extract_insights({"anomaly_count": 10})
        anomaly = [i for i in insights if "anomalie" in i["title"].lower()]
        assert anomaly[0]["severity"] == "critical"

    def test_average_ticket_insight(self):
        insights = NarrativeGenerator.extract_insights({
            "average_ticket": 12_500,
            "transaction_count": 50,
        })
        ticket = [i for i in insights if "panier" in i["title"].lower()]
        assert len(ticket) == 1
        assert "12,500" in ticket[0]["description"] or "12 500" in ticket[0]["description"]


# ── Generator: Alert Extraction ──────────────────────────────────


class TestAlertExtraction:

    def test_critical_anomaly_alert(self):
        alerts = NarrativeGenerator.extract_alerts({"anomaly_count": 8})
        critical = [a for a in alerts if a["severity"] == "critical"]
        assert len(critical) == 1
        assert critical[0]["metric"] == "anomaly_count"

    def test_warning_anomaly_alert(self):
        alerts = NarrativeGenerator.extract_alerts({"anomaly_count": 2})
        warnings = [a for a in alerts if a["severity"] == "warning"]
        assert len(warnings) == 1

    def test_no_alert_zero_anomalies(self):
        alerts = NarrativeGenerator.extract_alerts({"anomaly_count": 0})
        assert len(alerts) == 0

    def test_growth_crash_alert(self):
        alerts = NarrativeGenerator.extract_alerts({"growth_rate": -25.0})
        critical = [a for a in alerts if a["metric"] == "growth_rate"]
        assert len(critical) == 1
        assert critical[0]["severity"] == "critical"

    def test_margin_crisis_alert(self):
        alerts = NarrativeGenerator.extract_alerts({"profit_margin": 3.0})
        margin = [a for a in alerts if a["metric"] == "profit_margin"]
        assert len(margin) == 1
        assert margin[0]["severity"] == "critical"

    def test_no_alert_healthy_data(self):
        alerts = NarrativeGenerator.extract_alerts({
            "anomaly_count": 0,
            "growth_rate": 5.0,
            "profit_margin": 20.0,
        })
        assert len(alerts) == 0


# ── Generator: Period Formatting ─────────────────────────────────


class TestPeriodFormatting:

    def test_daily(self):
        p = NarrativeGenerator.format_period("daily", "2025-01-15", "2025-01-15")
        assert "15/01/2025" in p

    def test_weekly(self):
        p = NarrativeGenerator.format_period("weekly", "2025-01-13", "2025-01-19")
        assert "Semaine" in p
        assert "13/01" in p

    def test_monthly(self):
        p = NarrativeGenerator.format_period("monthly", "2025-01-01", "2025-01-31")
        assert "Janvier" in p
        assert "2025" in p

    def test_custom(self):
        p = NarrativeGenerator.format_period("custom", "2025-01-01", "2025-03-31")
        assert "Du" in p

    def test_invalid_date_fallback(self):
        p = NarrativeGenerator.format_period("daily", "not-a-date", "also-bad")
        assert "not-a-date" in p


# ── Service Tests ────────────────────────────────────────────────


class TestNarrativeService:

    def test_generate_report(self, service, sample_request: NarrativeRequest):
        response = service.generate_report(sample_request)
        assert response.offline_mode
        assert len(response.narrative) > 50
        assert response.report_type == ReportType.DAILY
        assert response.module == ReportModule.ALL
        assert "15/01/2025" in response.period

    def test_generate_report_with_insights(self, service):
        request = NarrativeRequest(
            report_type=ReportType.WEEKLY,
            date_range=DateRange(start="2025-01-13", end="2025-01-19"),
            data=KPIData(
                total_sales=1_000_000,
                transaction_count=80,
                average_ticket=12_500,
                growth_rate=-15.0,
                anomaly_count=7,
                profit_margin=4.0,
            ),
        )
        response = service.generate_report(request)
        assert len(response.key_insights) > 0
        assert len(response.alerts) > 0

    def test_generate_report_module_filter(self, service):
        request = NarrativeRequest(
            report_type=ReportType.MONTHLY,
            date_range=DateRange(start="2025-01-01", end="2025-01-31"),
            module=ReportModule.EXPENSES,
            data=KPIData(
                total_sales=2_000_000,
                total_expenses=800_000,
                transaction_count=200,
                average_ticket=10_000,
                profit_margin=8.0,
            ),
        )
        response = service.generate_report(request)
        assert response.module == ReportModule.EXPENSES
        # insights should be filtered to expenses module
        for insight in response.key_insights:
            assert insight.module in ("expenses", "all")


# ── API Tests ────────────────────────────────────────────────────


class TestNarrativeAPI:

    @pytest.mark.asyncio
    async def test_generate_endpoint(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/narrative/generate",
                json={
                    "report_type": "daily",
                    "date_range": {"start": "2025-01-15", "end": "2025-01-15"},
                    "data": {
                        "total_sales": 1500000,
                        "total_expenses": 450000,
                        "transaction_count": 120,
                        "average_ticket": 12500,
                    },
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert "narrative" in data
        assert data["offline_mode"] is True
        assert data["report_type"] == "daily"

    @pytest.mark.asyncio
    async def test_generate_weekly_with_insights(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/narrative/generate",
                json={
                    "report_type": "weekly",
                    "date_range": {"start": "2025-01-13", "end": "2025-01-19"},
                    "data": {
                        "total_sales": 5000000,
                        "total_expenses": 2000000,
                        "transaction_count": 350,
                        "average_ticket": 14285,
                        "anomaly_count": 8,
                        "growth_rate": -25.0,
                        "profit_margin": 3.0,
                    },
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert len(data["key_insights"]) > 0
        assert len(data["alerts"]) > 0
        # Should have critical alerts for anomalies, growth crash, and margin crisis
        severities = [a["severity"] for a in data["alerts"]]
        assert "critical" in severities

    @pytest.mark.asyncio
    async def test_generate_monthly_module_filter(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/narrative/generate",
                json={
                    "report_type": "monthly",
                    "date_range": {"start": "2025-01-01", "end": "2025-01-31"},
                    "module": "sales",
                    "data": {
                        "total_sales": 15000000,
                        "transaction_count": 1200,
                        "average_ticket": 12500,
                        "growth_rate": 8.0,
                    },
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "sales"
        assert "Janvier" in data["period"]

    @pytest.mark.asyncio
    async def test_generate_missing_required_fields(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/narrative/generate",
                json={"report_type": "daily"},
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_invalid_report_type(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/ai/narrative/generate",
                json={
                    "report_type": "yearly",
                    "date_range": {"start": "2025-01-01", "end": "2025-12-31"},
                    "data": {"total_sales": 100000},
                },
            )
        assert response.status_code == 422
