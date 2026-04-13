"""PDF generation using WeasyPrint (HTML→PDF) with ReportLab fallback."""

import os
from pathlib import Path
from datetime import datetime

from jinja2 import Environment, FileSystemLoader

from app.config import get_settings

settings = get_settings()

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=True,
)


def _company_context() -> dict:
    return {
        "company_name": settings.company_name,
        "company_address": settings.company_address,
        "company_phone": settings.company_phone,
        "company_email": settings.company_email,
        "company_logo_url": settings.company_logo_url,
        "company_rccm": settings.company_rccm,
        "company_cc": settings.company_cc,
        "generated_at": datetime.now().strftime("%d/%m/%Y à %H:%M"),
        "currency": settings.currency,
    }


def render_html(template_name: str, context: dict) -> str:
    """Render an HTML template with Jinja2."""
    tpl = _jinja_env.get_template(f"{template_name}.html")
    full_context = {**_company_context(), **context}
    return tpl.render(**full_context)


def generate_pdf_weasyprint(html_content: str, output_path: str) -> str:
    """Generate PDF from HTML using WeasyPrint."""
    from weasyprint import HTML

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    HTML(string=html_content, base_url=str(TEMPLATES_DIR)).write_pdf(output_path)
    return output_path


def generate_pdf_reportlab(title: str, headers: list[str], rows: list[list], output_path: str) -> str:
    """Generate a simple table PDF using ReportLab (fallback)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#062A5A"),
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#4884BD"),
    )

    elements = []

    # Header
    elements.append(Paragraph(settings.company_name, title_style))
    elements.append(Paragraph(title, styles["Heading2"]))
    elements.append(Paragraph(
        f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}",
        subtitle_style,
    ))
    elements.append(Spacer(1, 12))

    # Table
    data = [headers] + rows
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#062A5A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#4884BD")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EDF3F9")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(table)

    doc.build(elements)
    return output_path


def generate_pdf(template_name: str, context: dict, output_path: str) -> str:
    """Generate PDF: tries WeasyPrint first, falls back to ReportLab."""
    try:
        html = render_html(template_name, context)
        return generate_pdf_weasyprint(html, output_path)
    except Exception:
        # Fall back to ReportLab simple table if WeasyPrint is unavailable
        headers = context.get("table_headers", [])
        rows = context.get("table_rows", [])
        title = context.get("report_title", template_name)
        if headers and rows:
            return generate_pdf_reportlab(title, headers, rows, output_path)
        raise
