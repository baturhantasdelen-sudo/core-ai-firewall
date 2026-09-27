#!/usr/bin/env python3
"""
Generate an executive PDF from enterprise pitch markdown (EN / TR).

Requires: pip install reportlab

Usage:
    python scripts/generate_enterprise_deck.py
    python scripts/generate_enterprise_deck.py --lang tr
    python scripts/generate_enterprise_deck.py --lang en --output results/nexus_shield_enterprise_overview.pdf
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO_ROOT / "docs" / "ENTERPRISE_PITCH_AND_VISION.md"
DEFAULT_OUTPUT = REPO_ROOT / "results" / "nexus_shield_enterprise_overview.pdf"


@dataclass(frozen=True)
class DeckMeta:
    product_name: str
    tagline: str
    cover_subtitle: str
    cover_footer: str
    pdf_title: str


LANG_PROFILES: dict[str, dict[str, object]] = {
    "en": {
        "source": REPO_ROOT / "docs" / "ENTERPRISE_PITCH_AND_VISION.md",
        "output": REPO_ROOT / "results" / "nexus_shield_enterprise_overview.pdf",
        "meta": DeckMeta(
            product_name="Nexus Shield — AI Agent Action Governance & Verification Platform",
            tagline=(
                "Know what your agents are allowed to do. Stop what they shouldn't. "
                "Prove what actually happened."
            ),
            cover_subtitle="Executive architectural overview · CISO / CTO briefing",
            cover_footer="https://www.nexusshield.ai/ · Confidential — for stakeholder review",
            pdf_title="Nexus Shield Enterprise Overview",
        ),
    },
    "tr": {
        "source": REPO_ROOT / "docs" / "ENTERPRISE_PITCH_AND_VISION_TR.md",
        "output": REPO_ROOT / "results" / "nexus_shield_enterprise_overview_tr.pdf",
        "meta": DeckMeta(
            product_name=(
                "Nexus Shield — Yapay Zeka Ajanı Eylem Yönetişimi ve Doğrulama Platformu"
            ),
            tagline=(
                "Ajanlarınızın ne yapmasına izin verildiğini bilin. "
                "Yapmamaları gerekenleri durdurun. Ne olduğunu kanıtlayın."
            ),
            cover_subtitle="Kurumsal mimari özeti · CISO / CTO brifingi",
            cover_footer="https://www.nexusshield.ai/ · Gizli — paydaş incelemesi içindir",
            pdf_title="Nexus Shield Kurumsal Genel Bakış",
        ),
    },
}

# Layout constants (points: 1 inch = 72pt)
MARGIN_INCH = 0.75
SPACER_SM = 12  # ~12pt conservative vertical gap
SPACER_MD = 15


def _require_reportlab():
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            KeepTogether,
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
        from reportlab.platypus.xpreformatted import XPreformatted

        return (
            colors,
            TA_CENTER,
            TA_LEFT,
            letter,
            ParagraphStyle,
            getSampleStyleSheet,
            inch,
            KeepTogether,
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
            XPreformatted,
        )
    except ImportError as exc:
        print("Missing dependency: reportlab. Install with: pip install reportlab", file=sys.stderr)
        raise SystemExit(1) from exc


def _escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def register_deck_fonts() -> dict[str, str]:
    """Register Unicode TTF fonts for Turkish (ğ, ü, ş, ö, ç, ı, İ) and Latin body text."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    win = Path(r"C:/Windows/Fonts")
    pairs = [
        (
            win / "arial.ttf",
            win / "arialbd.ttf",
            win / "ariali.ttf",
            win / "consola.ttf",
        ),
        (
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
        ),
    ]
    for regular, bold, italic, mono in pairs:
        if regular.is_file() and bold.is_file() and italic.is_file() and mono.is_file():
            pdfmetrics.registerFont(TTFont("DeckSans", str(regular)))
            pdfmetrics.registerFont(TTFont("DeckSans-Bold", str(bold)))
            pdfmetrics.registerFont(TTFont("DeckSans-Oblique", str(italic)))
            pdfmetrics.registerFont(TTFont("DeckMono", str(mono)))
            return {
                "regular": "DeckSans",
                "bold": "DeckSans-Bold",
                "italic": "DeckSans-Oblique",
                "mono": "DeckMono",
            }

    return {
        "regular": "Helvetica",
        "bold": "Helvetica-Bold",
        "italic": "Helvetica-Oblique",
        "mono": "Courier",
    }


