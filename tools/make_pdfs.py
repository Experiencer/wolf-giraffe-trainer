#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_pdfs.py – v1
Druckvorlagen (PDF) für den Tab „Lernkarten“ im Wolf & Giraffe Trainer.

Erzeugt im Ordner pdf/:
  gefuehlskarten.pdf     aus src/data/lernkarten.json  (gefuehle.erfuellt / gefuehle.unerfuellt)
  beduerfniskarten.pdf   aus src/data/lernkarten.json  (beduerfnisse, dazu eine Seite aus pseudo)
  spickzettel.pdf        aus src/data/spickzettel.json (das Feld „hoeren“ wird nicht gedruckt)
  workshop-handout.pdf   aus src/data/handout.json

Aufruf im Repo-Ordner:
  python3 tools/make_pdfs.py                       alle PDFs
  python3 tools/make_pdfs.py --data /tmp/pdftest   andere Datenquelle (z. B. Testdaten)
  python3 tools/make_pdfs.py --only handout        nur bestimmte PDFs
                                                   (gefuehle, beduerfnisse, spickzettel, handout)
  python3 tools/make_pdfs.py --out /tmp/pdfs       anderer Zielordner

Fehlt eine JSON-Datei, wird nur das betroffene PDF übersprungen (mit Meldung).

