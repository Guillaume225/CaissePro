"""Tests for PDF generator (ReportLab only — WeasyPrint needs system deps)."""

import os
import tempfile

import pytest

from app.generators.pdf_generator import render_html, generate_pdf_reportlab


class TestRenderHtml:
    def test_render_daily_cash_journal(self):
        context = {
            "date": "2026-03-30",
            "sales": [],
            "expenses": [],
            "total_sales": "0 XOF",
            "total_sales_ht": "0 XOF",
            "total_sales_tva": "0 XOF",
            "total_collected": "0 XOF",
            "total_expenses": "0 XOF",
            "net_balance": "0 XOF",
            "company_name": "Test Company",
            "generated_at": "30/03/2026 à 10:00",
        }
        html = render_html("daily_cash_journal", context)
        assert "Journal de Caisse" in html
        assert "Test Company" in html
        assert "2026-03-30" in html

    def test_render_budget_status(self):
        context = {
            "period_start": "2026-01-01",
            "period_end": "2026-03-31",
            "budgets": [
                {
                    "category": "Fournitures",
                    "department": "IT",
                    "allocated": "500 000 XOF",
                    "consumed": "200 000 XOF",
                    "remaining": "300 000 XOF",
                    "percentage": 40.0,
                }
            ],
            "total_budget": "500 000 XOF",
            "total_consumed": "200 000 XOF",
            "total_remaining": "300 000 XOF",
            "global_percentage": 40.0,
            "company_name": "Test",
            "generated_at": "30/03/2026",
        }
        html = render_html("budget_status", context)
        assert "État Budgétaire" in html
        assert "Fournitures" in html

    def test_render_aged_receivables(self):
        context = {
            "as_of_date": "2026-03-30",
            "clients": [],
            "invoices": [],
            "total_receivables": "0 XOF",
            "bracket_0_30": "0 XOF",
            "bracket_31_60": "0 XOF",
            "bracket_61_90": "0 XOF",
            "bracket_90_plus": "0 XOF",
            "bracket_61_plus": "0 XOF",
            "company_name": "Test",
            "generated_at": "30/03/2026",
        }
        html = render_html("aged_receivables", context)
        assert "Balance Âgée" in html

    def test_render_cash_register_closing(self):
        context = {
            "register_name": "Caisse Principale",
            "date": "2026-03-30",
            "opening_balance": "100 000 XOF",
            "total_income": "500 000 XOF",
            "total_outflow": "200 000 XOF",
            "theoretical_balance": "400 000 XOF",
            "actual_balance": "395 000 XOF",
            "variance": "-5 000 XOF",
            "variance_abs": 5000,
            "payment_methods": [],
            "total_transactions": 0,
            "company_name": "Test",
            "generated_at": "30/03/2026",
        }
        html = render_html("cash_register_closing", context)
        assert "Clôture de Caisse" in html
        assert "Caisse Principale" in html
        assert "Écart détecté" in html  # variance_abs > 0

    def test_render_monthly_consolidated(self):
        context = {
            "month_label": "Mars 2026",
            "sales_by_category": [],
            "expenses_by_category": [],
            "kpis": [],
            "total_revenue": "0 XOF",
            "total_revenue_ht": "0 XOF",
            "total_revenue_tva": "0 XOF",
            "total_expenses": "0 XOF",
            "net_result": "0 XOF",
            "net_result_raw": 0,
            "net_margin": 0,
            "total_budget": "0 XOF",
            "budget_rate": 0,
            "total_sales_count": 0,
            "total_expenses_count": 0,
            "company_name": "Test",
            "generated_at": "30/03/2026",
        }
        html = render_html("monthly_consolidated", context)
        assert "Rapport Mensuel Consolidé" in html
        assert "Mars 2026" in html

    def test_render_client_statement(self):
        context = {
            "client_name": "Société ABC",
            "client_phone": "+225 07 00 00 00",
            "client_email": "abc@test.ci",
            "client_address": "Abidjan",
            "period_start": "2026-01-01",
            "period_end": "2026-03-31",
            "transactions": [],
            "total_purchases": "0 XOF",
            "total_paid": "0 XOF",
            "outstanding_balance": "0 XOF",
            "outstanding_raw": 0,
            "opening_balance": "0 XOF",
            "total_debits": "0 XOF",
            "total_credits": "0 XOF",
            "transaction_count": 0,
            "company_name": "Test",
            "generated_at": "30/03/2026",
        }
        html = render_html("client_statement", context)
        assert "Relevé Client" in html
        assert "Société ABC" in html


class TestReportLabPdf:
    def test_generate_simple_table_pdf(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "test.pdf")
            headers = ["Référence", "Montant", "Statut"]
            rows = [
                ["VTE-001", "100 000 XOF", "Payé"],
                ["VTE-002", "250 000 XOF", "En attente"],
            ]
            result = generate_pdf_reportlab("Test Report", headers, rows, output_path)
            assert os.path.exists(result)
            assert os.path.getsize(result) > 0

    def test_generate_empty_table(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "empty.pdf")
            result = generate_pdf_reportlab("Empty", ["Col1", "Col2"], [], output_path)
            assert os.path.exists(result)