def _inline_md_to_xml(text: str, mono_font: str = "Courier") -> str:
    """Minimal markdown inline: **bold**, `code`, [text](url) -> text only for links."""
    text = _escape_xml(text.strip())
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(
        r"`([^`]+)`",
        rf"<font name='{mono_font}' size='8'>\1</font>",
        text,
    )
    text = re.sub(r"\[(.+?)\]\([^)]+\)", r"\1", text)
    return text


def _parse_table_rows(lines: list[str]) -> list[list[str]] | None:
    if len(lines) < 2:
        return None
    if not all("|" in ln for ln in lines[:2]):
        return None
    if not re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", lines[1]):
        return None

    def split_row(line: str) -> list[str]:
        return [c.strip() for c in line.strip().strip("|").split("|")]

    return [split_row(ln) for ln in lines if ln.strip() and not re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", ln)]


def _column_widths(col_count: int, content_width: float) -> list[float]:
    """Proportional column widths that sum to content_width."""
    if col_count <= 0:
        return [content_width]
    if col_count == 1:
        return [content_width]
    if col_count == 2:
        return [content_width * 0.34, content_width * 0.66]
    if col_count == 3:
        return [content_width * 0.20, content_width * 0.32, content_width * 0.48]
    if col_count == 4:
        return [
            content_width * 0.16,
            content_width * 0.22,
            content_width * 0.30,
            content_width * 0.32,
        ]
    share = content_width / col_count
    return [share] * col_count


def _load_sections(md_path: Path) -> list[tuple[str, list[str]]]:
    text = md_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = []
    current_title = "Introduction"
    current_lines: list[str] = []

    for line in lines:
        if line.startswith("## "):
            if current_lines or sections:
                sections.append((current_title, current_lines))
            current_title = line[3:].strip()
            current_lines = []
        elif line.startswith("# ") and not sections:
            continue
        else:
            current_lines.append(line)

    if current_lines or not sections:
        sections.append((current_title, current_lines))
    return sections


class _DeckBuilder:
    def __init__(
        self,
        source: Path,
        content_width: float,
        meta: DeckMeta,
        fonts: dict[str, str],
    ):
        self.source = source
        self.content_width = content_width
        self.meta = meta
        self.fonts = fonts
        self.mono_font = fonts["mono"]
        (
            self.colors,
            self.TA_CENTER,
            self.TA_LEFT,
            letter,
            ParagraphStyle,
            getSampleStyleSheet,
            inch,
            KeepTogether,
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
            XPreformatted,
        ) = _require_reportlab()

        self.letter = letter
        self.SimpleDocTemplate = SimpleDocTemplate
        self.KeepTogether = KeepTogether
        self.PageBreak = PageBreak
        self.Paragraph = Paragraph
        self.Spacer = Spacer
        self.Table = Table
        self.TableStyle = TableStyle
        self.XPreformatted = XPreformatted

        styles = getSampleStyleSheet()
        self.title_style = ParagraphStyle(
            "DeckTitle",
            parent=styles["Title"],
            fontSize=20,
            leading=24,
            alignment=self.TA_CENTER,
            textColor=self.colors.HexColor("#0f766e"),
            spaceAfter=SPACER_SM,
        )
        self.tagline_style = ParagraphStyle(
            "DeckTagline",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            alignment=self.TA_CENTER,
            textColor=self.colors.HexColor("#334155"),
            spaceAfter=SPACER_SM,
        )
        self.h1_style = ParagraphStyle(
            "SectionH1",
            parent=styles["Heading1"],
            fontSize=15,
            leading=18,
            textColor=self.colors.HexColor("#0f172a"),
            spaceBefore=SPACER_SM,
            spaceAfter=SPACER_SM,
        )
        self.h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Heading2"],
            fontSize=11,
            leading=14,
            textColor=self.colors.HexColor("#115e59"),
            spaceBefore=SPACER_SM,
            spaceAfter=8,
        )
        self.body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            alignment=self.TA_LEFT,
            spaceAfter=8,
            wordWrap="LTR",
        )
        self.bullet_style = ParagraphStyle(
            "Bullet",
            parent=self.body_style,
            leftIndent=12,
            spaceAfter=6,
            wordWrap="LTR",
        )
        self.quote_style = ParagraphStyle(
            "Quote",
            parent=self.body_style,
            leftIndent=14,
            textColor=self.colors.HexColor("#475569"),
            fontName="Helvetica-Oblique",
            wordWrap="LTR",
        )
        self.table_cell_style = ParagraphStyle(
            "TableCell",
            parent=self.body_style,
            fontSize=8,
            leading=10,
            spaceAfter=0,
            spaceBefore=0,
            wordWrap="LTR",
        )
        self.table_header_style = ParagraphStyle(
            "TableHeader",
            parent=self.table_cell_style,
            fontName="Helvetica-Bold",
            textColor=self.colors.HexColor("#0f172a"),
        )
        self.code_style = ParagraphStyle(
            "CodeBlock",
            parent=self.body_style,
            fontName=fonts["mono"],
            fontSize=7,
            leading=9,
            leftIndent=4,
            rightIndent=4,
            spaceAfter=0,
            spaceBefore=0,
        )
        self._apply_fonts(fonts)

        self.story: list = []

    def _apply_fonts(self, fonts: dict[str, str]) -> None:
        for style in (
            self.title_style,
            self.tagline_style,
            self.h1_style,
            self.h2_style,
            self.body_style,
            self.bullet_style,
            self.table_cell_style,
        ):
            style.fontName = fonts["regular"]
        self.table_header_style.fontName = fonts["bold"]
        self.quote_style.fontName = fonts["italic"]

    def _md(self, text: str) -> str:
        return _inline_md_to_xml(text, self.mono_font)

    def _p(self, text: str, style) -> object:
        return self.Paragraph(self._md(text), style)

    def _table_flowable(self, rows: list[list[str]]) -> object:
        col_count = max(len(r) for r in rows)
        normalized = [r + [""] * (col_count - len(r)) for r in rows]
        widths = _column_widths(col_count, self.content_width)

        para_rows: list[list[object]] = []
        for ri, row in enumerate(normalized):
            para_rows.append(
                [
                    self.Paragraph(
                        self._md(cell),
                        self.table_header_style if ri == 0 else self.table_cell_style,
                    )
                    for cell in row
                ]
            )

        tbl = self.Table(para_rows, colWidths=widths, repeatRows=1)
        tbl.setStyle(
            self.TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), self.colors.HexColor("#ecfdf5")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), self.colors.HexColor("#0f172a")),
                    ("GRID", (0, 0), (-1, -1), 0.25, self.colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [self.colors.white, self.colors.HexColor("#f8fafc")],
                    ),
                ]
            )
        )
        return tbl

    def _code_block(self, lines: list[str]) -> object:
        text = "\n".join(lines).rstrip()
        if not text:
            return self.Spacer(1, SPACER_SM)
        inner_width = self.content_width - 20
        max_line_len = max((len(line) for line in lines), default=0)
        # Shrink monospace font so wide diagram lines fit within margins.
        font_size = 7
        char_w = font_size * 0.52
        if max_line_len * char_w > inner_width and max_line_len > 0:
            font_size = max(5.0, inner_width / (max_line_len * 0.52))
        from reportlab.lib.styles import ParagraphStyle as PS

        block_style = PS(
            "CodeBlockDynamic",
            parent=self.code_style,
            fontSize=font_size,
            leading=font_size + 2,
        )
        return self.XPreformatted(text, block_style, dedent=0)

    def _append_block(self, flowables: list[object], keep: bool = False) -> None:
        if keep and len(flowables) > 1:
            self.story.append(self.KeepTogether(flowables))
        else:
            self.story.extend(flowables)

    def build(self) -> list:
        from reportlab.lib.units import inch

        self.story.append(self.Spacer(1, 0.85 * inch))
        self.story.append(self._p(self.meta.product_name, self.title_style))
        self.story.append(self.Spacer(1, SPACER_MD))
        self.story.append(self._p(self.meta.tagline, self.tagline_style))
        self.story.append(self.Spacer(1, SPACER_MD))
        self.story.append(self._p(self.meta.cover_subtitle, self.tagline_style))
        self.story.append(self.Spacer(1, SPACER_MD))
        self.story.append(self._p(self.meta.cover_footer, self.tagline_style))
        self.story.append(self.PageBreak())

        sections = _load_sections(self.source)

        for sec_idx, (sec_title, sec_lines) in enumerate(sections):
            section_head = [
                self._p(sec_title, self.h1_style),
                self.Spacer(1, SPACER_SM),
            ]
            if sec_idx == 0:
                self.story.extend(section_head)
            else:
                self.story.append(self.Spacer(1, SPACER_MD))
                self.story.extend(section_head)

            i = 0
            pending_h2: object | None = None

            def flush_h2_with_table(tbl: object) -> None:
                nonlocal pending_h2
                if pending_h2 is not None:
                    self._append_block(
                        [pending_h2, self.Spacer(1, 8), tbl, self.Spacer(1, SPACER_SM)],
                        keep=True,
                    )
                    pending_h2 = None
                else:
                    self.story.append(tbl)
                    self.story.append(self.Spacer(1, SPACER_SM))

            while i < len(sec_lines):
                line = sec_lines[i]
                stripped = line.strip()

                if not stripped:
                    i += 1
                    continue
                if stripped == "---":
                    i += 1
                    continue
                if stripped.startswith("### "):
                    if pending_h2 is not None:
                        self.story.append(pending_h2)
                        pending_h2 = None
                    pending_h2 = self._p(stripped[4:], self.h2_style)
                    i += 1
                    continue
                if stripped.startswith("```"):
                    if pending_h2 is not None:
                        self.story.append(pending_h2)
                        pending_h2 = None
                    block: list[str] = []
                    i += 1
                    while i < len(sec_lines) and not sec_lines[i].strip().startswith("```"):
                        block.append(sec_lines[i])
                        i += 1
                    if i < len(sec_lines):
                        i += 1
                    code = self._code_block(block)
                    wrapper = self.Table(
                        [[code]],
                        colWidths=[self.content_width],
                        style=self.TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, -1), self.colors.HexColor("#f1f5f9")),
                                ("BOX", (0, 0), (-1, -1), 0.5, self.colors.HexColor("#cbd5e1")),
                                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                                ("TOPPADDING", (0, 0), (-1, -1), 6),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                            ]
                        ),
                    )
                    self._append_block([wrapper, self.Spacer(1, SPACER_SM)], keep=len(block) <= 12)
                    continue
                if stripped.startswith("> "):
                    if pending_h2 is not None:
                        self.story.append(pending_h2)
                        pending_h2 = None
                    self.story.append(self._p(stripped[2:], self.quote_style))
                    i += 1
                    continue
                if stripped.startswith("|"):
                    table_block: list[str] = []
                    while i < len(sec_lines) and sec_lines[i].strip().startswith("|"):
                        table_block.append(sec_lines[i])
                        i += 1
                    rows = _parse_table_rows(table_block)
                    if rows and len(rows) >= 1:
                        tbl = self._table_flowable(rows)
                        if pending_h2 is not None:
                            flush_h2_with_table(tbl)
                        else:
                            self._append_block(
                                [tbl, self.Spacer(1, SPACER_SM)],
                                keep=len(rows) <= 8,
                            )
                    continue
                if stripped.startswith("- "):
                    if pending_h2 is not None:
                        self.story.append(pending_h2)
                        pending_h2 = None
                    self.story.append(
                        self.Paragraph(f"• {self._md(stripped[2:])}", self.bullet_style)
                    )
                    i += 1
                    continue
                if re.match(r"^\d+\.\s", stripped):
                    if pending_h2 is not None:
                        self.story.append(pending_h2)
                        pending_h2 = None
                    self.story.append(self._p(stripped, self.bullet_style))
                    i += 1
                    continue

                if pending_h2 is not None:
                    self.story.append(pending_h2)
                    pending_h2 = None
                self.story.append(self._p(stripped, self.body_style))
                i += 1

            if pending_h2 is not None:
                self.story.append(pending_h2)

        return self.story


