"""Feature engineering utilities for ML models."""

import re
from datetime import date


def extract_amounts(text: str) -> list[float]:
    """Extract monetary amounts from text (supports FCFA, XAF, CFA formats)."""
    patterns = [
        r"(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)\s*(?:FCFA|XAF|CFA|F)",
        r"(?:Total|Montant|TTC|NET)[:\s]*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)",
        r"(\d{1,3}(?:\.\d{3})*(?:,\d{2}))",
    ]
    amounts: list[float] = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            cleaned = m.replace(" ", "").replace(".", "").replace(",", ".")
            try:
                amounts.append(float(cleaned))
            except ValueError:
                continue
    return sorted(set(amounts), reverse=True)


def extract_dates(text: str) -> list[date]:
    """Extract dates from text (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)."""
    pattern = r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})"
    dates: list[date] = []
    for match in re.finditer(pattern, text):
        day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if year < 100:
            year += 2000
        try:
            dates.append(date(year, month, day))
        except ValueError:
            try:
                dates.append(date(year, day, month))
            except ValueError:
                continue
    return dates


def extract_invoice_number(text: str) -> str | None:
    """Extract invoice/receipt number."""
    patterns = [
        r"(?:Facture|Invoice|Fact|Reçu|Receipt)[:\s#]*([A-Z0-9\-/]+)",
        r"N°?\s*:?\s*([A-Z]{0,3}\d{4,}[A-Z0-9\-/]*)",
        r"(?:Réf|Ref)[.:\s]*([A-Z0-9\-/]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def extract_supplier_name(text: str) -> str | None:
    """Extract supplier name from first lines of the document."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return None
    # Typically the supplier name is in the first non-empty lines (header)
    for line in lines[:5]:
        # Skip lines that are mostly numbers, dates, or common headers
        if re.match(r"^[\d\s/\-:.]+$", line):
            continue
        if re.match(r"(?:facture|invoice|reçu|date|tel|fax|email|adresse)", line, re.IGNORECASE):
            continue
        if len(line) > 3:
            return line
    return None