Benötigt: Python 3.9+ und  pip install reportlab fonttools brotli
Die Schriften kommen aus src/fonts/*.woff2 und werden einmalig nach tools/.fontcache/ (TTF)
umgewandelt. Source Sans 3 ist eine variable Schrift; daraus entstehen feste Schnitte
(400, 600, 700, kursiv 400). reportlab bettet nur die benutzten Zeichen ein (Subset).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from fontTools.ttLib import TTFont as FTFont
    from fontTools.varLib import instancer
    from reportlab.lib.colors import HexColor
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont as RLTTFont
    from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Flowable, Frame, KeepTogether,
                                    NextPageTemplate, PageBreak, PageTemplate, Paragraph, Spacer,
                                    Table, TableStyle)
except ImportError as err:  # pragma: no cover
    print("Es fehlt ein Python-Paket (%s).\nBitte einmal ausführen:\n"
          "  pip install reportlab fonttools brotli" % err.name, file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "src" / "fonts"
ASSET_DIR = ROOT / "src" / "assets"
CACHE_DIR = ROOT / "tools" / ".fontcache"
DEFAULT_DATA = ROOT / "src" / "data"
DEFAULT_OUT = ROOT / "pdf"

PAGE_W, PAGE_H = A4
AUTHOR = "Wolf & Giraffe Trainer"
CNVC_LINE = ("Wortlisten angelehnt an das Feelings & Needs Inventory des CNVC (© 2005, www.cnvc.org). "
             "Keine Empfehlung durch das CNVC.")
IMAGE_CREDIT = "Bilder: Katemangostar / Freepik.com"

# ---------------------------------------------------------------------------
# Farben (aus src/styles.css, helles Design) – Kontraste geprüft (WCAG 2.2 AA)
# ---------------------------------------------------------------------------
C_INK = HexColor("#221B17")
C_MUTED = HexColor("#5F534C")
C_ACCENT = HexColor("#B83C00")
C_BAND = HexColor("#FC4700")          # Leuchtorange: nur schmales Band / Akzent, nie für Text
C_LINE = HexColor("#E8DAD0")
C_SURFACE2 = HexColor("#FAF0E8")
C_ACCENT_SOFT = HexColor("#FFE6D9")
C_ACCENT_SOFT_INK = HexColor("#8F2F00")
C_COACH_INK = HexColor("#8A4A12")
C_CUT = HexColor("#B9ADA4")           # Schnittlinien zwischen den Karten
C_MARK = HexColor("#5F534C")          # Schnittmarken am Rand
C_WRITE = HexColor("#C2B6AD")         # Schreiblinien


@dataclass(frozen=True)
class Pal:
    """Kartenfarbe: helle Fläche + dunkle Schrift (Kontrast ≥ 6 : 1)."""
    bg: str
    ink: str

    @property
    def c_bg(self):
        return HexColor(self.bg)

    @property
    def c_ink(self):
        return HexColor(self.ink)


PAL_ERFUELLT = Pal("#FFF0BF", "#6B4500")      # warm, helles Gelb
PAL_UNERFUELLT = Pal("#DCE8F5", "#1D4266")    # kühl, helles Blau
PAL_BEREICHE = [                              # acht ruhige Farben für Bedürfnis-Bereiche
    Pal("#E2EFDF", "#2D5730"),   # Salbeigrün
    Pal("#F8E0E3", "#7A2B3A"),   # Rosé
    Pal("#DCEAF7", "#1F4C78"),   # Himmelblau
    Pal("#F5E9C9", "#694C0B"),   # Ocker
    Pal("#E8E2F3", "#4A3677"),   # Lavendel
    Pal("#FCE4D2", "#8A3B0E"),   # Aprikose
    Pal("#D9EEEA", "#1C5A53"),   # Petrol
    Pal("#ECE7E2", "#4A413B"),   # Stein
]


def _lum(hexcol: str) -> float:
    h = hexcol.lstrip("#")
    vals = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    vals = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in vals]
    return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# ---------------------------------------------------------------------------
# Schriften
# ---------------------------------------------------------------------------
FONT_FILES = {
    # Name in reportlab : (Datei in src/fonts, feste Achsenwerte oder None)
    "Sans": ("source-sans-3-latin-wght-normal.woff2", {"wght": 400}),
    "Sans-Semi": ("source-sans-3-latin-wght-normal.woff2", {"wght": 600}),
    "Sans-Bold": ("source-sans-3-latin-wght-normal.woff2", {"wght": 700}),
    "Sans-Italic": ("source-sans-3-latin-wght-italic.woff2", {"wght": 400}),
    "Ultra": ("ultra-latin-400-normal.woff2", None),
    "Hand": ("caveat-brush-latin-400-normal.woff2", None),
}
FONT_CACHE_VERSION = "v1"
# Ersatzschrift für Zeichen, die in den Web-Schriften fehlen (z. B. →, ✓, ●).
FALLBACK_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "C:/Windows/Fonts/seguisym.ttf",
    "C:/Windows/Fonts/arialuni.ttf",
]
# Falls auch die Ersatzschrift fehlt: einfache Umschreibung.
SUBST = {"→": "›", "←": "‹", "⇒": "›", "✓": "•", "✔": "•", "●": "•", "◐": "•", "○": "•",
         "✗": "×", "✘": "×", "≠": "/=", "≈": "~", "★": "*", "☆": "*", "✂": "", "️": ""}

COVER: dict[str, set[int]] = {}
FALLBACK: str | None = None
MISSING: set[str] = set()


def _set_names(font, family: str, style: str, ps: str) -> None:
    """Eindeutige Namen je Schnitt, damit die Schriften im PDF sauber getrennt sind."""
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17):
            name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, family), (2, style), (3, ps), (4, f"{family} {style}"), (6, ps)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)


def prepare_fonts() -> None:
    global FALLBACK
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for rl_name, (fname, axes) in FONT_FILES.items():
        src = FONT_DIR / fname
        if not src.exists():
            raise SystemExit(f"Schrift fehlt: {src}")
        dst = CACHE_DIR / f"{rl_name}-{FONT_CACHE_VERSION}.ttf"   # neue Version = Cache neu bauen
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            try:
                font = FTFont(str(src))
            except Exception as err:  # meist fehlt „brotli“ zum Entpacken von WOFF2
                raise SystemExit(f"Kann {src.name} nicht lesen ({err}).\n"
                                 "Tipp: pip install brotli fonttools")
            if axes:
                font = instancer.instantiateVariableFont(font, axes)
            font.flavor = None
            ps = "WGT-" + rl_name.replace(" ", "")
            _set_names(font, "WGT " + rl_name.split("-")[0], rl_name.split("-")[1] if "-" in rl_name else "Regular", ps)
            font.save(str(dst))
        pdfmetrics.registerFont(RLTTFont(rl_name, str(dst)))
        COVER[rl_name] = set(FTFont(str(dst), lazy=True).getBestCmap().keys())
    pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold",
                                  italic="Sans-Italic", boldItalic="Sans-Bold")
    for cand in FALLBACK_CANDIDATES:
        p = Path(cand)
        if p.exists():
            try:
                pdfmetrics.registerFont(RLTTFont("Fallback", str(p)))
                COVER["Fallback"] = set(FTFont(str(p), lazy=True).getBestCmap().keys())
                FALLBACK = "Fallback"
                break
            except Exception:
                continue


# ---------------------------------------------------------------------------
# Text-Helfer
# ---------------------------------------------------------------------------
def clean(text) -> str:
    if text is None:
        return ""
    if isinstance(text, (list, tuple)):
        return " ".join(clean(t) for t in text)
    if isinstance(text, dict):
        for key in ("t", "text", "titel", "aufgabe"):
            if key in text:
                return clean(text[key])
        return " ".join(clean(v) for v in text.values() if isinstance(v, str))
    return str(text).replace("\r\n", "\n").strip()


def mk(text, font: str = "Sans") -> str:
    """Text → reportlab-Absatz-Markup: maskiert &<>, **fett**, Zeilenumbrüche,
    Zeichen ohne Glyphe in der Ersatzschrift (oder umschreiben)."""
    text = clean(text)
    cov = COVER.get(font, COVER.get("Sans", set()))
    out = []
    for ch in text:
        if ch == "&":
            out.append("&amp;")
        elif ch == "<":
            out.append("&lt;")
        elif ch == ">":
            out.append("&gt;")
        elif ch == "\n":
            out.append("<br/>")
        elif ord(ch) in cov or ch in " \t*":
            out.append(ch)
        elif FALLBACK and ord(ch) in COVER["Fallback"]:
            out.append(f'<font name="{FALLBACK}">{ch}</font>')
        elif ch in SUBST:
            out.append(SUBST[ch])
        else:
            MISSING.add(ch)
    s = "".join(out)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    return s


def runs(text: str, font: str):
    """Teilt Text in Abschnitte gleicher Schrift (für Zeichnen direkt auf die Seite)."""
    cov = COVER.get(font, set())
    result: list[list[str]] = []
    for ch in clean(text):
        if ord(ch) in cov or ch == " ":
            f, s = font, ch
        elif FALLBACK and ord(ch) in COVER["Fallback"]:
            f, s = FALLBACK, ch
        elif ch in SUBST:
            f, s = font, SUBST[ch]
        else:
            MISSING.add(ch)
            continue
        if result and result[-1][1] == f:
            result[-1][0] += s
        else:
            result.append([s, f])
    return [(s, f) for s, f in result if s]


def text_w(text: str, font: str, size: float, cs: float = 0) -> float:
    return sum(pdfmetrics.stringWidth(s, f, size) + cs * len(s) for s, f in runs(text, font))


def draw_text(c, x, y, text, font, size, color=C_INK, align="left", cs=0.0) -> float:
    total = text_w(text, font, size, cs)
    if align == "center":
        x -= total / 2
    elif align == "right":
        x -= total
    c.setFillColor(color)
    for s, f in runs(text, font):
        c.setFont(f, size)
        c.drawString(x, y, s, charSpace=cs)
        x += pdfmetrics.stringWidth(s, f, size) + cs * len(s)
    return total


def upper_de(text: str) -> str:
    return clean(text).upper()


def fit_lines(text: str, font: str, width: float, sizes, max_lines: int):
    """Größte Schriftgröße, bei der `text` in höchstens `max_lines` Zeilen passt,
    ohne Wörter zu trennen. Gibt (size, [zeilen]) zurück oder None."""
    words = clean(text).split()
    for size in sizes:
        lines, cur = [], ""
        ok = True
        for w in words:
            cand = (cur + " " + w).strip()
            if text_w(cand, font, size) <= width:
                cur = cand
            else:
                if not cur:
                    ok = False
                    break
                lines.append(cur)
                cur = w
                if text_w(cur, font, size) > width:
                    ok = False
                    break
        if not ok:
            continue
        if cur:
            lines.append(cur)
        if len(lines) <= max_lines:
            return size, lines
    return None


def frange(start, stop, step):
    v = start
    while v >= stop - 1e-9:
        yield round(v, 2)
        v -= step


# ---------------------------------------------------------------------------
# Absatzformate
# ---------------------------------------------------------------------------
def S(name, **kw) -> ParagraphStyle:
    base = dict(fontName="Sans", fontSize=10.5, leading=14.5, textColor=C_INK, spaceBefore=0,
                spaceAfter=0, allowWidows=0, allowOrphans=0, hyphenationLang=None)
    base.update(kw)
    return ParagraphStyle(name, **base)


ST = {
    "body": S("body"),
    "body11": S("body11", fontSize=11, leading=15.5),
    "small": S("small", fontSize=9, leading=12.5, textColor=C_MUTED),
    "tiny": S("tiny", fontSize=7.5, leading=10, textColor=C_MUTED),
    "overline": S("overline", fontName="Sans-Bold", fontSize=8.5, leading=11, textColor=C_ACCENT),
    "title": S("title", fontName="Ultra", fontSize=30, leading=36, textColor=C_INK),
    "h1": S("h1", fontName="Ultra", fontSize=22, leading=27, textColor=C_INK),
    "h2": S("h2", fontName="Sans-Bold", fontSize=12.5, leading=16, textColor=C_INK),
    "h3": S("h3", fontName="Sans-Bold", fontSize=11, leading=14.5, textColor=C_INK),
    "sub": S("sub", fontSize=14, leading=19, textColor=C_MUTED),
    "hand": S("hand", fontName="Hand", fontSize=16, leading=19, textColor=C_COACH_INK),
    "step": S("step", leftIndent=16, bulletIndent=0, bulletFontName="Sans-Bold",
              bulletFontSize=10.5, bulletColor=C_ACCENT, spaceAfter=3.5),
    "bullet": S("bullet", leftIndent=11, bulletIndent=0, bulletFontName="Sans-Bold",
                bulletColor=C_ACCENT, spaceAfter=2.5),
    "task": S("task", fontName="Sans-Semi", leftIndent=16, bulletIndent=0, bulletFontName="Sans-Bold",
              bulletColor=C_ACCENT),
    "th": S("th", fontName="Sans-Bold", fontSize=9.5, leading=12.5, textColor=C_INK),
    "td": S("td", fontSize=10, leading=13.5),
    "tdb": S("tdb", fontName="Sans-Semi", fontSize=10, leading=13.5),
}


def P(text, style="body", font=None, **kw) -> Paragraph:
    st = ST[style] if isinstance(style, str) else style
    if kw:
        st = ParagraphStyle(st.name + "x", parent=st, **kw)
    return Paragraph(mk(text, font or st.fontName), st)


# ---------------------------------------------------------------------------
# Eigene Bausteine (Flowables)
# ---------------------------------------------------------------------------
class Brand(Flowable):
    """Wolf- und Giraffenbild (rund) + Schriftzug – nur auf Deckblättern."""

    def __init__(self, size=17 * mm):
        super().__init__()
        self.size = size

    def wrap(self, aw, ah):
        self.aw = aw
        return aw, self.size

    def draw(self):
        c, s = self.canv, self.size
        x = 0
        for name in ("wolf.jpg", "giraffe.jpg"):
            path = ASSET_DIR / name
            if path.exists():
                c.saveState()
                p = c.beginPath()
                p.circle(x + s / 2, s / 2, s / 2)
                c.clipPath(p, stroke=0, fill=0)
                c.drawImage(str(path), x, 0, s, s, mask=None)
                c.restoreState()
            x += s * 0.86
        x += s * 0.14 + 4 * mm
        draw_text(c, x, s / 2 - 5, "Wolf & Giraffe Trainer", "Ultra", 15, C_INK)


class Band(Flowable):
    """Schmales Marken-Band in Leuchtorange."""

    def __init__(self, height=2.6 * mm, width=None):
        super().__init__()
        self.h, self.w = height, width

    def wrap(self, aw, ah):
        self.aw = self.w or aw
        return self.aw, self.h

    def draw(self):
        self.canv.setFillColor(C_BAND)
        self.canv.rect(0, 0, self.aw, self.h, stroke=0, fill=1)


class Chips(Flowable):
    """Kleine Etiketten in einer Zeile (bricht um, wenn nötig)."""

    def __init__(self, items, size=8.5, pad=2.2 * mm, h=5.6 * mm, gap=1.6 * mm):
        super().__init__()
        self.items = [(clean(t), bg, ink, font) for t, bg, ink, font in items if clean(t)]
        self.size, self.pad, self.ch, self.gap = size, pad, h, gap

    def _layout(self, aw):
        pos, x, row = [], 0, 0
        for t, bg, ink, font in self.items:
            w = text_w(t, font, self.size) + 2 * self.pad
            if x > 0 and x + w > aw:
                x, row = 0, row + 1
            pos.append((x, row, w, t, bg, ink, font))
            x += w + self.gap
        return pos, row + 1

    def wrap(self, aw, ah):
        self.pos, rows = self._layout(aw)
        self.height = rows * self.ch + (rows - 1) * self.gap
        return aw, self.height

    def draw(self):
        c = self.canv
        for x, row, w, t, bg, ink, font in self.pos:
            y = self.height - (row + 1) * self.ch - row * self.gap
            c.setFillColor(bg)
            c.roundRect(x, y, w, self.ch, self.ch / 2, stroke=0, fill=1)
            draw_text(c, x + self.pad, y + self.ch / 2 - self.size * 0.34, t, font, self.size, ink)


class WriteLines(Flowable):
    """Schreiblinien für Arbeitsblätter."""

    def __init__(self, n, gap=8 * mm, indent=16):
        super().__init__()
        self.n, self.gap, self.indent = n, gap, indent

    def wrap(self, aw, ah):
        self.aw = aw
        return aw, self.n * self.gap + 1.5 * mm

    def draw(self):
        c = self.canv
        c.setStrokeColor(C_WRITE)
        c.setLineWidth(0.6)
        for i in range(self.n):
            y = (self.n - i - 1) * self.gap + 1.5 * mm
            c.line(self.indent, y, self.aw, y)


class CheckRow(Flowable):
    """Ankreuzfelder, z. B. □ Beobachtung   □ Bewertung."""

    def __init__(self, labels, indent=16, size=9.5):
        super().__init__()
        self.labels, self.indent, self.size = [clean(l) for l in labels], indent, size

    def wrap(self, aw, ah):
        return aw, 5.5 * mm

    def draw(self):
        c, x, box = self.canv, self.indent, 3.4 * mm
        for lab in self.labels:
            c.setStrokeColor(C_MUTED)
            c.setLineWidth(0.8)
            c.roundRect(x, 1.0 * mm, box, box, 0.6 * mm, stroke=1, fill=0)
            x += box + 1.8 * mm
            x += draw_text(c, x, 1.0 * mm + 0.6, lab, "Sans", self.size, C_INK) + 7 * mm


class Legend(Flowable):
    """Farblegende als Etiketten mit Markierung (Punkt / Ring / ohne)."""

    def __init__(self, items, cols=2, h=7.5 * mm, gap=2.2 * mm):
        super().__init__()
        self.items, self.cols, self.h, self.gap = items, cols, h, gap

    def wrap(self, aw, ah):
        self.aw = aw
        self.rows = (len(self.items) + self.cols - 1) // self.cols
        return aw, self.rows * self.h + (self.rows - 1) * self.gap

    def draw(self):
        c = self.canv
        cw = (self.aw - (self.cols - 1) * self.gap) / self.cols
        total_h = self.rows * self.h + (self.rows - 1) * self.gap
        for i, (label, pal, marker) in enumerate(self.items):
            col, row = i % self.cols, i // self.cols
            x = col * (cw + self.gap)
            y = total_h - (row + 1) * self.h - row * self.gap
            c.setFillColor(pal.c_bg)
            c.roundRect(x, y, cw, self.h, 2 * mm, stroke=0, fill=1)
            tx = x + 3 * mm
            if marker:
                draw_marker(c, tx + 1.4 * mm, y + self.h / 2, marker, pal.c_ink, r=1.4 * mm)
                tx += 4.6 * mm
            draw_text(c, tx, y + self.h / 2 - 3.2, label, "Sans-Semi", 9.5, pal.c_ink)


def draw_marker(c, cx, cy, marker, color, r=1.2 * mm):
    c.setStrokeColor(color)
    c.setFillColor(color)
    if marker == "dot":
        c.circle(cx, cy, r, stroke=0, fill=1)
    elif marker == "ring":
        c.setLineWidth(0.9)
        c.circle(cx, cy, r - 0.45, stroke=1, fill=0)


def TS(cmds) -> TableStyle:
    """Tabellenformat mit eigener Schrift (sonst setzt reportlab Helvetica als Vorgabe)."""
    return TableStyle([("FONTNAME", (0, 0), (-1, -1), "Sans")] + list(cmds))


def box(flowables, width, bg=C_SURFACE2, border=None, accent_left=None, pad=3.2 * mm, radius=2.2 * mm):
    """Kasten mit heller Fläche (oder Rahmen) um mehrere Bausteine."""
    t = Table([[flowables]], colWidths=[width])
    cmds = [("LEFTPADDING", (0, 0), (-1, -1), pad + (1.2 * mm if accent_left else 0)),
            ("RIGHTPADDING", (0, 0), (-1, -1), pad),
            ("TOPPADDING", (0, 0), (-1, -1), pad * 0.8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
            ("VALIGN", (0, 0), (-1, -1), "TOP")]
    if bg is not None:
        cmds.append(("BACKGROUND", (0, 0), (-1, -1), bg))
    if border is not None:
        cmds.append(("BOX", (0, 0), (-1, -1), 0.8, border))
    if accent_left is not None:
        cmds.append(("LINEBEFORE", (0, 0), (0, -1), 2.4, accent_left))
    else:
        cmds.append(("ROUNDEDCORNERS", [radius] * 4))
    t.setStyle(TS(cmds))
    return t


class Sheet(Flowable):
    """Eine ganze Seite, die von einer Funktion gezeichnet wird (Karten, Spickzettel)."""

    def __init__(self, painter, *args):
        super().__init__()
        self.painter, self.args = painter, args

    def wrap(self, aw, ah):
        return aw, ah - 0.01

    def draw(self):
        self.painter(self.canv, *self.args)


# ---------------------------------------------------------------------------
# Seitenvorlagen
# ---------------------------------------------------------------------------
MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM = 20 * mm, 16 * mm, 18 * mm


def footer(c, doc_label: str, page: int, extra: str | None = None):
    y = 10 * mm
    draw_text(c, MARGIN_X, y, f"{AUTHOR} · {doc_label}", "Sans", 8, C_MUTED)
    draw_text(c, PAGE_W - MARGIN_X, y, f"Seite {page}", "Sans", 8, C_MUTED, align="right")
    if extra:
        draw_text(c, MARGIN_X, y - 3.6 * mm, extra, "Sans", 6.5, C_MUTED)


def make_doc(path: Path, title: str, subject: str, label: str, keywords):
    doc = BaseDocTemplate(
        str(path), pagesize=A4, title=title, author=AUTHOR, subject=subject,
        creator="Wolf & Giraffe Trainer – tools/make_pdfs.py", keywords=keywords,
        lang="de-DE", invariant=1, pageCompression=1, displayDocTitle=1,
        initialFontName="Sans", initialFontSize=10.5, initialLeading=14.5,
        leftMargin=MARGIN_X, rightMargin=MARGIN_X, topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM)
    text_frame = Frame(MARGIN_X, MARGIN_BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
                       id="text", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    full_frame = Frame(0, 0, PAGE_W, PAGE_H, id="full", leftPadding=0, rightPadding=0,
                       topPadding=0, bottomPadding=0)

    def on_intro(c, d):
        c.saveState()
        footer(c, label, d.page)
        c.restoreState()

    def on_text(c, d):
        c.saveState()
        c.setFillColor(C_BAND)
        c.rect(MARGIN_X, PAGE_H - 11 * mm, 16 * mm, 1.6 * mm, stroke=0, fill=1)
        footer(c, label, d.page)
        c.restoreState()

    def on_full(c, d):
        pass  # die Seite zeichnet Kopf/Fuß selbst

    doc.addPageTemplates([
        PageTemplate(id="intro", frames=[text_frame], onPage=on_intro),
        PageTemplate(id="text", frames=[text_frame], onPage=on_text),
        PageTemplate(id="full", frames=[full_frame], onPage=on_full),
    ])
    return doc


CONTENT_W = PAGE_W - 2 * MARGIN_X


def intro_page(title: str, subtitle: str, anleitung: list[str], ideen: list[tuple[str, str]],
               druck: str, extra=None, quelle: str = CNVC_LINE):
    """Erste Seite jedes Karten-PDFs: Titel, kurze Anleitung, Spielideen, Druckhinweis, Quelle."""
    story = [Band(), Spacer(1, 7 * mm), Brand(), Spacer(1, 9 * mm),
             P(title, "title"), Spacer(1, 2 * mm), P(subtitle, "sub"), Spacer(1, 7 * mm)]
    for para in anleitung:
        story += [P(para, "body11"), Spacer(1, 2.5 * mm)]
    if extra:
        story += [Spacer(1, 2 * mm)] + extra
    if ideen:
        inner = [P("Spielideen", "hand"), Spacer(1, 1.5 * mm)]
        for name, desc in ideen:
            inner.append(Paragraph(f"<b>{mk(name)}</b> – {mk(desc)}", ST["bullet"], bulletText="•"))
        story += [Spacer(1, 4 * mm), box(inner, CONTENT_W)]
    story += [Spacer(1, 6 * mm), P("Drucktipp", "h3"), Spacer(1, 1 * mm), P(druck, "body"),
              Spacer(1, 8 * mm), P(quelle + " " + IMAGE_CREDIT + ".", "tiny")]
    return story


# ---------------------------------------------------------------------------
# Karten (63 × 88 mm, 3 × 3 je A4-Seite, Schnittlinien + Schnittmarken)
# ---------------------------------------------------------------------------
CARD_W, CARD_H = 63 * mm, 88 * mm
COLS, ROWS = 3, 3
GRID_X = (PAGE_W - COLS * CARD_W) / 2
GRID_Y = (PAGE_H - ROWS * CARD_H) / 2


@dataclass
class Card:
    word: str
    label: str
    k: str
    pal: Pal
    marker: str | None
    kind: str


def draw_card(c, x, y, card: Card):
    pad = 4.2 * mm
    ix, iw = x + pad, CARD_W - 2 * pad
    top = y + CARD_H - pad
    # Kopf-Etikett: Gruppe/Bereich (+ Punkt/Ring bei Gefühlen)
    tag_h = 7.2 * mm
    c.setFillColor(card.pal.c_bg)
    c.roundRect(ix, top - tag_h, iw, tag_h, 2 * mm, stroke=0, fill=1)
    label = upper_de(card.label)
    avail = iw - 6 * mm - (4.5 * mm if card.marker else 0)
    size = 7.5
    while size > 5.5 and text_w(label, "Sans-Bold", size, 0.5) > avail:
        size -= 0.25
    draw_text(c, ix + 3 * mm, top - tag_h / 2 - size * 0.34, label, "Sans-Bold", size, card.pal.c_ink, cs=0.5)
    if card.marker:
        draw_marker(c, ix + iw - 3.6 * mm, top - tag_h / 2, card.marker, card.pal.c_ink, r=1.35 * mm)

    # Wort (groß, möglichst einzeilig) + Trennstrich + Kurztext bilden eine Gruppe,
    # die optisch mittig zwischen Etikett und Fußzeile steht.
    foot_y = y + pad + 0.6 * mm
    region_top = top - tag_h - 3 * mm
    region_bottom = foot_y + 5 * mm
    region_h = region_top - region_bottom
    fit = (fit_lines(card.word, "Sans-Bold", iw - 1 * mm, list(frange(24, 14, 0.5)), 1)
           or fit_lines(card.word, "Sans-Bold", iw - 1 * mm, list(frange(20, 9, 0.5)), 2)
           or fit_lines(card.word, "Sans-Bold", iw - 1 * mm, list(frange(12, 6, 0.25)), 3))
    if not fit:  # Notlösung für sehr lange Einzelwörter: so klein, dass das längste Wort passt
        longest = max(clean(card.word).split() or [card.word], key=lambda t: text_w(t, "Sans-Bold", 10))
        size = max(5.0, 10 * (iw - 1 * mm) / max(1, text_w(longest, "Sans-Bold", 10)))
        fit = fit_lines(card.word, "Sans-Bold", iw - 1 * mm, [size], 6) or (size, [card.word])
    size, lines = fit
    lead, cap, desc = size * 1.1, size * 0.66, size * 0.24
    word_h = lead * (len(lines) - 1) + cap + desc
    gap1, gap2 = 3.5 * mm, 4.5 * mm

    p, ph = None, 0
    if card.k:
        k_max = region_h - word_h - gap1 - gap2
        for fs in (10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5):
            st = S("k", fontSize=fs, leading=fs * 1.3, alignment=TA_CENTER, textColor=C_INK)
            p = Paragraph(mk(card.k), st)
            _, ph = p.wrap(iw - 2 * mm, k_max)
            if ph <= k_max:
                break
    group_h = word_h + ((gap1 + gap2 + ph) if p else 0)
    group_top = region_top - max(0, (region_h - group_h) / 2 - 3 * mm)

    base = group_top - cap
    for i, line in enumerate(lines):
        draw_text(c, x + CARD_W / 2, base - i * lead, line, "Sans-Bold", size, C_INK, align="center")
    if p:
        sep_y = group_top - word_h - gap1
        c.setStrokeColor(card.pal.c_ink)
        c.setLineWidth(0.8)
        c.line(x + CARD_W / 2 - 5 * mm, sep_y, x + CARD_W / 2 + 5 * mm, sep_y)
        p.drawOn(c, ix + 1 * mm, sep_y - gap2 - ph + 2)

    # Fußzeile der Karte
    draw_text(c, x + CARD_W / 2, foot_y, card.kind, "Sans", 6.5, C_MUTED, align="center")


def paint_card_page(c, cards: list[Card], deck: str, page_no: int):
    for i, card in enumerate(cards):
        col, row = i % COLS, i // COLS
        x = GRID_X + col * CARD_W
        y = GRID_Y + (ROWS - 1 - row) * CARD_H
        draw_card(c, x, y, card)
    # Schnittlinien: dünne Rahmen um jede vorhandene Karte
    c.setStrokeColor(C_CUT)
    c.setLineWidth(0.35)
    for i in range(len(cards)):
        col, row = i % COLS, i // COLS
        c.rect(GRID_X + col * CARD_W, GRID_Y + (ROWS - 1 - row) * CARD_H, CARD_W, CARD_H, stroke=1, fill=0)
    # Schnittmarken am Seitenrand (für Schneidemaschine)
    used_rows = (len(cards) + COLS - 1) // COLS
    used_cols = min(len(cards), COLS)
    c.setStrokeColor(C_MARK)
    c.setLineWidth(0.3)
    gap, length = 1.5 * mm, 4 * mm
    top_y = GRID_Y + ROWS * CARD_H
    bottom_y = top_y - used_rows * CARD_H
    for col in range(used_cols + 1):
        xx = GRID_X + col * CARD_W
        c.line(xx, top_y + gap, xx, top_y + gap + length)
        c.line(xx, bottom_y - gap, xx, bottom_y - gap - length)
    right_x = GRID_X + used_cols * CARD_W
    for row in range(used_rows + 1):
        yy = top_y - row * CARD_H
        c.line(GRID_X - gap, yy, GRID_X - gap - length, yy)
        c.line(right_x + gap, yy, right_x + gap + length, yy)
    # Fußzeile
    draw_text(c, PAGE_W / 2, 6.5 * mm, f"{AUTHOR} · {deck} · Seite {page_no} · {CNVC_LINE}",
              "Sans", 6.3, C_MUTED, align="center")


def card_sheets(cards: list[Card], deck: str, first_page: int):
    story = []
    for n, start in enumerate(range(0, len(cards), COLS * ROWS)):
        story.append(Sheet(paint_card_page, cards[start:start + COLS * ROWS], deck, first_page + n))
        story.append(PageBreak())
    return story


# ---------------------------------------------------------------------------
# Daten laden
# ---------------------------------------------------------------------------
class DataError(Exception):
    pass


def load_json(data_dir: Path, name: str):
    path = data_dir / name
    if not path.exists():
        raise DataError(f"Datei fehlt: {path}")
    # Erstellungsdatum im PDF = letzte Änderung der Daten. So bleibt die Datei bei
    # unveränderten Daten Byte für Byte gleich (keine unnötigen Änderungen im Git).
    os.environ["SOURCE_DATE_EPOCH"] = str(int(path.stat().st_mtime))
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise DataError(f"{path.name} ist kein gültiges JSON (Zeile {err.lineno}, Spalte {err.colno}: {err.msg})")


def as_list(x) -> list:
    return x if isinstance(x, list) else []


def words_of(entry) -> list[tuple[str, str]]:
    out = []
    if not isinstance(entry, dict):
        return out
    for w in as_list(entry.get("woerter")):
        if isinstance(w, str):
            out.append((w, ""))
        elif isinstance(w, dict) and clean(w.get("w")):
            out.append((clean(w.get("w")), clean(w.get("k"))))
    return out


# ---------------------------------------------------------------------------
# 1) Gefühlskarten
# ---------------------------------------------------------------------------
def build_gefuehle(data_dir: Path, out: Path) -> Path:
    data = load_json(data_dir, "lernkarten.json")
    gef = data.get("gefuehle") if isinstance(data, dict) else None
    if not isinstance(gef, dict) or not (gef.get("erfuellt") or gef.get("unerfuellt")):
        raise DataError("lernkarten.json: Abschnitt „gefuehle“ mit „erfuellt“/„unerfuellt“ fehlt.")
    cards = []
    for key, pal, marker, kind in (("erfuellt", PAL_ERFUELLT, "dot", "Gefühl · Bedürfnis erfüllt"),
                                   ("unerfuellt", PAL_UNERFUELLT, "ring", "Gefühl · Bedürfnis unerfüllt")):
        for grp in as_list(gef.get(key)):
            if not isinstance(grp, dict):
                continue
            for w, k in words_of(grp):
                cards.append(Card(w, clean(grp.get("gruppe")) or kind, k, pal, marker, kind))
    if not cards:
        raise DataError("lernkarten.json: keine Gefühlswörter gefunden.")

    path = out / "gefuehlskarten.pdf"
    doc = make_doc(path, "Gefühlskarten", "Gefühlswörter zum Ausschneiden – Gewaltfreie Kommunikation",
                   "Gefühlskarten", ["Gewaltfreie Kommunikation", "GFK", "Gefühle", "Lernkarten"])
    n_ok = sum(1 for c in cards if c.marker == "dot")
    story = intro_page(
        "Gefühlskarten",
        "Wörter für das, was in dir lebendig ist – zum Ausschneiden",
        ["Schneide die Karten an den grauen Linien aus. Gelbe Karten mit vollem Punkt stehen für Gefühle, "
         "wenn Bedürfnisse erfüllt sind; blaue Karten mit offenem Ring für Gefühle, wenn Bedürfnisse zu "
         "kurz kommen.",
         "Kein Gefühl ist gut oder schlecht. Jedes zeigt dir, was dir gerade wichtig ist."],
        [("Was ist lebendig?", "Zu Beginn einer Runde sucht sich jede Person zwei Karten aus, die zu ihrem "
                               "Moment passen, und erzählt kurz dazu. Die anderen hören nur zu."),
         ("Gefühle raten", "Eine Person erzählt von einer Situation. Die anderen legen Karten mit vermuteten "
                           "Gefühlen hin. Die erzählende Person behält, was passt – nur sie weiß es."),
         ("Tagesrückblick", "Leg abends eine Karte für den schönsten und eine für den schwersten Moment des Tages.")],
        "Drucke in Originalgröße (100 %, nicht „an Seite anpassen“), am besten auf festerem Papier "
        "(160–200 g/m²). Jede Karte ist 63 × 88 mm groß. Die kurzen Striche am Seitenrand zeigen, "
        "wo die Schnitte liegen.",
        extra=[Legend([(f"Gefühle, wenn Bedürfnisse erfüllt sind ({n_ok})", PAL_ERFUELLT, "dot"),
                       (f"… wenn Bedürfnisse unerfüllt sind ({len(cards) - n_ok})", PAL_UNERFUELLT, "ring")])])
    story += [NextPageTemplate("full"), PageBreak()]
    story += card_sheets(cards, "Gefühlskarten", 2)
    story.pop()  # letzter Seitenumbruch
    doc.build(story)
    return path


# ---------------------------------------------------------------------------
# 2) Bedürfniskarten + Pseudogefühle
# ---------------------------------------------------------------------------
def build_beduerfnisse(data_dir: Path, out: Path) -> Path:
    data = load_json(data_dir, "lernkarten.json")
    bed = data.get("beduerfnisse") if isinstance(data, dict) else None
    if not isinstance(bed, list) or not bed:
        raise DataError("lernkarten.json: Liste „beduerfnisse“ fehlt oder ist leer.")
    cards, legend = [], []
    bed = [b for b in bed if isinstance(b, dict)]
    for i, ber in enumerate(bed):
        pal = PAL_BEREICHE[i % len(PAL_BEREICHE)]
        name = clean(ber.get("bereich")) or f"Bereich {i + 1}"
        ws = words_of(ber)
        legend.append((f"{name} ({len(ws)})", pal, None))
        for w, k in ws:
            cards.append(Card(w, name, k, pal, None, "Bedürfnis"))
    if not cards:
        raise DataError("lernkarten.json: keine Bedürfniswörter gefunden.")
    pseudo = [p for p in as_list(data.get("pseudo")) if isinstance(p, dict) and clean(p.get("w"))]

    path = out / "beduerfniskarten.pdf"
    doc = make_doc(path, "Bedürfniskarten", "Bedürfniswörter zum Ausschneiden – Gewaltfreie Kommunikation",
                   "Bedürfniskarten", ["Gewaltfreie Kommunikation", "GFK", "Bedürfnisse", "Lernkarten"])
    anleitung = ["Schneide die Karten an den grauen Linien aus. Jede Farbe steht für einen Bereich; der Name "
                 "des Bereichs steht zusätzlich oben auf jeder Karte.",
                 "Bedürfnisse teilen alle Menschen. Sie nennen keine bestimmte Person und keine bestimmte "
                 "Handlung – das unterscheidet sie von Strategien."]
    if pseudo:
        anleitung.append("Auf der letzten Seite findest du eine Übersicht zum Übersetzen von Pseudogefühlen.")
    story = intro_page(
        "Bedürfniskarten", "Was alle Menschen brauchen – zum Ausschneiden", anleitung,
        [("Bedürfnis-Raten", "Eine Person erzählt von einer Situation. Die anderen legen Karten mit vermuteten "
                             "Bedürfnissen hin. Die erzählende Person behält, was trifft."),
         ("Hinter dem Vorwurf", "Lest einen Wolfssatz vor, etwa „Du hörst mir nie zu!“, und sucht gemeinsam "
                                "die Karten, die dahinterstehen könnten."),
         ("Beide Seiten", "Bei einem Konflikt legt jede Seite ihre Bedürfniskarten offen hin. Oft zeigen sich "
                          "Gemeinsamkeiten, bevor es um Lösungen geht.")],
        "Drucke in Originalgröße (100 %, nicht „an Seite anpassen“), am besten auf festerem Papier "
        "(160–200 g/m²). Jede Karte ist 63 × 88 mm groß. Die kurzen Striche am Seitenrand zeigen, "
        "wo die Schnitte liegen.",
        extra=[Legend(legend, cols=2, h=6.6 * mm, gap=1.8 * mm)])
    story += [NextPageTemplate("full"), PageBreak()]
    sheets = card_sheets(cards, "Bedürfniskarten", 2)
    sheets.pop()
    story += sheets
    if pseudo:
        story += [NextPageTemplate("text"), PageBreak()] + pseudo_page(pseudo)
    doc.build(story)
    return path


def pseudo_page(pseudo) -> list:
    story = [Spacer(1, 2 * mm), P("Pseudogefühle übersetzen", "h1"), Spacer(1, 3 * mm),
             P("Wörter wie „übergangen“ klingen wie Gefühle, beschreiben aber, was andere uns angeblich "
               "antun. Darin steckt eine Deutung. Die Tabelle zeigt, welche Gefühle und Bedürfnisse darunter "
               "liegen können – als Vermutung, nicht als Regel. Nur du weißt, was für dich stimmt.", "body11"),
             Spacer(1, 5 * mm)]
    rows = [[P("Pseudogefühl (Deutung)", "th"), P("Darunter vielleicht: Gefühle", "th"),
             P("Und dahinter: Bedürfnisse", "th")]]
    for p in pseudo:
        rows.append([P(p.get("w"), "tdb"),
                     P(", ".join(clean(g) for g in as_list(p.get("gefuehle"))), "td"),
                     P(", ".join(clean(b) for b in as_list(p.get("beduerfnisse"))), "td")])
    t = Table(rows, colWidths=[CONTENT_W * 0.3, CONTENT_W * 0.35, CONTENT_W * 0.35], repeatRows=1)
    t.setStyle(TS([
        ("BACKGROUND", (0, 0), (-1, 0), C_SURFACE2),
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, C_ACCENT),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, C_LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [t, Spacer(1, 6 * mm),
              P("Beispiel: Aus „Ich fühle mich übergangen“ wird „Ich bin traurig, weil mir wichtig ist, "
                "einbezogen zu werden.“", "small"),
              Spacer(1, 4 * mm), P(CNVC_LINE, "tiny")]
    return story


# ---------------------------------------------------------------------------
# 3) Spickzettel (2 je A4-Seite, bei viel Inhalt 1 je Seite)
# ---------------------------------------------------------------------------
SLOT_PAD_X, SLOT_PAD_TOP, SLOT_PAD_BOTTOM = 15 * mm, 13.5 * mm, 11 * mm


def zettel_parts(z: dict, scale: float, width: float):
    """Baut die Bausteine eines Spickzettels. Gibt (kopf, tabelle, links, rechts) zurück."""
    fs = 10.5 * scale
    body = S("zb", fontSize=fs, leading=fs * 1.38)
    small = S("zs", fontSize=fs * 0.9, leading=fs * 1.25, textColor=C_MUTED)
    over = S("zo", fontName="Sans-Bold", fontSize=8 * scale, leading=10 * scale, textColor=C_ACCENT)
    title = S("zt", fontName="Ultra", fontSize=19 * scale, leading=23 * scale)
    hand = S("zh", fontName="Hand", fontSize=15 * scale, leading=17 * scale, textColor=C_COACH_INK)
    lab = S("zl", fontName="Sans-Bold", fontSize=fs * 0.82, leading=fs * 1.1, textColor=C_ACCENT_SOFT_INK)
    td = S("ztd", fontSize=fs * 0.95, leading=fs * 1.28)
    tdl = S("ztl", fontName="Sans-Semi", fontSize=fs * 0.95, leading=fs * 1.28)

    meta = " · ".join(t for t in (upper_de(z.get("gruppe")), upper_de(z.get("abschnitt"))) if t)
    head = []
    if meta:
        head += [Paragraph(mk(meta, "Sans-Bold"), over), Spacer(1, 1.2 * mm)]
    head += [Paragraph(mk(z.get("titel"), "Ultra"), title)]
    if clean(z.get("kurz")):
        head += [Spacer(1, 2 * mm), Paragraph(mk(z.get("kurz")), body)]

    table = None
    rows = [r for r in as_list(z.get("zeilen")) if r]
    if rows:
        norm = []
        for r in rows:
            if isinstance(r, (list, tuple)):
                l = clean(r[0]) if len(r) > 0 else ""
                rr = clean(r[1]) if len(r) > 1 else ""
            else:
                l, rr = clean(r), ""
            norm.append((l, rr))
        al = sum(len(l) for l, _ in norm) / len(norm)
        ar = sum(len(r) for _, r in norm) / len(norm)
        share = min(0.5, max(0.3, al / max(1, al + ar)))
        # Erste Zeile als Spaltenkopf erkennen: kurz, ohne Satzzeichen, während andere Zeilen Sätze sind.
        punct = re.compile(r"[.!?“…:]")
        header = (len(norm) >= 3 and all(norm[0]) and all(len(t) <= 30 and not punct.search(t) for t in norm[0])
                  and any(punct.search(l + r) for l, r in norm[1:]))
        data, spans = [], []
        for i, (l, r) in enumerate(norm):
            if header and i == 0:
                data.append([Paragraph(mk(upper_de(l), "Sans-Bold"), lab), Paragraph(mk(upper_de(r), "Sans-Bold"), lab)])
            elif r:
                data.append([Paragraph(mk(l, "Sans-Semi"), tdl), Paragraph(mk(r), td)])
            else:
                data.append([Paragraph(mk(l, "Sans-Semi"), tdl), ""])
                spans.append(("SPAN", (0, i), (1, i)))
        table = Table(data, colWidths=[width * share, width * (1 - share)])
        table.setStyle(TS([
            ("LINEABOVE", (0, 0), (-1, 0), 0.6, C_LINE),
            ("LINEBELOW", (0, 0), (-1, -1), 0.6, C_LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, -1), 8 * scale),
            ("RIGHTPADDING", (1, 0), (1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 3.4 * scale), ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * scale),
        ] + spans))

    def lab_box(label, text, bg, ink_style=None, accent=None):
        inner = [Paragraph(mk(upper_de(label), "Sans-Bold"), lab), Spacer(1, 0.8 * mm),
                 Paragraph(mk(text), ink_style or body)]
        return inner, bg, accent

    blocks_left, blocks_right = [], []
    if clean(z.get("merksatz")):
        ms = S("zm", fontName="Sans-Semi", fontSize=fs * 1.08, leading=fs * 1.45)
        blocks_left.append(("box", [Paragraph(mk(upper_de("Merksatz"), "Sans-Bold"), lab), Spacer(1, 0.8 * mm),
                                    Paragraph(mk(z.get("merksatz"), "Sans-Semi"), ms)], C_ACCENT_SOFT, None))
    if clean(z.get("eselsbruecke")):
        blocks_left.append(("para", Paragraph(f"<b>Eselsbrücke:</b> {mk(z.get('eselsbruecke'))}", small)))
    if clean(z.get("probier")):
        blocks_right.append(("box", [Paragraph(mk("Probier mal", "Hand"), hand), Spacer(1, 0.6 * mm),
                                     Paragraph(mk(z.get("probier")), body)], None, C_LINE))
    ueb = z.get("uebung")
    ueb_text = clean(ueb)
    if ueb_text and (" " in ueb_text or len(ueb_text) > 24):   # nur Text drucken, keine internen Kennungen
        blocks_right.append(("box", [Paragraph(mk(upper_de("Übung"), "Sans-Bold"), lab), Spacer(1, 0.8 * mm),
                                     Paragraph(mk(ueb_text), body)], C_SURFACE2, None))
    if not blocks_right and len(blocks_left) > 1:
        blocks_right.append(blocks_left.pop())
    return head, table, blocks_left, blocks_right


def realize(blocks, width, scale):
    out = []
    for i, b in enumerate(blocks):
        if i:
            out.append(Spacer(1, 3 * mm * scale))
        if b[0] == "para":
            out.append(b[1])
        else:
            _, inner, bg, border = b
            out.append(box(inner, width, bg=bg, border=border, pad=3 * mm * scale))
    return out


def measure(flows, width) -> float:
    return sum(f.wrap(width, 10_000)[1] for f in flows)


def draw_stack(c, flows, x, y_top, width) -> float:
    y = y_top
    for f in flows:
        _, h = f.wrap(width, 10_000)
        f.drawOn(c, x, y - h)
        y -= h
    return y


ZETTEL_SCALES = (1.16, 1.12, 1.08, 1.04, 1.0, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6)
ZETTEL_MIN_HALF = 0.88   # kleiner wird ein halber Zettel nicht – sonst bekommt er eine ganze Seite


def zettel_layout(z, width, height, scales=ZETTEL_SCALES):
    """Sucht die größte Schrift (aus `scales`), bei der der Zettel in width × height passt."""
    col_gap = 6 * mm
    for scale in scales:
        head, table, left, right = zettel_parts(z, scale, width)
        two_cols = bool(left and right)
        cw = (width - col_gap) / 2 if two_cols else width
        lf = realize(left if two_cols else left + right, cw, scale)
        rf = realize(right, cw, scale) if two_cols else []
        gap1 = 4 * mm * scale
        h = measure(head, width) + gap1
        if table is not None:
            h += measure([table], width) + gap1
        h += max(measure(lf, cw) if lf else 0, measure(rf, cw) if rf else 0)
        if h <= height:
            return dict(scale=scale, head=head, table=table, left=lf, right=rf, cw=cw, gap=col_gap,
                        two=two_cols, gap1=gap1)
    return None


def draw_zettel(c, z, x0, y0, w, h, layout):
    """Zeichnet einen Spickzettel in den Bereich (x0, y0, w, h)."""
    ix, iw = x0 + SLOT_PAD_X, w - 2 * SLOT_PAD_X
    top = y0 + h - SLOT_PAD_TOP
    c.setFillColor(C_BAND)
    c.rect(ix, top + 3.2 * mm, 14 * mm, 1.6 * mm, stroke=0, fill=1)
    zid = clean(z.get("id"))
    if zid:
        draw_text(c, ix + iw, top + 3.2 * mm, zid, "Sans-Semi", 8, C_MUTED, align="right")
    y = draw_stack(c, layout["head"], ix, top, iw) - layout["gap1"]
    if layout["table"] is not None:
        y = draw_stack(c, [layout["table"]], ix, y, iw) - layout["gap1"]
    draw_stack(c, layout["left"], ix, y, layout["cw"])
    if layout["two"]:
        draw_stack(c, layout["right"], ix + layout["cw"] + layout["gap"], y, layout["cw"])
    draw_text(c, ix, y0 + 6.5 * mm, f"{AUTHOR} · Spickzettel · nach Marshall B. Rosenberg", "Sans", 6.5, C_MUTED)


def paint_zettel_page(c, items):
    """items: [(zettel, layout, 'half'|'full')]"""
    if len(items) == 1 and items[0][2] == "full":
        z, lay, _ = items[0]
        draw_zettel(c, z, 0, 0, PAGE_W, PAGE_H, lay)
        return
    half = PAGE_H / 2
    for i, (z, lay, _) in enumerate(items):
        draw_zettel(c, z, 0, half if i == 0 else 0, PAGE_W, half, lay)
    # Schnittlinie in der Mitte (gestrichelt) + Marken am Rand
    c.setStrokeColor(C_CUT)
    c.setLineWidth(0.5)
    c.setDash(2.2 * mm, 1.6 * mm)
    c.line(9 * mm, half, PAGE_W - 9 * mm, half)
    c.setDash()
    c.setStrokeColor(C_MARK)
    c.setLineWidth(0.3)
    c.line(2 * mm, half, 7 * mm, half)
    c.line(PAGE_W - 7 * mm, half, PAGE_W - 2 * mm, half)


def build_spickzettel(data_dir: Path, out: Path) -> Path:
    data = load_json(data_dir, "spickzettel.json")
    if isinstance(data, dict):
        data = data.get("spickzettel") or data.get("karten") or data.get("items") or []
    zettel = [z for z in data if isinstance(z, dict) and clean(z.get("titel"))]
    if not zettel:
        raise DataError("spickzettel.json: keine Einträge mit „titel“ gefunden.")

    half_w, half_h = PAGE_W - 2 * SLOT_PAD_X, PAGE_H / 2 - SLOT_PAD_TOP - SLOT_PAD_BOTTOM
    full_h = PAGE_H - SLOT_PAD_TOP - SLOT_PAD_BOTTOM - 6 * mm
    # 1. Größte passende Schrift je Zettel; 2. eine gemeinsame Größe für alle halben Zettel,
    #    damit die Zettel nebeneinander einheitlich aussehen.
    best = {}
    for i, z in enumerate(zettel):
        lay = zettel_layout(z, half_w, half_h)
        if lay and lay["scale"] >= ZETTEL_MIN_HALF:
            best[i] = lay["scale"]
    uniform = min(best.values()) if best else 1.0
    scales = [s for s in ZETTEL_SCALES if s <= uniform]
    placed = []
    for i, z in enumerate(zettel):
        if i in best:
            placed.append((z, zettel_layout(z, half_w, half_h, scales), "half"))
            continue
        lay_full = zettel_layout(z, half_w, full_h, scales)
        if lay_full is None:  # sehr viel Inhalt: kleinste Stufe trotzdem drucken
            head, table, left, right = zettel_parts(z, 0.6, half_w)
            lay_full = dict(scale=0.6, head=head, table=table, left=realize(left + right, half_w, 0.6),
                            right=[], cw=half_w, gap=0, two=False, gap1=2 * mm)
            print(f"  Hinweis: Spickzettel „{clean(z.get('titel'))}“ ist sehr lang und passt evtl. nicht ganz.")
        placed.append((z, lay_full, "full"))

    # Seiten füllen: je zwei halbe Zettel; ein ganzseitiger Zettel bekommt eine eigene Seite.
    # Steht ein ganzseitiger dazwischen, rückt der nächste halbe Zettel nach oben (spart Papier).
    pages, rest = [], list(placed)
    while rest:
        item = rest.pop(0)
        if item[2] == "full":
            pages.append([item])
            continue
        j = next((k for k, other in enumerate(rest) if other[2] == "half"), None)
        pages.append([item, rest.pop(j)] if j is not None else [item])

    path = out / "spickzettel.pdf"
    doc = make_doc(path, "Spickzettel", "Das Wichtigste zur Gewaltfreien Kommunikation auf einen Blick",
                   "Spickzettel", ["Gewaltfreie Kommunikation", "GFK", "Spickzettel"])
    # Übersicht auf der ersten Seite, nach Gruppen
    groups: dict[str, list[dict]] = {}
    for z in zettel:
        groups.setdefault(clean(z.get("gruppe")) or "Weitere", []).append(z)
    overview = [P("Inhalt", "h3"), Spacer(1, 1.5 * mm)]
    for g, zs in groups.items():
        overview.append(P(g, "overline", textColor=C_ACCENT))
        for z in zs:
            zid = clean(z.get("id"))
            overview.append(Paragraph((f"<font color='#5F534C'>{mk(zid)}</font>  " if zid else "")
                                      + mk(z.get("titel")), ST["bullet"], bulletText="•"))
        overview.append(Spacer(1, 2 * mm))
    story = intro_page(
        "Spickzettel", "Das Wichtigste zur Gewaltfreien Kommunikation auf einen Blick",
        ["Auf jeder Seite stehen zwei Spickzettel. Schneide die Seite an der gestrichelten Linie in der Mitte "
         "durch – so passt jeder Zettel gefaltet in eine Tasche.",
         "„Probier mal“ und die Übung kannst du allein oder zu zweit machen. Die Beispiele sind Anregungen: "
         "Alltagssprache ist ausdrücklich erwünscht, wenn klar wird, was dir wichtig ist."],
        [], "Drucke in Originalgröße (100 %). Normales Papier reicht.",
        extra=overview,
        quelle="Nach Marshall B. Rosenberg, Gewaltfreie Kommunikation. Eigene Formulierungen für den "
               "Wolf & Giraffe Trainer. Keine Empfehlung durch das CNVC.")
    story += [NextPageTemplate("full"), PageBreak()]
    for i, pg in enumerate(pages):
        if i:
            story.append(PageBreak())
        story.append(Sheet(paint_zettel_page, pg))
    doc.build(story)
    return path


# ---------------------------------------------------------------------------
# 4) Workshop-Handout
# ---------------------------------------------------------------------------
def build_handout(data_dir: Path, out: Path) -> Path:
    data = load_json(data_dir, "handout.json")
    if not isinstance(data, dict) or not isinstance(data.get("uebungen"), list) or not data["uebungen"]:
        raise DataError("handout.json: Liste „uebungen“ fehlt oder ist leer.")
    ue = [u for u in data["uebungen"] if isinstance(u, dict) and clean(u.get("titel"))]
    for u in ue:  # Listenfelder absichern
        for key in ("ablauf", "aufgaben", "satzhilfen", "loesungen", "ankreuzen"):
            u[key] = as_list(u.get(key))
    titel = clean(data.get("titel")) or "Übungen für Teilnehmende"
    path = out / "workshop-handout.pdf"
    doc = make_doc(path, titel, clean(data.get("untertitel")) or "Workshop-Handout Gewaltfreie Kommunikation",
                   "Übungen für Teilnehmende", ["Gewaltfreie Kommunikation", "GFK", "Workshop", "Übungen"])

    # Deckblatt
    story = [Band(), Spacer(1, 7 * mm), Brand(), Spacer(1, 10 * mm), P(titel, "title")]
    if clean(data.get("untertitel")):
        story += [Spacer(1, 2.5 * mm), P(data.get("untertitel"), "sub")]
    story += [Spacer(1, 7 * mm), P(data.get("einleitung"), "body11"), Spacer(1, 7 * mm),
              P("Die Übungen im Überblick", "h2"), Spacer(1, 2.5 * mm)]
    rows = [[P("Nr.", "th"), P("Übung", "th"), P("Form", "th"), P("Zeit", "th")]]
    for u in ue:
        rows.append([P(u.get("id"), "tdb", textColor=C_ACCENT), P(u.get("titel"), "td"),
                     P(u.get("form"), "td"), P(u.get("zeit"), "td")])
    t = Table(rows, colWidths=[CONTENT_W * 0.1, CONTENT_W * 0.52, CONTENT_W * 0.24, CONTENT_W * 0.14])
    t.setStyle(TS([
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, C_ACCENT),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, C_LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [t, Spacer(1, 8 * mm)]
    foot = []
    if clean(data.get("quelle")):
        foot.append(P(clean(data.get("quelle")) + " " + IMAGE_CREDIT + ".", "tiny"))
    if clean(data.get("hilfe")):
        foot += [Spacer(1, 2 * mm), P(data.get("hilfe"), "small", textColor=C_INK)]
    story += foot
    story += [NextPageTemplate("text")]

    # Übungen – jede beginnt auf einer neuen Seite
    for u in ue:
        story.append(PageBreak())
        story += exercise_fitted(u)

    # Lösungsteil
    with_sol = [u for u in ue if u.get("loesungen")]
    if with_sol:
        story += [PageBreak(), Spacer(1, 2 * mm), P("Lösungsvorschläge", "h1"), Spacer(1, 3 * mm),
                  P(data.get("loesungen_einleitung") or
                    "Hier stehen Vorschläge, keine einzig gültigen Antworten. Wenn deine Antwort anders "
                    "klingt, aber dasselbe ausdrückt, passt sie genauso.", "body"),
                  Spacer(1, 4 * mm)]
        for u in with_sol:
            head = [CondPageBreak(30 * mm),
                    Paragraph(f"<font color='#B83C00'>{mk(u.get('id'))}</font>  {mk(u.get('titel'), 'Sans-Bold')}",
                              ST["h2"])]
            if clean(u.get("loesungen_hinweis")):
                head += [Spacer(1, 0.8 * mm), P(u.get("loesungen_hinweis"), "small", fontName="Sans-Italic")]
            head.append(Spacer(1, 1.8 * mm))
            items = [Paragraph(mk(s), ST["step"], bulletText=f"{i}.")
                     for i, s in enumerate(u.get("loesungen"), 1)]
            story += [KeepTogether(head + items[:1])] + items[1:] + [Spacer(1, 4.5 * mm)]

    # Quellen und Hilfe am Ende
    end = []
    if clean(data.get("quelle")):
        end += [P("Quellen", "h3"), Spacer(1, 1 * mm), P(data.get("quelle"), "small"),
                Spacer(1, 0.8 * mm), P(IMAGE_CREDIT + ".", "small")]
    if clean(data.get("hilfe")):
        end += [Spacer(1, 3 * mm), P("Wenn es schwer wird", "h3"), Spacer(1, 1 * mm),
                P(data.get("hilfe"), "small", textColor=C_INK)]
    if end:
        story += [Spacer(1, 4 * mm), KeepTogether([box(end, CONTENT_W, bg=C_SURFACE2)])]
    doc.build(story)
    return path


# Dichte-Stufen: Jede Übung soll möglichst auf eine Seite passen. Stufe 0 ist die luftigste;
# reicht der Platz nicht, wird es schrittweise enger (Schrift, Abstände, Schreiblinien ≥ 7 mm).
DENSITY = [
    dict(fs=10.5, lead=14.5, gap=8.0 * mm, sp=1.0, h1=22),
    dict(fs=10.5, lead=14.0, gap=7.5 * mm, sp=0.85, h1=22),
    dict(fs=10.0, lead=13.4, gap=7.0 * mm, sp=0.75, h1=21),
    dict(fs=9.5, lead=12.8, gap=7.0 * mm, sp=0.62, h1=20),
]


def flow_height(flows, width=None) -> float:
    width = width or CONTENT_W
    total = 0.0
    for f in flows:
        if isinstance(f, KeepTogether):
            total += flow_height(f._content, width)
            continue
        _, h = f.wrap(width, 100_000)
        total += h + f.getSpaceBefore() + f.getSpaceAfter()
    return total


def exercise(u: dict, d: dict = DENSITY[0]) -> list:
    fs, lead, sp = d["fs"], d["lead"], d["sp"]
    body = S("eb", fontSize=fs, leading=lead)
    step = S("es", fontSize=fs, leading=lead, leftIndent=16, bulletIndent=0, bulletFontName="Sans-Bold",
             bulletFontSize=fs, bulletColor=C_ACCENT, spaceAfter=3.2 * sp)
    bullet = S("ebu", fontSize=fs, leading=lead, leftIndent=11, bulletIndent=0, bulletFontName="Sans-Bold",
               bulletColor=C_ACCENT, spaceAfter=2.2 * sp)
    task = S("et", fontName="Sans-Semi", fontSize=fs, leading=lead, leftIndent=16, bulletIndent=0,
             bulletFontName="Sans-Bold", bulletFontSize=fs, bulletColor=C_ACCENT)
    h1 = S("eh1", fontName="Ultra", fontSize=d["h1"], leading=d["h1"] * 1.22)
    h3 = S("eh3", fontName="Sans-Bold", fontSize=fs + 0.5, leading=lead)
    hand = S("ehd", fontName="Hand", fontSize=fs + 5, leading=fs + 7, textColor=C_COACH_INK)
    small = S("esm", fontSize=fs - 1.5, leading=lead - 2, textColor=C_MUTED)

    def gap(v):
        return Spacer(1, v * mm * sp)

    chips = [(f"Übung {clean(u.get('id'))}", C_ACCENT_SOFT, C_ACCENT_SOFT_INK, "Sans-Bold"),
             (u.get("form"), C_SURFACE2, C_INK, "Sans-Semi"),
             (u.get("zeit"), C_SURFACE2, C_INK, "Sans-Semi")]
    if clean(u.get("material")):
        chips.append((f"Material: {clean(u.get('material'))}", C_SURFACE2, C_INK, "Sans"))
    story = [Chips(chips), gap(4), Paragraph(mk(u.get("titel"), "Ultra"), h1), gap(2.5)]
    if clean(u.get("ziel")):
        story.append(Paragraph(f"<font name='Hand' size='{fs + 5.5}' color='#8A4A12'>Lernziel</font>&nbsp;&nbsp; "
                               f"{mk(u.get('ziel'))}", S("ziel", fontSize=fs + 0.5, leading=fs + 6.5)))
    story.append(gap(4.5))

    if u.get("ablauf"):
        story += [Paragraph(mk("So geht’s", "Sans-Bold"), h3), gap(1.6)]
        story += [Paragraph(mk(s), step, bulletText=f"{i}.") for i, s in enumerate(u["ablauf"], 1)]
        story.append(gap(3))

    if clean(u.get("situation")):
        story += [box([Paragraph(mk(u.get("situation"), "Sans-Semi"),
                                 S("esit", fontName="Sans-Semi", fontSize=fs + 0.5, leading=lead + 1))],
                      CONTENT_W, bg=C_SURFACE2, accent_left=C_ACCENT, pad=3.2 * mm * max(sp, 0.8)), gap(4)]

    if u.get("satzhilfen"):
        inner = [Paragraph(mk("Satzhilfen", "Hand"), hand), Spacer(1, 0.6 * mm)]
        inner += [Paragraph(mk(s), bullet, bulletText="•") for s in u["satzhilfen"]]
        story += [box(inner, CONTENT_W, bg=C_SURFACE2, pad=3.2 * mm * max(sp, 0.8)), gap(4)]

    if u.get("aufgaben"):
        story += [CondPageBreak(40 * mm), Paragraph(mk("Arbeitsblatt", "Sans-Bold"), h3), gap(2)]
        check = u.get("ankreuzen") or []
        for i, a in enumerate(u["aufgaben"], 1):
            text = clean(a.get("t")) if isinstance(a, dict) else clean(a)
            try:
                n = int(a.get("zeilen", 2)) if isinstance(a, dict) else 2
            except (TypeError, ValueError):
                n = 2
            part = [Paragraph(mk(text, "Sans-Semi"), task, bulletText=f"{i}.")]
            if check:
                part += [Spacer(1, 1.2 * mm), CheckRow(check, size=fs - 1)]
            if n > 0:
                part.append(WriteLines(n, gap=d["gap"]))
            part.append(gap(3.2))
            story.append(KeepTogether(part))

    if isinstance(u.get("beobachter"), dict):
        b = u["beobachter"]
        inner = [Paragraph(mk(b.get("titel") or "Für die beobachtende Person", "Sans-Bold"), h3),
                 Spacer(1, 1.2 * mm)]
        if clean(b.get("hinweis")):
            inner += [Paragraph(mk(b.get("hinweis")), body), Spacer(1, 1.8 * mm)]
        if b.get("leitfragen"):
            inner += [Paragraph(mk("Leitfragen", "Hand"), hand), Spacer(1, 0.4 * mm)]
            inner += [Paragraph(mk(q), bullet, bulletText="•") for q in b["leitfragen"]]
        story += [gap(1), KeepTogether([box(inner, CONTENT_W, bg=None, border=C_LINE,
                                            pad=3.2 * mm * max(sp, 0.8))]), gap(4)]

    if clean(u.get("hinweis")):
        story.append(Paragraph(f"<b>Hinweis:</b> {mk(u.get('hinweis'))}", small))
    return story


def exercise_fitted(u: dict) -> list:
    """Wählt die luftigste Dichte-Stufe, bei der die Übung auf eine Seite passt."""
    avail = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM - 4 * mm
    for d in DENSITY:
        flows = exercise(u, d)
        if flow_height(flows) <= avail:
            return flows
    return exercise(u, DENSITY[0])   # sehr lange Übung: darf über zwei Seiten laufen


# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------
BUILDERS = {
    "gefuehle": ("gefuehlskarten.pdf", build_gefuehle),
    "beduerfnisse": ("beduerfniskarten.pdf", build_beduerfnisse),
    "spickzettel": ("spickzettel.pdf", build_spickzettel),
    "handout": ("workshop-handout.pdf", build_handout),
}


def self_check_palettes() -> None:
    for pal in [PAL_ERFUELLT, PAL_UNERFUELLT] + PAL_BEREICHE:
        if contrast(pal.ink, pal.bg) < 4.5 or contrast("#221B17", pal.bg) < 4.5:
            print(f"  Warnung: Kontrast zu gering bei {pal}", file=sys.stderr)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Erzeugt die Lernkarten-PDFs des Wolf & Giraffe Trainers.")
    ap.add_argument("--data", default=str(DEFAULT_DATA), help="Ordner mit den JSON-Daten (Standard: src/data)")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="Zielordner für die PDFs (Standard: pdf/)")
    ap.add_argument("--only", default="", help="Kommagetrennt: " + ", ".join(BUILDERS))
    args = ap.parse_args(argv)

    data_dir, out_dir = Path(args.data).resolve(), Path(args.out).resolve()
    wanted = [w.strip() for w in args.only.split(",") if w.strip()] or list(BUILDERS)
    unknown = [w for w in wanted if w not in BUILDERS]
    if unknown:
        print(f"Unbekannt: {', '.join(unknown)}. Erlaubt: {', '.join(BUILDERS)}", file=sys.stderr)
        return 2
    if not data_dir.is_dir():
        print(f"Datenordner nicht gefunden: {data_dir}", file=sys.stderr)
        return 2
    out_dir.mkdir(parents=True, exist_ok=True)
    prepare_fonts()
    self_check_palettes()

    print(f"Daten: {data_dir}\nZiel:  {out_dir}")
    made, skipped = [], []
    for key in wanted:
        fname, fn = BUILDERS[key]
        try:
            p = fn(data_dir, out_dir)
            made.append(p)
            print(f"  ✓ {p.name:24} {p.stat().st_size / 1024:6.0f} KB")
        except DataError as err:
            skipped.append(fname)
            print(f"  – {fname:24} übersprungen: {err}")
        except Exception as err:  # unerwartete Datenform o. Ä.: dieses PDF auslassen, Rest weiter bauen
            skipped.append(fname)
            print(f"  – {fname:24} übersprungen – unerwarteter Fehler: {type(err).__name__}: {err}")
    if MISSING:
        print("  Hinweis: Diese Zeichen fehlen in den Schriften und wurden weggelassen: "
              + " ".join(sorted(MISSING)))
    if not FALLBACK:
        print("  Hinweis: Keine Ersatzschrift gefunden – Sonderzeichen wie → werden umschrieben.")
    print(f"Fertig: {len(made)} erzeugt, {len(skipped)} übersprungen.")
    return 0 if made else 1


if __name__ == "__main__":
    sys.exit(main())
