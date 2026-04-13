"""Tests for feature engineering utilities."""

from datetime import date

from app.utils.feature_engineering import (
    extract_amounts,
    extract_dates,
    extract_invoice_number,
    extract_supplier_name,
)


def test_extract_amounts_fcfa():
    text = "Total TTC: 150.000 FCFA\nSous-total: 125.000 FCFA"
    amounts = extract_amounts(text)
    assert 150000.0 in amounts
    assert 125000.0 in amounts


def test_extract_amounts_with_decimals():
    text = "Montant: 1.250,50 FCFA"
    amounts = extract_amounts(text)
    assert any(abs(a - 1250.50) < 0.01 for a in amounts)


def test_extract_dates():
    text = "Date: 15/03/2026\nÉchéance: 30-04-2026"
    dates = extract_dates(text)
    assert date(2026, 3, 15) in dates
    assert date(2026, 4, 30) in dates


def test_extract_invoice_number():
    text = "Facture N°: FA-2026-001\nDate: 15/03/2026"
    num = extract_invoice_number(text)
    assert num is not None
    assert "FA-2026-001" in num


def test_extract_supplier_name():
    text = "SARL EXAMPLE SERVICES\n123 Rue du Commerce\nTel: 01 23 45 67 89"
    name = extract_supplier_name(text)
    assert name == "SARL EXAMPLE SERVICES"


def test_extract_supplier_skips_numbers():
    text = "123456789\nACME Corporation\nFacture"
    name = extract_supplier_name(text)
    assert name == "ACME Corporation"
