# Wolf & Giraffe Trainer

## Worum geht es – und was wird damit erreicht?
Der Trainer ist eine Übungs-App für **Gewaltfreie Kommunikation (GFK) nach Marshall B. Rosenberg**. Du führst schwierige Gespräche mit einer KI-Figur – schriftlich, gesprochen oder als natürliches Echtzeit-Gespräch. Ein **Coach** (die Giraffe) begleitet dich: Er würdigt, was schon gelingt, zeigt genau einen nächsten Schritt und hilft, wenn du ihn rufst.

**Aufbau der Oberfläche (v6.3):** Oben steht eine feste Kopfzone. Sie besteht aus dem Banner „Wolf & Giraffe – wertschätzend kommunizieren“ mit dem Zahnrad für die Einstellungen und den Reitern darunter. Das Banner bleibt beim Scrollen immer oben; die Reiter gleiten beim Herunterscrollen unter das Banner und kommen beim Hochscrollen zurück (v6.4; das Verschwinden dauert je nach Scroll-Tempo 0,35–0,8 s, v6.5), ganz oben und bei Tastatur-Fokus sind sie immer sichtbar. Der Reiter **„Klären“** („Gemeinsam klären“) zeigt die beiden geplanten Wege „Erzähl mal“ (allein) und „Gespräch zu zweit“; die Abläufe folgen nach dem Krisenpfad (A-24). Der Bildnachweis steht in der Fußzeile.

Die App läuft als Website auf **Vercel**. Alle API-Schlüssel liegen nur auf dem Server als „Environment Variables“ und erscheinen nie im Browser. Konkret:
- **Coach und Rollenspiel (Claude):** `/api/coach` leitet Anfragen mit `ANTHROPIC_API_KEY` an Claude weiter – auch im Echtzeit-Gespräch.
- **Echtzeit-Gespräch (OpenAI):** `/api/realtime-session` erzeugt mit `OPENAI_API_KEY` einen Sitzungs-Schlüssel, der 10 Minuten gilt. Damit verbindet sich der Browser direkt mit OpenAI.
- **Natürliche Stimme für Coach und Gegenüber (OpenAI):** `/api/tts` liest Texte mit einer OpenAI-Stimme vor. So spricht der Coach seine Hilfe hörbar – auch mitten im Echtzeit-Gespräch. In den Einstellungen gibt es zu beiden Stimmen einen Knopf „Anhören“ (v6.2): Er spricht einen kurzen Beispielsatz mit der gewählten Stimme; im Echtzeit-Gespräch führt „Stimme wählen“ direkt dorthin. Im Live-Gespräch selbst kann die Stimme ein wenig anders klingen als in der Vorschau.
- **Zugangscode (empfohlen):** Ist `APP_ACCESS_CODE` gesetzt, kann nur nutzen, wer den Code kennt.

## Was die App kann
| Bereich | Inhalt |
|---|---|
| **Üben** | 24 Szenarien + **eigene Szenarien** (Situation beschreiben → Claude baut daraus eine Übung) |
| Begleitung | **Geführt** (alle Hilfen, Coach meldet sich nach jedem Satz und greift bei Schwierigkeiten von selbst ein) · **Begleitet** (kurze Rückmeldung, Hilfen auf Knopfdruck, Tipp nach Schwierigkeiten) · **Frei** (Coach hört still zu, nur auf Zuruf; Notizen kommen in die Auswertung) |
| Antwortart | **Schreiben** · **Sprechen** (Spracherkennung des Browsers) · **Echtzeit** (OpenAI, frei sprechen, unterbrechen möglich) |
| Immer da | **Coach fragen** (Knopf oder das Wort „Coach“) · **Auszeit** (Knopf, Esc-Taste oder das Wort „Auszeit“) mit kurzer Selbstempathie |
| Auswertung | in Worten statt Noten: Stärken, ein nächster Schritt, was beim Gegenüber los war; Zahlen nur auf Wunsch |
| **Zuhören** (v6) | Empathisch zuhören: 15 Personen in drei Stufen erzählen, du vermutest Gefühl und Bedürfnis (Wörter wählen, schreiben oder sprechen) – die Person reagiert menschlich, ohne Richtig/Falsch |
| **Kurzübungen** (v6) | 23 Übungen zu allen Abschnitten der Wissensbasis + gemischte Runde: Einordnen, Umformulieren (erst selbst einschätzen), Schritt für Schritt · Modus „Hören und sprechen“ |
| **Lernkarten** (v6) | 84 Gefühls-, 62 Bedürfniskarten, 20 Pseudogefühle, „Karte ziehen“ · PDFs: Gefühlskarten, Bedürfniskarten, Spickzettel, Workshop-Handout |
| **Übersetzer** | Wolfssatz → Lernform und Alltagsfassung |
| **Spickzettel** (v6) | 16 Karten (§1–§13) mit Merksatz, „Probier mal“ und Hörkarte (unter 1 Minute) |
| **Mein Weg** | Übungstage dieser Woche (ohne Serie), Stand der Kurzübungen in Worten, Zuhören, Entdeckungen, Verlauf, Wiederholung nach 1, 3 und 7 Tagen |
| Feiern (v6) | Konfetti und grüner Abschluss nur bei ganz gelungener Übung; abschaltbar, respektiert „Bewegung reduzieren“, Ton standardmäßig aus |

