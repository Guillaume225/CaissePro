"""Tests for report builders (with mocked HTTP calls)."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.enums import ReportType
from app.generators.report_builders import (
    build_daily_cash_journal,
    build_budget_status,
    build_aged_receivables,
    build_cash_register_closing,
    build_monthly_consolidated,
    build_client_statement,
    build_report,
    BUILDERS,
)


MOCK_SALES = [
    {
        "reference": "VTE-001",
        "clientName": "Client A",
        "paymentMethod": "Espèces",
        "amountHT": 100000,
        "tvaAmount": 18000,
        "amountTTC": 118000,
        "status": "paid",
        "date": "2026-03-30",
        "createdAt": "2026-03-30T08:00:00",
        "paidAmount": 118000,
        "categoryName": "Produits",
    },
    {
        "reference": "VTE-002",
        "clientName": "Client B",
        "paymentMethod": "Mobile Money",
        "amountHT": 250000,
        "tvaAmount": 45000,
        "amountTTC": 295000,
        "status": "pending",
        "date": "2026-03-30",
        "createdAt": "2026-03-30T09:00:00",
        "paidAmount": 0,
        "categoryName": "Services",
    },
]

MOCK_EXPENSES = [
    {
        "reference": "DEP-001",
        "categoryName": "Fournitures",
        "description": "Papier A4",
        "amount": 50000,
        "status": "approved",
    },
    {
        "reference": "DEP-002",
        "categoryName": "Transport",
        "description": "Taxi",
        "amount": 10000,
        "status": "approved",
        "departmentName": "Commercial",
    },
]

MOCK_BUDGETS = [
    {
        "categoryName": "Fournitures",
        "departmentName": "IT",
        "amount": 500000,
        "consumed": 200000,
    },
    {
        "categoryName": "Transport",
        "departmentName": "Commercial",
        "amount": 300000,
        "consumed": 150000,
    },
]

MOCK_RECEIVABLES = [
    {
        "reference": "FAC-001",
        "clientId": "c1",
        "clientName": "Client A",
        "clientPhone": "+225 07 00 00 00",
        "dueDate": "2026-02-15",
        "amount": 200000,
        "remainingAmount": 200000,
        "paidAmount": 50000,
    },
    {
        "reference": "FAC-002",
        "clientId": "c2",
        "clientName": "Client B",
        "clientPhone": "+225 05 00 00 00",
        "dueDate": "2025-12-01",
        "amount": 500000,
        "remainingAmount": 500000,
        "paidAmount": 100000,
    },
]


@pytest.fixture
def mock_fetchers():
    with (
        patch("app.generators.report_builders.fetch_sales", new_callable=AsyncMock) as mock_sales,
        patch("app.generators.report_builders.fetch_expenses", new_callable=AsyncMock) as mock_exp,
        patch("app.generators.report_builders.fetch_budgets", new_callable=AsyncMock) as mock_budgets,
        patch("app.generators.report_builders.fetch_receivables", new_callable=AsyncMock) as mock_recv,
        patch("app.generators.report_builders.fetch_cash_register", new_callable=AsyncMock) as mock_register,
        patch("app.generators.report_builders.fetch_client", new_callable=AsyncMock) as mock_client,
    ):
        mock_sales.return_value = MOCK_SALES
        mock_exp.return_value = MOCK_EXPENSES
        mock_budgets.return_value = MOCK_BUDGETS
        mock_recv.return_value = MOCK_RECEIVABLES
        mock_register.return_value = {
            "name": "Caisse Principale",
            "openingBalance": 100000,
            "actualBalance": 445000,
        }
        mock_client.return_value = {
            "name": "Client A",
            "phone": "+225 07 00 00 00",
            "email": "clienta@test.ci",
        }
        yield {
            "sales": mock_sales,
            "expenses": mock_exp,
            "budgets": mock_budgets,
            "receivables": mock_recv,
            "register": mock_register,
            "client": mock_client,
        }


class TestBuildersRegistry:
    def test_all_report_types_have_builders(self):
        for rt in ReportType:
            assert rt in BUILDERS, f"Missing builder for {rt}"


@pytest.mark.asyncio
class TestDailyCashJournal:
    async def test_build_with_data(self, mock_fetchers):
        result = await build_daily_cash_journal({"date": "2026-03-30"})

        assert result["template"] == "daily_cash_journal"
        assert "XOF" in result["context"]["total_sales"]
        assert "XOF" in result["context"]["total_expenses"]
        assert "XOF" in result["context"]["net_balance"]
        assert len(result["context"]["sales"]) == 2
        assert len(result["context"]["expenses"]) == 2
        assert len(result["table_headers"]) == 7
        assert len(result["table_rows"]) == 4  # 2 sales + 2 expenses

    async def test_build_summary(self, mock_fetchers):
        result = await build_daily_cash_journal({"date": "2026-03-30"})
        assert "Total Ventes TTC" in result["summary"]
        assert "Solde Net" in result["summary"]


@pytest.mark.asyncio
class TestBudgetStatus:
    async def test_build_with_data(self, mock_fetchers):
        result = await build_budget_status({
            "period_start": "2026-01-01",
            "period_end": "2026-03-31",
        })

        assert result["template"] == "budget_status"
        assert len(result["context"]["budgets"]) == 2
        assert result["context"]["global_percentage"] > 0
        assert "XOF" in result["summary"]["Budget Total"]


@pytest.mark.asyncio
class TestAgedReceivables:
    async def test_build_with_data(self, mock_fetchers):
        result = await build_aged_receivables({"as_of_date": "2026-03-30"})

        assert result["template"] == "aged_receivables"
        assert "XOF" in result["context"]["total_receivables"]
        # Should have 2 different clients
        assert len(result["context"]["clients"]) == 2

    async def test_bracket_distribution(self, mock_fetchers):
        result = await build_aged_receivables({"as_of_date": "2026-03-30"})
        summary = result["summary"]
        assert "0-30 jours" in summary
        assert "90+ jours" in summary


@pytest.mark.asyncio
class TestCashRegisterClosing:
    async def test_build_with_data(self, mock_fetchers):
        result = await build_cash_register_closing({
            "cash_register_id": str(uuid.uuid4()),
            "date": "2026-03-30",
        })

        assert result["template"] == "cash_register_closing"
        assert "Caisse Principale" in result["context"]["register_name"]
        assert "XOF" in result["context"]["opening_balance"]
        assert "XOF" in result["context"]["variance"]

    async def test_payment_methods_summary(self, mock_fetchers):
        result = await build_cash_register_closing({
            "cash_register_id": str(uuid.uuid4()),
            "date": "2026-03-30",
        })
        pms = result["context"]["payment_methods"]
        assert len(pms) == 2  # Espèces + Mobile Money
        methods = [pm["method"] for pm in pms]
        assert "Espèces" in methods
        assert "Mobile Money" in methods


@pytest.mark.asyncio
class TestMonthlyConsolidated:
    async def test_build_with_data(self, mock_fetchers):
        result = await build_monthly_consolidated({"year": 2026, "month": 3})

        assert result["template"] == "monthly_consolidated"
        assert "Mars 2026" in result["context"]["month_label"]
        assert "XOF" in result["context"]["total_revenue"]
        assert "XOF" in result["context"]["total_expenses"]
        assert result["context"]["net_result_raw"] is not None

    async def test_kpis_present(self, mock_fetchers):
        result = await build_monthly_consolidated({"year": 2026, "month": 3})
        kpis = result["context"]["kpis"]
        assert len(kpis) >= 4
        labels = [k["label"] for k in kpis]
        assert "Chiffre d'affaires TTC" in labels


@pytest.mark.asyncio
class TestClientStatement:
    async def test_build_with_data(self, mock_fetchers):
        result = await build_client_statement({
            "client_id": str(uuid.uuid4()),
            "period_start": "2026-01-01",
            "period_end": "2026-03-31",
        })

        assert result["template"] == "client_statement"
        assert "Client A" in result["context"]["client_name"]
        assert "XOF" in result["context"]["total_purchases"]
        assert len(result["context"]["transactions"]) > 0

    async def test_running_balance(self, mock_fetchers):
        result = await build_client_statement({
            "client_id": str(uuid.uuid4()),
            "period_start": "2026-01-01",
            "period_end": "2026-03-31",
        })
        # Transactions include debits (sales) and credits (payments)
        txs = result["context"]["transactions"]
        assert any("Vente" in t["description"] for t in txs)
        assert any("Paiement" in t["description"] for t in txs)


@pytest.mark.asyncio
class TestBuildReportDispatcher:
    async def test_dispatch_to_correct_builder(self, mock_fetchers):
        result = await build_report(
            ReportType.DAILY_CASH_JOURNAL,
            {"date": "2026-03-30"},
        )
        assert result["template"] == "daily_cash_journal"

    async def test_unknown_type_raises(self, mock_fetchers):
        with pytest.raises(ValueError, match="Type de rapport inconnu"):
            await build_report("nonexistent", {})
