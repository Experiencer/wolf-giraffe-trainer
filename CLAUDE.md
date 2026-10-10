# CLAUDE.md – Repo „wolf-giraffe-trainer“

Technische Regeln für die Arbeit am Code. Inhaltliche Leitlinien (GFK-Coach, Experten-Perspektiven, Produktprinzipien) stehen in der Projektanweisung des übergeordneten Projektordners (`../../PROJEKTANWEISUNG.md`, wenn dieses Repo in `Wolf-und-Giraffe/03_App/` liegt).

## Wer arbeitet hier?
- Auftraggeber: **Sven**, kein Programmierer. Erklärungen ohne Fachjargon, Befehle vollständig und kopierbar.
- Sprache in Code-Kommentaren, Commits und Doku: **Deutsch**.
- Workflow: Code-First. Vollständige Dateien, Versionsstand im Commit-Text, Sven testet live und meldet zurück.

## Aufbau
| Pfad | Zweck |
|---|---|
| `src/body.html` · `src/styles.css` · `src/engine.js` · `src/ui.js` · `src/lernen.js` | Quelltext der App (kein Framework). `lernen.js` (v6) enthält Zuhören, Kurzübungen, Lernkarten, Spickzettel, Feiern, Mein Weg und ruft am Ende `init()` auf |
| `src/data/*.json` | Inhalte: `szenarien.json` (24), `kurzuebungen.json` (23 Übungen), `empathie.json` (15 Personen), `spickzettel.json` (16), `lernkarten.json`, `handout.json` (Workshop) |
| `pdf/` · `tools/make_pdfs.py` | Druck-PDFs und ihr Generator (`python3 tools/make_pdfs.py`, nach Änderungen an lernkarten/spickzettel/handout) |
| `src/fonts/` · `src/assets/` | Schriften (SIL OFL) und Bilder, werden eingebettet |
| `src/build.py` | baut `index.html` (+ Kopien unter `/mnt/user-data/outputs/gfk-coach/`, falls vorhanden) |
| `index.html` | **erzeugt** – nie von Hand bearbeiten |
| `api/*.js` | Vercel-Funktionen: `config`, `coach` (Claude), `realtime-session` (OpenAI Realtime), `tts` (OpenAI-Stimme) |
| `lib/shared.js` | JSON-Antwort, Zugangscode-Prüfung, Body-Limit |
| `tests/devserver.mjs` · `tests/test_app.py` | Test-Server mit nachgebildeten APIs + Playwright-Funktionstest |

## Ablauf bei jeder Änderung
```bash
python3 src/build.py                      # index.html neu bauen
node --check .build-script.js             # Syntax des gebauten Skripts
for f in api/*.js lib/*.js; do node --check "$f"; done
node tests/devserver.mjs &                # Test-Server (Port 8766, Code "geheim")
python3 tests/test_app.py                 # muss "x/x bestanden" melden
```
Einmalig für die Tests: `pip install playwright && python3 -m playwright install chromium`.
Auf dem Mac (macOS 13) stattdessen das installierte Chrome nutzen:
`CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" python3 tests/test_app.py`
Der Test macht Screenshots hell, dunkel und in Handy-Breite (`tests/shots/v6_*`).
Danach Screenshots in `tests/shots/` ansehen (hell, dunkel, mobil) – kein waagrechtes Scrollen, keine Konsolenfehler.

## Regeln
- **Keine Schlüssel im Code oder Repo.** Nur Environment Variables in Vercel: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `APP_ACCESS_CODE` (optional `COACH_MODEL`, `COACH_MODEL_QUICK`, `REALTIME_MODEL`, `REALTIME_TRANSCRIBE_MODEL`, `TTS_MODEL`).
- Jede neue Server-Funktion: Methode prüfen, `accessDenied(request)`, `readJson` mit Limit, Fehler als JSON `{error, message}` auf Deutsch.
- Für jede Online-Funktion gibt es einen Offline-Ersatz (Schnellanalyse, Browser-Stimme). Die App muss ohne Server als Einzeldatei laufen.
- Barrierefreiheit: WCAG 2.2 AA, ARIA-Muster (Tabs, Radiogruppen, Schalter, Dialoge), Status nie nur über Farbe, `[hidden]` respektieren.
- Farben nur über die Variablen am Anfang von `styles.css` (hell + dunkel). Neue Farbpaare auf Kontrast prüfen (Text ≥ 4,5 : 1, Bedienelemente ≥ 3 : 1).
- Keine Emotionserkennung aus Audio. Keine Audioaufnahmen speichern. Nutzerdaten nur in `localStorage` (Präfix `gfk.`).
- Nutzersichtbare Texte: du-Form, kurz, ohne Technikbegriffe. Feedback: erst würdigen, dann genau ein nächster Schritt.
- Inhalte in `src/data/` folgen dem Trainingskonzept (`04_Konzept-und-Recherche/Trainingskonzept-v6.md` im Projektordner). Neue Texte: du-Form, „…“, Feedback erst würdigen, nie „falsch“.
- Feiern (Konfetti) nur über `celebrate()`, immer abschaltbar; keine Serien, Ranglisten oder Strafen (Produktprinzipien).
- Szenarien ändern: `src/data/szenarien.json`; Felder `id, bereich, stufe, fokus, titel, kontext, rolle, eroeffnung, verborgen{gefuehle,beduerfnisse}, lernziel, eskalation`.

## Commit und Deployment
- Vor dem Commit: `git fetch origin` und Stand prüfen. Commit-Text Deutsch, erste Zeile = Version + Kern („v6: …“).
- Push auf `main` → Vercel baut automatisch (Projekt `wolf-giraffe-trainer`). Danach prüfen, dass `https://wolf-giraffe-trainer.vercel.app/api/config` antwortet.
- Geänderte Environment Variables wirken erst nach einem Redeploy.
- Nach dem Push im Projektordner `00_Austausch/STATUS.md`, `TESTPROTOKOLL.md` und `UEBERGABE.md` aktualisieren (falls vorhanden).
