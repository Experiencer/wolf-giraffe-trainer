# Wolf & Giraffe Trainer – Deployment auf Vercel

## Worum geht es – und was wird damit erreicht?
Bisher lief der GFK-Trainer als einzelne HTML-Datei, und die API-Schlüssel mussten im Browser eingetragen werden. Mit diesem Paket läuft die App als Website auf **Vercel**. Die Schlüssel für Claude (Coach) und OpenAI (Echtzeit-Stimme) liegen dann **nur auf dem Server** als „Environment Variables“ – sie erscheinen nie im Browser.

Konkret passiert Folgendes:
- **Claude-Coach:** Die App fragt `/api/coach` an. Die Server-Funktion reicht die Anfrage mit deinem `ANTHROPIC_API_KEY` an Claude weiter. Damit bewertet der Coach jeden Satz – auch im Echtzeit-Gespräch.
- **Echtzeit-Gespräch:** Die App fragt `/api/realtime-session` an. Der Server erzeugt mit deinem `OPENAI_API_KEY` einen Sitzungs-Schlüssel, der nur 10 Minuten gilt. Damit verbindet sich der Browser direkt mit OpenAI. Das Mikrofon funktioniert, weil Vercel über HTTPS ausliefert.
- **Zugangscode (empfohlen):** Ist `APP_ACCESS_CODE` gesetzt, kann nur nutzen, wer den Code kennt. Sonst könnte jeder mit dem Link deine API-Guthaben verbrauchen.
- Die App erkennt den Server automatisch: Felder für Schlüssel verschwinden, der Schalter „Live-Coaching mit Claude“ ist sofort an.

## Projektstruktur
| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App (mit UTF-8-Kopf, daher keine Zeichenfehler mehr) |
| `api/config.js` | Sagt der App, welche Schlüssel hinterlegt sind (verrät sie nicht) |
| `api/coach.js` | Weiterleitung an Claude |
| `api/realtime-session.js` | Erzeugt den 10-Minuten-Schlüssel für OpenAI Realtime |
| `lib/shared.js` | Gemeinsame Hilfen (Zugangscode-Prüfung) |
| `vercel.json` | Erlaubt das Mikrofon, setzt Sicherheits-Header |
| `.env.example` | Vorlage für die Environment Variables |

## Environment Variables
| Name | Pflicht? | Wofür | Woher |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ja | Claude-Coach, Text-Rollenspiel, Auswertung | console.anthropic.com → API Keys |
| `OPENAI_API_KEY` | ja, für Echtzeit | Echtzeit-Stimme | platform.openai.com → Projekt → API Keys |
| `APP_ACCESS_CODE` | empfohlen | Schützt deine Guthaben | selbst ausdenken, lang |
| `COACH_MODEL` / `COACH_MODEL_QUICK` | nein | Claude-Modelle ändern | Standard: `claude-sonnet-5-5` / `claude-haiku-4-5-20251001` |
| `REALTIME_MODEL` | nein | Echtzeit-Modell ändern | Standard: `gpt-realtime-2.1` |

## Weg A – über GitHub (passt zu deinem Git-Workflow)
1. Auf github.com ein neues **privates** Repository anlegen, z. B. `wolf-giraffe-trainer`.
2. Den **Inhalt** des Ordners `vercel-app` hochladen (Add file → Upload files → alle Dateien und Ordner hineinziehen). `index.html` muss oben im Repository liegen, nicht in einem Unterordner. Hinweis: Dateien mit Punkt am Anfang (`.env.example`, `.gitignore`) blendet der Mac im Finder aus – mit ⌘ + ⇧ + . werden sie sichtbar.
3. Auf vercel.com: **Add New → Project** → das Repository importieren.
4. Framework Preset: **Other**. Build- und Output-Einstellungen leer lassen.
5. Unter **Environment Variables** die Werte aus der Tabelle eintragen.
6. **Deploy**. Danach die angezeigte Adresse öffnen.

Jeder weitere Push auf GitHub aktualisiert die Website automatisch.

## Weg B – mit der Vercel-Kommandozeile
```bash
npm i -g vercel
cd vercel-app
vercel                      # beim ersten Mal: anmelden, Projekt anlegen
vercel env add ANTHROPIC_API_KEY
vercel env add OPENAI_API_KEY
vercel env add APP_ACCESS_CODE
vercel --prod               # live schalten
```

## Wichtig: Änderungen an Variablen
Vercel übernimmt geänderte Environment Variables erst beim **nächsten Deployment**. Nach jeder Änderung: Deployments → beim neuesten „…“ → **Redeploy**.

## Test nach dem Deployment
1. Seite öffnen → Zugangscode eingeben (falls gesetzt).
2. Oben rechts muss „Live-Coaching mit Claude“ stehen.
3. Tab **Training**, Szenario S01, einen Satz schicken → das Gegenüber antwortet frei, der Coach zeigt „✓ / →“.
4. Tab **Live sprechen** → *Echtzeit-Gespräch (OpenAI)* → Starten → Mikrofon erlauben → sprechen.
5. Nach jedem deiner Sätze erscheint rechts eine Coach-Karte. Sag „Coach“ für Hilfe.

## Sicherheit und Kosten
- In **beiden** Anbieter-Konsolen ein monatliches **Budget-Limit** setzen.
- Zugangscode lang wählen und nicht öffentlich teilen.
- Wenn nur du die App nutzt: in Vercel unter Settings → Deployment Protection den Schutz aktivieren.
- Kosten grob: Echtzeit 0,45–0,80 $ pro 10 Minuten (OpenAI); Coach-Feedback wenige Cent pro Gespräch (Claude).

## Lokal testen (optional)
```bash
cd vercel-app
cp .env.example .env.local   # Werte eintragen
vercel dev                   # öffnet http://localhost:3000
```

## Fehlerhilfe
| Meldung in der App | Ursache | Lösung |
|---|---|---|
| „Bitte zuerst den Zugangscode eingeben“ | Code fehlt oder falsch | Code oben eingeben |
| Oben steht „Schnellanalyse (offline)“ | `ANTHROPIC_API_KEY` fehlt | Variable setzen, Redeploy |
| „OPENAI_API_KEY ist auf dem Server nicht gesetzt“ | Variable fehlt | setzen, Redeploy |
| „Kein Zugriff aufs Mikrofon“ | Browser-Freigabe fehlt | Schloss-Symbol in der Adresszeile → Mikrofon erlauben |
| „OpenAI meldet … model“ | Modellname geändert | `REALTIME_MODEL` setzen |
| „Limit erreicht (429)“ | Guthaben oder Budget | in der Anbieter-Konsole prüfen |

Fehlermeldungen bitte als Text oder Screenshot zurückschicken – dann kommt v2.