def build_story(source: Path, content_width: float, meta: DeckMeta, fonts: dict[str, str]):
    builder = _DeckBuilder(source, content_width, meta, fonts)
    story = builder.build()
    return story, builder.letter, builder.SimpleDocTemplate


def generate_pdf(source: Path, output: Path, meta: DeckMeta) -> Path:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch

    fonts = register_deck_fonts()
    margin = MARGIN_INCH * inch
    content_width = letter[0] - (2 * margin)

    story, _, SimpleDocTemplate = build_story(source, content_width, meta, fonts)
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        rightMargin=margin,
        leftMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
        title=meta.pdf_title,
        author="Nexus Shield",
    )
    doc.build(story)
    return output


def resolve_paths(
    lang: str,
    source: Path | None,
    output: Path | None,
) -> tuple[Path, Path, DeckMeta]:
    profile = LANG_PROFILES[lang]
    meta = profile["meta"]
    assert isinstance(meta, DeckMeta)
    resolved_source = source if source is not None else profile["source"]
    resolved_output = output if output is not None else profile["output"]
    assert isinstance(resolved_source, Path)
    assert isinstance(resolved_output, Path)
    return resolved_source, resolved_output, meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Nexus Shield enterprise overview PDF.")
    parser.add_argument(
        "--lang",
        choices=sorted(LANG_PROFILES.keys()),
        default="en",
        help="Language profile for default source/output and cover copy (default: en)",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="Markdown source (overrides --lang default source)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output PDF path (overrides --lang default output)",
    )
    args = parser.parse_args()

    source, output, meta = resolve_paths(args.lang, args.source, args.output)

    if not source.is_file():
        print(f"Source not found: {source}", file=sys.stderr)
        raise SystemExit(1)

    out = generate_pdf(source.resolve(), output.resolve(), meta)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
