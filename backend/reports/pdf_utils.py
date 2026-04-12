"""
Shared helpers for building PDF reports with ReportLab.
"""
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
)

# Palette
PRIMARY   = colors.HexColor('#1a1a2e')
ACCENT    = colors.HexColor('#2b6cb0')
GREEN     = colors.HexColor('#276749')
RED       = colors.HexColor('#c53030')
LIGHT_BG  = colors.HexColor('#f7fafc')
HEADER_BG = colors.HexColor('#ebf8ff')


def _base_style():
    styles = getSampleStyleSheet()
    return styles


def build_pdf(title, subtitle, col_headers, rows, col_widths=None, landscape_mode=False):
    """
    Build a styled PDF and return the raw bytes.
    - title: main heading
    - subtitle: secondary line (e.g. "Section: Class 10-A | Date: 2024-01-01")
    - col_headers: list of column header strings
    - rows: list of lists (each inner list = one table row)
    - col_widths: optional list of widths in cm
    """
    buf    = BytesIO()
    psize  = landscape(A4) if landscape_mode else A4
    doc    = SimpleDocTemplate(buf, pagesize=psize,
                               leftMargin=1.5*cm, rightMargin=1.5*cm,
                               topMargin=1.5*cm, bottomMargin=1.5*cm)

    styles = _base_style()
    title_style = ParagraphStyle('Title', parent=styles['Title'],
                                 textColor=PRIMARY, fontSize=16, spaceAfter=4)
    sub_style   = ParagraphStyle('Sub', parent=styles['Normal'],
                                 textColor=colors.HexColor('#718096'), fontSize=9, spaceAfter=12)

    elements = [
        Paragraph(title, title_style),
        Paragraph(subtitle, sub_style),
        Spacer(1, 0.3*cm),
    ]

    # Build table data
    table_data = [col_headers] + rows

    # Auto widths if not provided
    if col_widths:
        widths = [w * cm for w in col_widths]
    else:
        avail = (psize[0] - 3*cm)
        widths = [avail / len(col_headers)] * len(col_headers)

    tbl = Table(table_data, colWidths=widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header row
        ('BACKGROUND',  (0, 0), (-1, 0), HEADER_BG),
        ('TEXTCOLOR',   (0, 0), (-1, 0), ACCENT),
        ('FONTNAME',    (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',    (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING',    (0, 0), (-1, 0), 8),
        # Body rows
        ('FONTNAME',  (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',  (0, 1), (-1, -1), 8),
        ('TOPPADDING',    (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        # Grid
        ('GRID',      (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN',    (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(tbl)

    doc.build(elements)
    return buf.getvalue()
