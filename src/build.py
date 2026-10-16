#!/usr/bin/env python3
"""Baut aus den Quelldateien in src/ die fertige App.

Ergebnis:
  index.html                                   – komplette Seite für Vercel (mit UTF-8-Kopf)
  /mnt/user-data/outputs/gfk-coach/wolf-giraffe-trainer.html        – Fassung für claude.ai (nur Body)
  /mnt/user-data/outputs/gfk-coach/wolf-giraffe-trainer-lokal.html  – Fassung zum Doppelklicken

Aufruf (im Repo-Ordner):  python3 src/build.py
"""
import base64
import json
import pathlib

SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parent
OUT = pathlib.Path("/mnt/user-data/outputs/gfk-coach")


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def data_uri(path: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64,{b64(path)}"


def font_face(family, file, weight="400", style="normal"):
    return (
        "@font-face{"
        f"font-family:'{family}';font-style:{style};font-weight:{weight};font-display:swap;"
        f"src:url(data:font/woff2;base64,{b64(SRC / 'fonts' / file)}) format('woff2')"
        "}"
    )


def js_json(path: pathlib.Path, key: str = "") -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    if key:
        data = data[key]
    # "</" escapen, damit ein Text nie das <script>-Tag beenden kann
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def build():
    fonts = "\n".join([
        font_face("Ultra", "ultra-latin-400-normal.woff2"),
        font_face("Caveat Brush", "caveat-brush-latin-400-normal.woff2"),
        font_face("Source Sans 3", "source-sans-3-latin-wght-normal.woff2", "200 900", "normal"),
        font_face("Source Sans 3", "source-sans-3-latin-wght-italic.woff2", "200 900", "italic"),
    ])
    wolf = data_uri(SRC / "assets" / "wolf.jpg", "image/jpeg")
    giraffe = data_uri(SRC / "assets" / "giraffe.jpg", "image/jpeg")
    kopf = data_uri(SRC / "assets" / "banner-kopf.jpg", "image/jpeg")  # v6.3: Banner als Kopfleiste

    css = (SRC / "styles.css").read_text(encoding="utf-8").replace("__FONTS__", fonts)
    body = (SRC / "body.html").read_text(encoding="utf-8")
    body = body.replace("__WOLF__", wolf).replace("__GIRAFFE__", giraffe).replace("__KOPF__", kopf)
    engine = (SRC / "engine.js").read_text(encoding="utf-8")
    engine = (engine.replace("__SZ__", js_json(SRC / "data" / "szenarien.json", "szenarien"))
                    .replace("__KU__", js_json(SRC / "data" / "kurzuebungen.json"))
                    .replace("__SPICK__", js_json(SRC / "data" / "spickzettel.json"))
                    .replace("__LK__", js_json(SRC / "data" / "lernkarten.json"))
                    .replace("__EMP__", js_json(SRC / "data" / "empathie.json"))
                    .replace("__WOLF__", wolf).replace("__GIRAFFE__", giraffe))
    ui = (SRC / "ui.js").read_text(encoding="utf-8")
    pdf_info = {p.name: round(p.stat().st_size / 1024) for p in sorted((ROOT / "pdf").glob("*.pdf"))}
    lernen = (SRC / "lernen.js").read_text(encoding="utf-8").replace("__PDFINFO__", json.dumps(pdf_info))
    script = engine + "\n" + ui + "\n" + lernen

    for name in ("__FONTS__", "__WOLF__", "__GIRAFFE__", "__KOPF__", "__SZ__", "__KU__", "__SPICK__", "__LK__", "__EMP__", "__PDFINFO__"):
        assert name not in css + body + script, f"Platzhalter {name} nicht ersetzt"

    title = "<title>Wolf &amp; Giraffe Trainer</title>"
    inner = f"<style>\n{css}\n</style>\n{body}\n<script>\n{script}\n</script>\n"

    full = (
        "<!doctype html>\n<html lang=\"de\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        "<meta name=\"color-scheme\" content=\"light dark\">\n"
        f"{title}\n<style>\n{css}\n</style>\n</head>\n<body>\n{body}\n"
        f"<script>\n{script}\n</script>\n</body>\n</html>\n"
    )
    artifact = f"{title}\n{inner}"

    (ROOT / "index.html").write_text(full, encoding="utf-8")
    (SRC.parent / ".build-script.js").write_text(script, encoding="utf-8")  # nur für node --check
    if OUT.parent.exists():
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "wolf-giraffe-trainer.html").write_text(artifact, encoding="utf-8")
        (OUT / "wolf-giraffe-trainer-lokal.html").write_text(full, encoding="utf-8")
    print(f"index.html: {len(full) // 1024} KB")


if __name__ == "__main__":
    build()