## Projektstruktur
| Datei / Ordner | Zweck |
|---|---|
| `index.html` | Die fertige App (wird aus `src/` gebaut – nicht direkt bearbeiten) |
| `src/` | Quelltext: `body.html`, `styles.css`, `engine.js`, `ui.js`, `lernen.js` (v6: Zuhören, Kurzübungen, Lernkarten, Spickzettel, Feiern, Mein Weg), `data/`, `fonts/`, `assets/` |
| `src/data/` | Inhalte: `szenarien.json`, `kurzuebungen.json`, `empathie.json`, `spickzettel.json`, `lernkarten.json`, `handout.json` |
| `pdf/` | Druckfertige PDFs (auf Vercel unter `/pdf/…`), erzeugt mit `python3 tools/make_pdfs.py` |
| `tools/make_pdfs.py` | Erzeugt die vier PDFs aus `src/data/` (braucht `pip install reportlab fonttools brotli`) |
| `src/build.py` | Baut `index.html` aus `src/` (Schriften und Bilder werden eingebettet) |
| `api/config.js` | Sagt der App, welche Schlüssel hinterlegt sind (verrät sie nicht) |
| `api/coach.js` | Weiterleitung an Claude |
| `api/realtime-session.js` | 10-Minuten-Schlüssel für OpenAI Realtime |
| `api/tts.js` | Natürliche Stimme (OpenAI Text-to-Speech) |
| `lib/shared.js` | Gemeinsame Hilfen (Zugangscode-Prüfung) |
| `tests/` | Test-Server mit nachgebildeten APIs + automatischer Funktionstest (siehe `CLAUDE.md`) |
| `CLAUDE.md` | Arbeitsregeln für Claude Code |
| `vercel.json` | Erlaubt das Mikrofon, setzt Sicherheits-Header |
| `.env.example` | Vorlage für die Environment Variables |

Nach einer Änderung in `src/` neu bauen: `python3 src/build.py` – dann committen und pushen.

## Environment Variables
| Name | Pflicht? | Wofür | Woher |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ja | Coach, Rollenspiel, Auswertung, eigene Szenarien | console.anthropic.com → API Keys |
| `OPENAI_API_KEY` | für Stimme | Echtzeit-Gespräch **und** natürliche Stimme (Coach + Gegenüber) | platform.openai.com → Projekt → API Keys |
| `APP_ACCESS_CODE` | empfohlen | Schützt deine Guthaben | selbst ausdenken, lang |
| `COACH_MODEL` / `COACH_MODEL_QUICK` | nein | Claude-Modelle ändern | Standard: `claude-sonnet-5-5` / `claude-haiku-4-5-20251001` |
| `REALTIME_MODEL` | nein | Echtzeit-Modell ändern | Standard: `gpt-realtime-2.1` |
| `TTS_MODEL` | nein | Vorlese-Modell ändern | Standard: `gpt-4o-mini-tts` |

Vercel übernimmt geänderte Variablen erst beim **nächsten Deployment**: Deployments → beim neuesten „…“ → **Redeploy**.

## Deployment
Das Repository ist mit Vercel verbunden: **Jeder Push auf `main` aktualisiert die Website automatisch.** Framework Preset: **Other**, Build-Einstellungen leer.

Neu einrichten (falls nötig): vercel.com → **Add New → Project** → Repository importieren → Variablen eintragen → **Deploy**.

## Test nach dem Deployment
1. Seite öffnen → Zugangscode eingeben (falls gesetzt).
2. **Einstellungen** (Zahnrad): „Ausführliches KI-Feedback“ zeigt „Online“.
3. Begleitung **Geführt**, Szenario „Das Handy beim Abendessen“, einen Satz schreiben → der Coach fragt zuerst, was du ausdrücken wolltest, dann kommt seine Karte.
4. Unten **Echtzeit** → Mikrofon antippen → Hinweis bestätigen → frei sprechen.
5. **Coach fragen** antippen → das Gespräch pausiert, der Coach **spricht** seine Hilfe. Weiter geht es mit einem Tipp aufs Mikrofon.
6. **Beenden & auswerten** → Auswertung in Worten.
7. **+ Eigenes Szenario** → Situation beschreiben → „Speichern & üben“.

## Sicherheit und Kosten
- In **beiden** Anbieter-Konsolen ein monatliches **Budget-Limit** setzen.
- Zugangscode lang wählen und nicht öffentlich teilen.
- Grobe Kosten: Echtzeit 0,45–0,80 $ pro 10 Minuten; Vorlesen wenige Cent pro Gespräch (OpenAI); Coach-Feedback wenige Cent pro Gespräch (Claude).

## Fehlerhilfe
| Meldung in der App | Ursache | Lösung |
|---|---|---|
| „Bitte zuerst den Zugangscode eingeben“ | Code fehlt oder falsch | Code in den Einstellungen eingeben |
| „Nicht verbunden – es prüft eine einfache Schnellanalyse“ | `ANTHROPIC_API_KEY` fehlt | Variable setzen, Redeploy |
| „Echtzeit hier nicht verfügbar“ | `OPENAI_API_KEY` fehlt | Variable setzen, Redeploy |
| Coach spricht mit Roboterstimme | `/api/tts` nicht erreichbar → Browser-Stimme als Ersatz | `OPENAI_API_KEY` prüfen, Redeploy |
| „Kein Zugriff aufs Mikrofon“ | Browser-Freigabe fehlt | Schloss-Symbol in der Adresszeile → Mikrofon erlauben |
| „OpenAI meldet … model“ | Modellname geändert | `REALTIME_MODEL` bzw. `TTS_MODEL` setzen |
| „Limit erreicht (429)“ | Guthaben oder Budget | in der Anbieter-Konsole prüfen |

Fehlermeldungen bitte als Text oder Screenshot zurückschicken – dann kommt die nächste Version.
