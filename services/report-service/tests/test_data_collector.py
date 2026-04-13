"""Tests for data collector utilities."""

from datetime import date

from app.generators.data_collector import format_xof, parse_date, aging_bracket


class TestFormatXof:
    def test_simple_amount(self):
        assert format_xof(1000) == "1 000 XOF"

    def test_large_amount(self):
        assert format_xof(1500000) == "1 500 000 XOF"

    def test_zero(self):
        assert format_xof(0) == "0 XOF"

    def test_float_amount(self):
        assert format_xof(999.9) == "999 XOF"

    def test_negative_amount(self):
        result = format_xof(-5000)
        assert "5 000" in result


class TestParseDate:
    def test_string_date(self):
        result = parse_date("2026-03-30")
        assert result == date(2026, 3, 30)

    def test_date_object(self):
        d = date(2026, 1, 15)
        assert parse_date(d) == d

    def test_none(self):
        assert parse_date(None) is None


class TestAgingBracket:
    def test_0_to_30(self):
        assert aging_bracket(0) == "0-30 jours"
        assert aging_bracket(15) == "0-30 jours"
        assert aging_bracket(30) == "0-30 jours"

    def test_31_to_60(self):
        assert aging_bracket(31) == "31-60 jours"
        assert aging_bracket(45) == "31-60 jours"
        assert aging_bracket(60) == "31-60 jours"

    def test_61_to_90(self):
        assert aging_bracket(61) == "61-90 jours"
        assert aging_bracket(90) == "61-90 jours"

    def test_90_plus(self):
        assert aging_bracket(91) == "90+ jours"
        assert aging_bracket(365) == "90+ jours"
