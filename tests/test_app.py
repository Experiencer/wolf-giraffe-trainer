"""Funktionstest des Trainers gegen den Test-Server (tests/devserver.mjs, Port 8766).

Vorbereitung (einmalig):  pip install playwright && python3 -m playwright install chromium
(Auf älteren Macs ohne Playwright-Chromium: CHROME_PATH auf das installierte Google Chrome setzen.)
Ablauf:  1) python3 src/build.py   2) node tests/devserver.mjs   3) python3 tests/test_app.py
Screenshots landen in tests/shots/ (nicht im Git).
"""
import json, os, sys, pathlib, urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8766/"
S = str(pathlib.Path(__file__).resolve().parent / "shots") + "/"
pathlib.Path(S).mkdir(exist_ok=True)
results = []

def ok(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + (" – " + str(extra) if extra and not cond else ""))

def calls():
    return json.loads(urllib.request.urlopen("http://localhost:8766/__calls").read())

def reset():
    urllib.request.urlopen("http://localhost:8766/__reset").read()

FAKE_RT = r"""
window.__sent = [];
class FakeDC { constructor(){ this.readyState = "connecting"; window.__dc = this; }
  send(s){ window.__sent.push(JSON.parse(s)); } close(){ this.readyState = "closed"; } }
class FakePC { constructor(){ this.ontrack = null; }
  addTrack(){} createDataChannel(){ this.dc = new FakeDC(); return this.dc; }
  async createOffer(){ return {type:"offer", sdp:"v=0 fake"}; } async setLocalDescription(){}
  async setRemoteDescription(){ setTimeout(() => { this.dc.readyState = "open"; this.dc.onopen && this.dc.onopen(); }, 30); }
  close(){} }
Object.defineProperty(window, "RTCPeerConnection", {value: FakePC, configurable: true, writable: true});
const fakeStream = () => { const ac = new AudioContext(); const o = ac.createOscillator(); const d = ac.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream; };
Object.defineProperty(navigator, "mediaDevices", {value: {getUserMedia: async () => fakeStream()}, configurable: true});
window.__rt = ev => window.__dc.onmessage({data: JSON.stringify(ev)});
"""

with sync_playwright() as p:
    # Browser wählbar (z. B. auf dem Mac: CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    b = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="light")
    ctx.add_init_script(FAKE_RT)
    pg = ctx.new_page()
    errors = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
    pg.route("https://api.openai.com/v1/realtime/calls", lambda r: r.fulfill(status=201, body="v=0 answer", headers={"content-type": "application/sdp"}))
    reset()
    pg.goto(BASE); pg.wait_for_timeout(800)

    # 1 Galerie + Zugangscode
    ok("Galerie sichtbar", pg.is_visible("#gallery"))
    ok("Kopfleiste: Banner-Bild im Logo-Knopf", pg.evaluate("!!document.querySelector('#homeBtn img') && document.querySelector('#homeBtn img').naturalWidth > 0"))
    ok("Kopfleiste hell: Banner-Orange", pg.evaluate("getComputedStyle(document.querySelector('.band')).backgroundColor") == "rgb(253, 77, 1)")
    ok("Kopfleiste: altes Startseiten-Banner entfernt", pg.locator(".hero .banner").count() == 0)
    ok("Fußzeile: Bildnachweis", "Katemangostar – Freepik.com" in pg.inner_text("footer .credit"))
    # v6.3: Reiter „Klären“ mit zwei Wegen, noch ohne Gesprächsablauf
    pg.click("#t-klaeren"); pg.wait_for_timeout(150)
    ok("Klären: Bereich sichtbar, zwei Wege", pg.is_visible("#p-klaeren") and pg.locator("#p-klaeren .klcard").count() == 2)
    ok("Klären: Stand mit Wort und Form", pg.locator("#p-klaeren .klstate").first.inner_text().startswith("○"))
    ok("Klären: Reiter an zweiter Stelle", pg.evaluate("[...document.querySelectorAll('[role=tab]')].map(t => t.id).indexOf('t-klaeren')") == 1)
    pg.click("#t-ueben"); pg.wait_for_timeout(150)
    ok("24 Szenarien + Eigenes-Karte", pg.locator("#sgrid .scard").count() == 25, pg.locator("#sgrid .scard").count())
    ok("Zugangscode-Karte (locked)", pg.is_visible("#gAccess"))
    pg.screenshot(path=S + "v5_gallery_light.png")
    pg.fill("#gAccess", "geheim"); pg.click("#gAccessSave"); pg.wait_for_timeout(200)
    ok("Zugangscode-Karte verschwindet", not pg.is_visible("#gAccess"))

    # 2 Szenario öffnen (Geführt)
    pg.click('[data-open="S01"]'); pg.wait_for_timeout(300)
    ok("Übungsansicht offen", pg.is_visible("#practice") and not pg.is_visible("#gallery"))
    ok("Eröffnungssatz im Log", pg.locator("#log .msg.them").count() == 1)
    ok("Klasse lvl-gefuehrt", "lvl-gefuehrt" in pg.get_attribute("#app", "class"))
    ok("Satzhilfen sichtbar (Geführt)", pg.is_visible("#helpers .chip"))

    # 3 Textzug mit Selbsteinschätzung
    pg.fill("#say", "Du hörst mir nie zu!"); pg.press("#say", "Enter")
    pg.wait_for_selector("#feed .fcard.turn [data-self]", timeout=4000)
    ok("Selbsteinschätzung erscheint", True)
    pg.click('#feed .fcard.turn [data-self="O"]')
    pg.wait_for_function("document.querySelector('#feed .fcard.turn') && document.querySelector('#feed .fcard.turn').textContent.includes('Schon gut')", timeout=5000)
    t = pg.inner_text("#feed .fcard.turn")
    ok("Coach-Karte mit Schon gut / Du wolltest", "Du wolltest" in t and "Schon gut" in t, t[:200])
    ok("Antwort des Gegenübers (live)", "erschöpft" in pg.inner_text("#log"))
    ok("Stimmungswort aktualisiert", "unsicher" in pg.inner_text("#moodText") or "hört zu" in pg.inner_text("#moodText"), pg.inner_text("#moodText"))
    pg.screenshot(path=S + "v5_practice_gefuehrt.png")

    # 4 Coach fragen (Text)
    pg.click("#askCoach2")
    pg.wait_for_selector("#feed .fcard.help:not(.pending)", timeout=5000)
    ok("Coach-Hilfe live", "Klingt, als wärst" in pg.inner_text("#feed .fcard.help"))

    # 5 Stufen
    pg.click('#lvlSeg [data-level="begleitet"]'); pg.wait_for_timeout(150)
    ok("Begleitet: Helfer aus, Umschalter an", not pg.is_visible("#helpers .chip") and pg.is_visible("#helpersToggle"))
    pg.screenshot(path=S + "v5_practice_begleitet.png")
    pg.click('#lvlSeg [data-level="frei"]'); pg.wait_for_timeout(150)
    ok("Frei: Zugkarten aus", not pg.is_visible("#feed .fcard.turn"))
    ok("Frei: Hilfe-Karte bleibt", pg.is_visible("#feed .fcard.help"))
    ok("Frei: Notizen-Zähler", pg.is_visible("#collected") and "Notiz" in pg.inner_text("#collected"))
    ok("Frei: Stimmung aus", not pg.is_visible("#mood"))
    pg.screenshot(path=S + "v5_practice_frei.png")
    pg.click('#lvlSeg [data-level="gefuehrt"]')

    # 6 Auszeit
    pg.click("#log"); pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    ok("Auszeit per Esc", pg.evaluate("document.querySelector('#dlgPause').open"))
    pg.click('#seFeel [data-se="angespannt"]'); pg.click('#seNeed [data-se="Ruhe"]')
    ok("Selbstempathie-Satz", "Ich bin gerade angespannt, weil ich Ruhe brauche" in pg.inner_text("#seSentence"))
    pg.screenshot(path=S + "v5_pause.png")
    pg.click("#pResume"); pg.wait_for_timeout(150)
    ok("Auszeit geschlossen", not pg.evaluate("document.querySelector('#dlgPause').open"))

    # 7 Auswertung
    pg.click("#endBtn")
    pg.wait_for_selector("#repMain .rep-sec", timeout=6000)
    rep = pg.inner_text("#repBody")
    ok("Auswertung live (Verlauf)", "Ihr seid angespannt" in rep, rep[:200])
    ok("Auswertung: Stärken + nächster Schritt", "Was dir schon gelungen ist" in rep and "Dein nächster Schritt" in rep)
    pg.click('#repRate [data-rate="4"]')
    pg.screenshot(path=S + "v5_report.png")
    pg.click("#repGallery"); pg.wait_for_timeout(200)
    ok("Zurück zur Galerie", pg.is_visible("#gallery"))
    ok("Weiterüben-Karte", "Weiterüben" in pg.inner_text("#continueBox"))

    # 8 Mein Weg
    pg.click("#t-weg"); pg.wait_for_timeout(200)
    ok("Mein Weg: Tabelle", "eher sicher" in pg.inner_text("#wegBody"), pg.inner_text("#wegBody")[:200])
    pg.screenshot(path=S + "v5_weg.png")

    # 9 Kurzübungen (v6): Übersicht, Einordnen mit Feier, Teil-Erfolg, Tastatur, Umformulieren, Schritte
    pg.click("#t-quiz"); pg.wait_for_timeout(150)
    ok("Kurzübungen: 23 Übungen + gemischte Runde", pg.locator("#deckgrid [data-deck]").count() == 24, pg.locator("#deckgrid [data-deck]").count())
    ok("Fünf Themengruppen", pg.locator("#deckgrid .kugroup").count() == 5)
    pg.screenshot(path=S + "v6_ku_home.png", full_page=True)
    ANS = "(() => { const e = KZ.queue[KZ.pos]; return e.u.items[e.i].ans; })()"
    OTHER = "(() => { const e = KZ.queue[KZ.pos], a = e.u.items[e.i].ans; return e.u.optionen.find(o => o.id !== a).id; })()"
    pg.click('[data-deck="obs"]')
    for i in range(10):
        pg.click(f'#quizRun [data-ans="{pg.evaluate(ANS)}"]'); pg.click("#qNext")
    ok("Alles klar eingeordnet + grüner Abschluss", "Alles klar eingeordnet" in pg.inner_text("#quizRun") and pg.locator(".kzend.done").count() == 1, pg.inner_text("#quizRun")[:200])
    ok("Konfetti erscheint", pg.locator("#confetti i").count() > 10, pg.locator("#confetti i").count())
    pg.wait_for_timeout(1300)
    ok("Entdeckung als Hinweis", "Entdeckt" in pg.inner_text("#toast"), pg.inner_text("#toast"))
    pg.screenshot(path=S + "v6_ku_done.png")
    pg.wait_for_timeout(1000)
    pg.click('#quizRun [data-kz="home"]'); pg.click('[data-deck="K17"]')
    n = pg.evaluate("KZ.queue.length")
    for i in range(n):
        pg.click(f'#quizRun [data-ans="{pg.evaluate(OTHER if i == 0 else ANS)}"]')
        if i == 0:
            ok("Andere Antwort: neutral markiert (◐, kein Rot)", pg.locator("#quizRun .ans.is-part").count() == 1 and "Eher:" in pg.inner_text("#qFb"))
        pg.click("#qNext")
    txt = pg.inner_text("#quizRun")
    ok("Teil-Erfolg würdigend, ohne Konfetti", "klar eingeordnet" in txt and "offenen nochmal" in txt and pg.locator("#confetti i").count() == 0, txt[:200])
    ok("Keine Wörter wie falsch/Fehler", "falsch" not in txt.lower() and "fehler" not in txt.lower())
    pg.click('#quizRun [data-kz="wrong"]'); pg.wait_for_timeout(100)
    idx = pg.evaluate("(() => { const e = KZ.queue[KZ.pos]; return e.u.optionen.findIndex(o => o.id === e.u.items[e.i].ans) + 1; })()")
    pg.keyboard.press(str(idx)); pg.wait_for_timeout(100)
    ok("Tastatur 1–6 beantwortet", pg.locator("#quizRun .ans.is-ok").count() == 1)
    pg.click('#quizRun [data-kz="home"]'); pg.click('[data-deck="K04"]')
    pg.fill("#kzIn", "Du kommst immer zu spät."); pg.click("#kzCheck")
    ok("Erst selbst einschätzen, dann Vorschläge", pg.is_visible("#kzRate") and "LERNFORM" not in pg.inner_text("#kzRes").upper())
    pg.click('#kzRate [data-rate="2"]'); pg.wait_for_timeout(100)
    res = pg.inner_text("#kzRes")
    ok("Umformulieren: Schnellhinweis nennt „immer“", "„immer“ steckt noch drin" in res, res[:200])
    ok("Umformulieren: Lernform + Alltag", "LERNFORM" in res.upper() and "ALLTAG" in res.upper())
    pg.click("#kzCoach"); pg.wait_for_selector("#kzCoachOut .fb", timeout=5000)
    ok("Umformulieren: Coach-Rückmeldung live", "Verallgemeinerung" in pg.inner_text("#kzCoachOut"))
    ok("Einschätzung bleibt sichtbar, Weiter aktiv", "fast" in pg.inner_text("#kzRes") and not pg.is_disabled("#kzNext"))
    nags = pg.evaluate("""(() => { let n = 0, all = 0, ex = []; KU.uebungen.filter(u => u.typ === 'umformulieren').forEach(u => u.items.forEach(it => (it.muster || []).forEach(m => { all++; const q = quickCheck(u.check, m, it.warn); if(q.next){ n++; if(ex.length < 6) ex.push(u.id + ': ' + q.next + ' | ' + m); } }))); return {n, all, ex}; })()""")
    ok("Schnellhinweis keine Formel-Polizei (Musterlösungen ≤ 10 % mit Hinweis)", nags["n"] <= nags["all"] * 0.1, nags)
    pg.screenshot(path=S + "v6_ku_umf.png", full_page=True)
    pg.click('#quizRun [data-kz="home"]'); pg.click('[data-deck="K12"]'); pg.click('#quizRun [data-kz="example"]')
    pg.click('#quizRun [data-kz="stepnext"]')
    pg.click('#quizRun [data-chip="traurig"]'); pg.fill("#kzIn", "traurig, weil mir Verlässlichkeit wichtig ist"); pg.click('#quizRun [data-kz="stepnext"]')
    pg.click('#quizRun [data-chip="Erholung"]'); pg.click('#quizRun [data-kz="stepnext"]')
    pg.click('#quizRun [data-kz="skip"]'); pg.wait_for_timeout(150)
    fin = pg.inner_text("#quizRun")
    ok("Schritte: Satz zusammengesetzt", "Was ich bedauere:" in fin and "Erholung" in fin and "Nächstes Mal" not in fin, fin[:300])
    pg.screenshot(path=S + "v6_ku_schritte.png")

    # 9b Spickzettel mit Hörkarten
    pg.click("#t-cheat"); pg.wait_for_timeout(150)
    ok("16 Spickzettel", pg.locator("#szGrid .szcard").count() == 16)
    pg.click('#szFilters [data-szf="hoeren"]')
    ok("Filter Zuhören: 2 Karten", pg.locator("#szGrid .szcard").count() == 2)
    reset(); pg.click('#szGrid [data-hear="SZ09"]'); pg.wait_for_timeout(1500)
    tts = [x for x in calls() if "audio/speech" in x["url"]]
    ok("Hörkarte über Coach-Stimme", any('"voice":"sage"' in x["body"] for x in tts), [x["body"][:80] for x in tts])
    pg.click('#szFilters [data-szf="all"]'); pg.click('#szGrid [data-godeck="K04"]'); pg.wait_for_timeout(150)
    ok("Spickzettel → Übung", pg.is_visible("#quizRun") and "Kamera-Test" in pg.inner_text("#quizRun") or pg.is_visible("#kzIn"))
    pg.click("#t-cheat"); pg.screenshot(path=S + "v6_spick.png")

    # 9c Lernkarten + PDFs
    pg.click("#t-karten"); pg.wait_for_timeout(150)
    ok("Gefühlskarten sichtbar", pg.locator("#lkBody .lkcard").count() >= 60, pg.locator("#lkBody .lkcard").count())
    pg.click('#lkKind [data-kind="bed"]'); ok("Bedürfniskarten sichtbar", pg.locator("#lkBody .lkcard").count() >= 50)
    pg.click('#lkKind [data-kind="pseudo"]'); ok("Pseudogefühle-Tabelle", pg.locator("#lkBody tbody tr").count() >= 16)
    pg.click('#lkKind [data-kind="gef"]'); pg.click("#lkDraw"); ok("Karte ziehen", pg.is_visible("#lkDrawn") and "Wann hast du dich" in pg.inner_text("#lkDrawn"))
    links = pg.eval_on_selector_all("#lkDownloads a[href$='.pdf']", "els => els.map(e => e.getAttribute('href'))")
    ok("4 PDF-Downloads", len(links) == 4, links)
    good = 0
    for h in links:
        r = pg.request.get(BASE + h)
        if r.status == 200 and r.body()[:4] == b"%PDF": good += 1
    ok("PDFs werden ausgeliefert", good == 4, good)
    pg.screenshot(path=S + "v6_karten.png")

    # 9d Empathisch zuhören
    pg.click("#t-hoeren"); pg.wait_for_timeout(150)
    ok("15 Personen + Zufall", pg.locator("#empGrid [data-emp]").count() == 16)
    pg.screenshot(path=S + "v6_hoeren_home.png")
    pg.click('#empGrid [data-emp="E01"]'); pg.wait_for_timeout(150)
    E = pg.evaluate("EMP_BY.E01")
    ok("Person erzählt", E["sagt"][:30] in pg.inner_text("#erLog"))
    dg = [w for w in E["auswahl_g"] if w not in E["gefuehle"] + E["nahe_gefuehle"]][0]
    db = [w for w in E["auswahl_b"] if w not in E["beduerfnisse"] + E["nahe_beduerfnisse"]][0]
    pg.click(f'#erInput [data-pick="g"][data-w="{dg}"]'); pg.click(f'#erInput [data-pick="b"][data-w="{db}"]')
    ok("Vorschau als Frage", pg.inner_text("#erPreview").startswith("Bist du") and pg.inner_text("#erPreview").endswith("?"))
    pg.click('#erInput [data-er="ask"]'); pg.wait_for_timeout(700)
    ok("Daneben: Person bleibt im Gespräch", E["reaktion"]["daneben"][:25] in pg.inner_text("#erLog"))
    pg.click(f'#erInput [data-pick="g"][data-w="{E["gefuehle"][0]}"]'); pg.click(f'#erInput [data-pick="b"][data-w="{E["beduerfnisse"][0]}"]')
    pg.click('#erInput [data-er="ask"]'); pg.wait_for_selector("#erCoach .coachfin", timeout=4000)
    ok("Treffer: Person fühlt sich verstanden", pg.locator("#erLog .msg.them.hit").count() == 1 and E["reaktion"]["mehr"][:25] in pg.inner_text("#erLog"))
    ok("Coach würdigt + Auflösung", "Schon gut" in pg.inner_text("#erCoach") and E["gefuehle"][0] in pg.inner_text("#erCoach"))
    ok("Zuhören gespeichert", pg.evaluate("JSON.parse(localStorage.getItem('gfk.emp')).E01.hit") is True)
    pg.screenshot(path=S + "v6_hoeren_treffer.png", full_page=True)
    ok("Blocker erkannt (offline)", pg.evaluate("evalGuess(EMP_BY.E01, 'Du solltest dir einen Babysitter suchen.').art") == "blocker")
    ok("Alltagswörter zählen (offline)", pg.evaluate("evalGuess(EMP_BY.E01, 'Bist du total fertig und brauchst mal eine Pause?').art") == "treffer")
    pg.click('#erCoach [data-er="home"]'); pg.click('#empHow [data-how="text"]'); pg.click('#empGrid [data-emp="E12"]'); pg.wait_for_timeout(100)
    ok("Siezen bei Anrede Sie", "Sind Sie" in pg.inner_text("#erInput"))
    pg.fill("#erIn", "Sind Sie verzweifelt, weil Sie sich Sicherheit für Ihr Baby wünschen?"); pg.press("#erIn", "Enter")
    pg.wait_for_selector("#erCoach .coachfin", timeout=5000)
    ok("Freie Vermutung live bewertet", "Danke, dass du fragst" in pg.inner_text("#erLog"))
    pg.click('#erCoach [data-er="home"]'); pg.click('#empHow [data-how="pick"]')

    # 10 Übersetzer
    pg.click("#t-xl"); pg.fill("#wolfIn", "Du kommst immer zu spät!"); pg.click("#xlGo")
    pg.wait_for_function("document.querySelector('#xlAlt').textContent.includes('Verlässlichkeit')", timeout=5000)
    ok("Übersetzer live", True)
    pg.screenshot(path=S + "v5_xl.png")

    # 11 Eigenes Szenario
    pg.click("#t-ueben"); pg.click("#newCustom"); pg.wait_for_timeout(150)
    ok("Dialog Eigenes Szenario", pg.evaluate("document.querySelector('#dlgCustom').open"))
    pg.fill("#cWho", "Mein Nachbar Jonas"); pg.fill("#cWhat", "Er hört nachts laute Musik, ich kann nicht schlafen.")
    pg.click('#cStart [data-v="them"]')
    pg.screenshot(path=S + "v5_custom_form.png")
    pg.click("#custForm [type=submit]")
    pg.wait_for_selector("#custPreview:not([hidden]) h3", timeout=5000)
    ok("Vorschau mit Claude-Titel", "Nachbar und die laute Musik" in pg.inner_text("#custPreview"))
    pg.screenshot(path=S + "v5_custom_preview.png")
    pg.click("#custSave"); pg.wait_for_timeout(300)
    ok("Eigenes Szenario geöffnet", pg.inner_text("#pTitle") == "Nachbar und die laute Musik")
    ok("Eröffnung aus Claude", "Was gibt’s denn" in pg.inner_text("#log"))
    pg.click("#backBtn"); pg.wait_for_timeout(200)
    ok("Filter Meine zeigt Szenario", pg.locator('#sgrid [data-del]').count() == 1)
    pg.click("#sgrid [data-del]"); pg.click("#sgrid [data-del]"); pg.wait_for_timeout(100)
    ok("Löschen in zwei Schritten", pg.locator('#sgrid [data-del]').count() == 0)

    # 12 Sprechen-Modus: Antwort und Coach werden vorgelesen (TTS über Server)
    pg.click('#filters [data-f="all"]'); pg.click('[data-open="S02"]'); pg.wait_for_timeout(200)
    pg.click('#modeSeg [data-mode="voice"]'); pg.wait_for_timeout(150)
    ok("Bühne sichtbar", pg.is_visible("#stage"))
    reset()
    if not pg.is_visible("#vSay"): pg.click("#typeInstead summary")
    pg.fill("#vSay", "Ich bin traurig, weil mir Verlässlichkeit wichtig ist."); pg.press("#vSay", "Enter")
    pg.wait_for_timeout(2500)
    c = calls(); tts = [x for x in c if "audio/speech" in x["url"]]
    ok("TTS fürs Gegenüber aufgerufen", any('"Okay' in x["body"] for x in tts), [x["body"][:80] for x in tts])
    pg.click("#askCoach2"); pg.wait_for_timeout(2500)
    tts = [x for x in calls() if "audio/speech" in x["url"]]
    ok("TTS für Coach-Hilfe aufgerufen", any("Coach" in x["body"] and "Klingt" in x["body"] for x in tts), [x["body"][:120] for x in tts])
    pg.screenshot(path=S + "v5_voice.png")

    # 13 Echtzeit (gemockt): Coach-Pause ohne laufende Antwort, Cancel-Fehler unterdrückt
    pg.click("#backBtn"); pg.click('[data-open="S03"]'); pg.wait_for_timeout(200)
    pg.click('#modeSeg [data-mode="rt"]'); pg.wait_for_timeout(150)
    ok("Echtzeit verfügbar", not pg.is_disabled("#mic"), pg.inner_text("#micLabel"))
    pg.click("#rtVoicePick"); pg.wait_for_timeout(250)
    ok("Echtzeit: „Stimme wählen“ öffnet die Einstellungen bei den Stimmen", pg.evaluate("document.querySelector('#dlgSettings').open") and pg.evaluate("document.activeElement.id") == "rtVoice", pg.evaluate("document.activeElement.id"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    pg.click("#mic"); pg.wait_for_timeout(200)
    ok("Einwilligung erscheint", pg.evaluate("document.querySelector('#dlgConsent').open"))
    pg.screenshot(path=S + "v5_consent.png")
    pg.click("#consOk"); pg.wait_for_timeout(800)
    ok("Echtzeit verbunden", "Mikrofon offen" in pg.inner_text("#micLabel"), pg.inner_text("#micLabel") + " | " + pg.inner_text("#sysnote"))
    sent = pg.evaluate("window.__sent")
    ok("Eröffnung per response.create", any(s.get("type") == "response.create" for s in sent))
    pg.evaluate("""() => { __rt({type:'response.created'}); __rt({type:'response.output_audio_transcript.delta', delta:'Hallo'}); __rt({type:'response.output_audio_transcript.done', transcript:'Hallo, was ist?'}); __rt({type:'response.done'}); }""")
    pg.evaluate("""() => { __rt({type:'input_audio_buffer.speech_started'}); __rt({type:'conversation.item.input_audio_transcription.completed', item_id:'i1', transcript:'Du bist immer so egoistisch!'}); }""")
    pg.wait_for_timeout(1200)
    ok("Nutzersatz + Coach-Karte in Echtzeit", pg.locator("#log .msg.me").count() >= 1 and "Schon gut" in pg.inner_text("#feed"))
    # v6: Nach der Antwort des Gegenübers wird die Coach-Hilfe im Hintergrund vorbereitet
    reset()
    pg.evaluate("""() => { __rt({type:'response.created'}); __rt({type:'response.output_audio_transcript.done', transcript:'Egoistisch? Ich mache hier alles allein.'}); __rt({type:'response.done'}); }""")
    pg.wait_for_timeout(800)
    pre = [x for x in calls() if "anthropic" in x["url"] and "einschaetzung" in x["body"]]
    ok("v6: Coach-Hilfe vorbereitet (Echtzeit)", len(pre) == 1, len(pre))
    reset(); pg.evaluate("window.__sent = []")
    pg.click("#askCoach2"); pg.wait_for_timeout(2500)
    sent = pg.evaluate("window.__sent")
    ok("Kein response.cancel ohne laufende Antwort", not any(s.get("type") == "response.cancel" for s in sent), sent)
    ok("v6: Coach nutzt vorbereitete Hilfe (kein neuer Claude-Aufruf)", not any("anthropic" in x["url"] and "einschaetzung" in x["body"] for x in calls()))
    tts = [x for x in calls() if "audio/speech" in x["url"] and '"voice":"sage"' in x["body"]]
    ok("Coach spricht in Echtzeit (TTS)", any("Vermutlich" in x["body"] for x in tts), [x["body"][:100] for x in tts])
    ok("v6: Coach-Stimme in Stücken (erster Satz zuerst)", any("Vermutlich" in x["body"] and "Klingt" not in x["body"] for x in tts) and any("Klingt" in x["body"] and "Vermutlich" not in x["body"] for x in tts), [x["body"][:100] for x in tts])
    ok("Pause-Zustand", "Pause" in pg.inner_text("#micLabel"))
    pg.evaluate("""() => __rt({type:'error', error:{type:'invalid_request_error', code:'response_cancel_not_active', message:'Cancellation failed: no active response found'}})""")
    ok("Cancel-Fehler wird nicht angezeigt", "Cancellation" not in pg.inner_text("#sysnote"))
    pg.screenshot(path=S + "v5_rt_pause.png")
    ok("Hilfe-Karte nennt Bezug", "zu: „" in pg.inner_text("#feed"))
    pg.click("#mic"); pg.wait_for_timeout(200)
    ok("Weiter sprechen per Mikrofon", "Mikrofon offen" in pg.inner_text("#micLabel"))
    pg.evaluate("window.__sent = []; __rt({type:'response.created'})")
    pg.click("#askCoach2"); pg.wait_for_timeout(300)
    ok("response.cancel bei laufender Antwort", any(s.get("type") == "response.cancel" for s in pg.evaluate("window.__sent")))
    pg.wait_for_timeout(2000); pg.click("#mic"); pg.wait_for_timeout(100)
    pg.click("#rtStop"); pg.wait_for_timeout(150)
    ok("Echtzeit beendet", "Gespräch beginnen" in pg.inner_text("#micLabel"))

    pg.click("#t-weg"); pg.wait_for_timeout(150)
    weg = pg.inner_text("#wegBody")
    ok("Mein Weg: Woche, Kurzübungen, Zuhören, Entdeckungen", all(s in weg for s in ["Diese Woche", "Kurzübungen", "Zuhören", "Entdeckungen", "sicher"]), weg[:300])
    ok("Mein Weg: heutiger Übungstag", pg.locator(".weekdots li.on").count() >= 1)
    pg.screenshot(path=S + "v6_weg.png", full_page=True)
    pg.click("#t-ueben")
    if pg.is_visible("#backBtn"): pg.click("#backBtn")
    pg.click('#filters [data-f="all"]'); pg.click('[data-open="S04"]'); pg.wait_for_timeout(150)
    ok("Nur ein Coach-Knopf sichtbar (Desktop)", not pg.is_visible("#askCoach") and pg.is_visible("#askCoach2"))
    ok("Keine Konsolenfehler", not errors, errors[:5])
    ctx.close()

    # 14 Offline-Modus: Auto-Coach in Geführt nach 2 Schwierigkeiten
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page(); errors2 = []
    pg.on("pageerror", lambda e: errors2.append(str(e)))
    pg.goto(BASE); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('gfk.settings', JSON.stringify({live:false, selfAssess:false}))"); pg.reload(); pg.wait_for_timeout(600)
    pg.click('[data-open="S01"]')
    for s in ["Du bist so egoistisch, immer machst du das!", "Du solltest dich echt schämen, das ist typisch für dich."]:
        pg.fill("#say", s); pg.press("#say", "Enter"); pg.wait_for_timeout(900)
    pg.wait_for_timeout(600)
    ok("Auto-Coach (Geführt, offline)", pg.locator("#feed .fcard.auto").count() == 1, pg.inner_text("#feed")[-300:])
    pg.screenshot(path=S + "v5_autocoach.png")
    ok("Offline ohne Fehler", not errors2, errors2)
    ctx.close()

    # 15 Sprachmodus beim Lernen (Spracherkennung nachgebildet) + Feiern abschaltbar
    FAKE_SR = r"""
    window.__srQueue = []; window.__srStarted = 0;
    class FakeSR { start(){ window.__srStarted++; const t = window.__srQueue.shift(); setTimeout(() => {
        if(t == null){ this.onerror && this.onerror({error:"no-speech"}); this.onend && this.onend(); return; }
        const r = [{transcript:t}]; r.isFinal = true; this.onresult && this.onresult({resultIndex:0, results:[r]}); this.onend && this.onend(); }, 80); }
      stop(){} abort(){ this.onend && this.onend(); } }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
    """
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_init_script(FAKE_SR)
    pg = ctx.new_page(); errors3 = []
    pg.on("pageerror", lambda e: errors3.append(str(e)))
    pg.goto(BASE); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.setItem('gfk.access','geheim')"); pg.reload(); pg.wait_for_timeout(600)
    pg.click("#t-quiz"); pg.click('#kuHow [data-how="voice"]')
    ok("Hinweis Sprachmodus", "antwortest mit deiner Stimme" in pg.inner_text("#kuHowNote"))
    pg.click('[data-deck="K01"]'); pg.wait_for_timeout(100)
    spoken = pg.evaluate("(() => { const e = KZ.queue[KZ.pos], it = e.u.items[e.i]; return e.u.optionen.find(o => o.id === it.ans).sprich[0]; })()")
    pg.evaluate(f"window.__srQueue.push({spoken!r})")
    pg.wait_for_function("KZ && KZ.pos >= 1", timeout=12000)
    ok("Gesprochene Antwort erkannt und gewertet", pg.evaluate("KZ.right") == 1)
    pg.click('#quizRun [data-kz="home"]'); pg.click('[data-deck="K04"]'); pg.wait_for_timeout(100)
    pg.evaluate("window.__srQueue.push('Heute bist du um 9:20 Uhr gekommen, verabredet war 9 Uhr.', 'sitzt', 'weiter')")
    pg.wait_for_function("KZ && KZ.pos >= 1", timeout=20000)
    ok("Umformulieren per Stimme + „sitzt“", pg.evaluate("KZ.rates[0]") == 3)
    pg.click('#quizRun [data-kz="home"]'); pg.click('#kuHow [data-how="tap"]')
    pg.click("#t-hoeren"); pg.click('#empHow [data-how="voice"]'); pg.click('#empGrid [data-emp="E02"]')
    pg.evaluate("window.__srQueue.push('Bist du erleichtert, weil dir Anerkennung wichtig ist?')")
    pg.wait_for_selector("#erCoach .coachfin", timeout=20000)
    ok("Zuhören per Stimme", pg.locator("#erLog .msg.me").count() == 1)
    pg.click('#erCoach [data-er="home"]'); pg.click('#empHow [data-how="pick"]')
    # Feiern aus: grüner Abschluss bleibt, kein Konfetti
    pg.click("#openSettings"); pg.click("#swAnim"); pg.keyboard.press("Escape")
    pg.click("#t-quiz"); pg.click('[data-deck="feel"]')
    for i in range(10):
        pg.click(f'#quizRun [data-ans="{pg.evaluate(ANS)}"]'); pg.click("#qNext")
    ok("Feiern aus: Abschluss grün, kein Konfetti", pg.locator(".kzend.done").count() == 1 and pg.locator("#confetti i").count() == 0)
    ok("Sprachmodus ohne Fehler", not errors3, errors3)
    ctx.close()

    # 16 Handy (390 px), hell und dunkel: kein waagrechtes Scrollen
    for scheme in ["light", "dark"]:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, color_scheme=scheme, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.goto(BASE + "#hoeren"); pg.wait_for_timeout(600)
        sw = []
        for tab in ["hoeren", "quiz", "karten", "cheat", "weg"]:
            pg.click("#t-" + tab); pg.wait_for_timeout(150); sw.append(pg.evaluate("document.documentElement.scrollWidth"))
            if tab in ("hoeren", "karten"): pg.screenshot(path=S + f"v6_mob_{scheme}_{tab}.png")
        pg.click("#t-hoeren"); pg.click('#empGrid [data-emp="E11"]'); pg.wait_for_timeout(150); sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        pg.screenshot(path=S + f"v6_mob_{scheme}_hoeren_run.png", full_page=True)
        pg.click("#t-quiz"); pg.click('[data-deck="K10"]'); pg.wait_for_timeout(150); sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        pg.screenshot(path=S + f"v6_mob_{scheme}_k10.png", full_page=True)
        ok(f"Handy {scheme}: kein waagrechtes Scrollen", max(sw) <= 390, sw)
        ctx.close()

    # 17 (v6.1) Übungsansicht + Auszeit auf dem Handy (hell/dunkel) und am Desktop dunkel:
    #    Schriftzug-Farbe, Tippflächen mindestens 44 px, kein waagrechtes Scrollen, Auszeit im Bild.
    #    Wichtig: Tippflächen VOR jedem Ganzseiten-Screenshot messen – screenshot(full_page=True) setzt in
    #    Handy-Kontexten die Touch-Erkennung (pointer:coarse) zurück, danach messen alle Knöpfe zu klein.
    SMALL_JS = """() => [...document.querySelectorAll('button, a[href], [role=tab], select, summary, input:not([type=hidden]), textarea')]
      .filter(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && !e.closest('[hidden]') && !e.closest('dialog:not([open])') && r.height < 43.5; })
      .map(e => (e.innerText || e.getAttribute('aria-label') || e.id || e.tagName).trim().replace(/\\s+/g, ' ').slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().height))"""
    DLG_JS = "(() => { const r = document.querySelector('#dlgPause').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; })()"
    SCROLLW = "document.documentElement.scrollWidth"
    WORT = "getComputedStyle(document.querySelector('#openSettings')).color"

    def uebung_mit_coach(pg):
        reset(); pg.goto(BASE); pg.wait_for_timeout(500)
        pg.fill("#gAccess", "geheim"); pg.click("#gAccessSave")
        pg.click('[data-open="S01"]'); pg.wait_for_timeout(300)
        pg.fill("#say", "Du hörst mir nie zu!"); pg.press("#say", "Enter")
        pg.locator('.fcard.turn [data-self="O"]:visible').first.click()
        pg.wait_for_function("[...document.querySelectorAll('.fcard.turn')].some(e => e.offsetParent !== null && e.textContent.includes('Schon gut'))", timeout=6000)
        pg.wait_for_timeout(300)

    for scheme, wort in [("light", "rgb(255, 255, 255)"), ("dark", "rgb(255, 255, 255)")]:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, color_scheme=scheme, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
        reset(); pg.goto(BASE); pg.wait_for_timeout(500)
        ok(f"Handy {scheme}: Zahnrad weiß auf Orange", pg.evaluate(WORT) == wort and pg.evaluate("getComputedStyle(document.querySelector('.band')).backgroundColor") == "rgb(253, 77, 1)", pg.evaluate(WORT))
        KZ = "(() => { const b = document.querySelector('.band').getBoundingClientRect(), n = document.querySelector('.navwrap').getBoundingClientRect(); return {bandTop: Math.round(b.top), bandBottom: Math.round(b.bottom), navBottom: Math.round(n.bottom), weg: document.querySelector('.navwrap').classList.contains('weg'), kopfH: getComputedStyle(document.documentElement).getPropertyValue('--kopf-h').trim()}; })()"
        kz = pg.evaluate("document.querySelector('.band').getBoundingClientRect().height + document.querySelector('.navwrap').getBoundingClientRect().height")
        ok(f"Handy {scheme}: Kopfzone höchstens 180 px, Reiter in 2 Zeilen", kz <= 180 and len(set(pg.evaluate("[...document.querySelectorAll('[role=tab]')].map(t => Math.round(t.getBoundingClientRect().top))"))) == 2, kz)
        # v6.4: Reiter gleiten beim Herunterscrollen unter das Banner und kommen beim Hochscrollen zurück
        for y in (300, 600, 900):
            pg.evaluate(f"scrollTo(0, {y})"); pg.wait_for_timeout(120)
        pg.wait_for_timeout(350); k = pg.evaluate(KZ)
        ok(f"Handy {scheme}: runter – Banner bleibt oben, Reiter darunter verschwunden", k["bandTop"] == 0 and k["weg"] and k["navBottom"] <= k["bandBottom"] and k["kopfH"] == f"{k['bandBottom']}px", k)
        pg.evaluate("scrollTo(0, 860)"); pg.wait_for_timeout(450); k = pg.evaluate(KZ)
        ok(f"Handy {scheme}: hoch – Reiter wieder sichtbar unter dem Banner", k["bandTop"] == 0 and not k["weg"] and k["navBottom"] > k["bandBottom"] + 40, k)
        pg.evaluate("scrollTo(0, 1200)"); pg.wait_for_timeout(120); pg.evaluate("scrollTo(0, 1500)"); pg.wait_for_timeout(400)
        pg.focus("#t-hoeren"); pg.wait_for_timeout(350); k = pg.evaluate(KZ)
        ok(f"Handy {scheme}: Tastatur-Fokus holt die Reiter zurück", not k["weg"] and k["navBottom"] > k["bandBottom"] + 40, k)
        pg.evaluate("scrollTo(0, 0)")
        ok(f"Handy {scheme}: Galerie, Tippflächen ≥ 44 px", pg.evaluate(SMALL_JS) == [], pg.evaluate(SMALL_JS))
        uebung_mit_coach(pg)
        sw = [pg.evaluate(SCROLLW)]
        ok(f"Handy {scheme}: Übung mit Coach, Tippflächen ≥ 44 px", pg.evaluate(SMALL_JS) == [], pg.evaluate(SMALL_JS))
        ok(f"Handy {scheme}: Logo-Knopf mindestens 44 px hoch", pg.evaluate("document.querySelector('#homeBtn').getBoundingClientRect().height") >= 44)
        pg.screenshot(path=S + f"v61_mob_{scheme}_uebung.png")
        pg.click("#log"); pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
        sw.append(pg.evaluate(SCROLLW)); dlg = pg.evaluate(DLG_JS)
        ok(f"Handy {scheme}: Auszeit offen und im Bild", pg.evaluate("document.querySelector('#dlgPause').open") and dlg[0] >= 0 and dlg[1] <= 390, dlg)
        ok(f"Handy {scheme}: Auszeit, Tippflächen ≥ 44 px", pg.evaluate(SMALL_JS) == [], pg.evaluate(SMALL_JS))
        pg.screenshot(path=S + f"v61_mob_{scheme}_auszeit.png")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        ok(f"Handy {scheme}: Übung + Auszeit ohne waagrechtes Scrollen", max(sw) <= 390, sw)
        ok(f"Handy {scheme}: Übung + Auszeit ohne Konsolenfehler", not errs, errs)
        pg.screenshot(path=S + f"v61_mob_{scheme}_uebung_ganz.png", full_page=True)   # zuletzt: setzt die Touch-Erkennung zurück
        ctx.close()

    ctx = b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
    pg = ctx.new_page(); errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    uebung_mit_coach(pg)
    ok("Desktop dunkel: Zahnrad weiß auf Banner-Orange", pg.evaluate(WORT) == "rgb(255, 255, 255)" and pg.evaluate("getComputedStyle(document.querySelector('.band')).backgroundColor") == "rgb(253, 77, 1)", pg.evaluate(WORT))
    ok("Desktop dunkel: Coach-Spalte sichtbar", pg.is_visible("#coachcol") and "Schon gut" in pg.inner_text("#feed"))
    pg.screenshot(path=S + "v61_desk_dark_uebung.png")
    sw = [pg.evaluate(SCROLLW)]
    pg.click("#log"); pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
    sw.append(pg.evaluate(SCROLLW))
    ok("Desktop dunkel: Auszeit offen", pg.evaluate("document.querySelector('#dlgPause').open"))
    pg.screenshot(path=S + "v61_desk_dark_auszeit.png")
    ok("Desktop dunkel: kein waagrechtes Scrollen", max(sw) <= 1280, sw)
    ok("Desktop dunkel: ohne Konsolenfehler", not errs, errs)
    ctx.close()

    # 18 (v6.2) Stimmen anhören in den Einstellungen (Beispielsatz mit der gewählten Stimme über /api/tts)
    def sprache(): return [x for x in calls() if "audio/speech" in x["url"]]
    NOTE = "document.querySelector('#voiceNote').textContent"
    def wartet_auf_hoeren(pg, name): pg.wait_for_function(f"{NOTE}.includes('Du hörst: {name}')", timeout=5000)
    def knopf(pg, sel): return pg.inner_text(sel + " span")

    ctx = b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="light")
    pg = ctx.new_page(); errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    reset(); pg.goto(BASE); pg.wait_for_timeout(500)
    pg.fill("#gAccess", "geheim"); pg.click("#gAccessSave"); pg.wait_for_timeout(200)
    pg.click("#openSettings"); pg.wait_for_timeout(250)
    ok("Stimmen: Anhören-Knöpfe sichtbar mit Namen", pg.is_visible("#vpThem") and pg.is_visible("#vpCoach")
       and pg.get_attribute("#vpThem", "aria-label") == "Stimme des Gegenübers anhören" and pg.get_attribute("#vpCoach", "aria-label") == "Stimme des Coachs anhören")
    pg.select_option("#rtVoice", "cedar"); pg.wait_for_timeout(300)
    ok("Stimmen: Auswahl allein startet keine Vorschau", len(sprache()) == 0, len(sprache()))
    pg.click("#vpThem"); wartet_auf_hoeren(pg, "Cedar")
    a = sprache()
    ok("Stimmen: Gegenüber-Vorschau mit gewählter Stimme und ruhiger Grundstimmung",
       len(a) == 1 and '"voice":"cedar"' in a[0]["body"] and "KI-Stimme" in a[0]["body"] and "Grundstimmung gerade: hört zu" in a[0]["body"], [x["body"][:160] for x in a])
    ok("Stimmen: Zustand mit Wort und Symbol („Stopp“, nicht nur Farbe)",
       knopf(pg, "#vpThem") == "Stopp" and pg.get_attribute("#vpThem", "aria-label") == "Stopp: Vorschau beenden" and pg.is_visible("#vpThem .i-stop") and not pg.is_visible("#vpThem .i-play"))
    ok("Stimmen: beide Knöpfe gleich breit (kein Springen, Auswahlen bündig)", pg.evaluate("document.querySelector('#vpThem').offsetWidth === document.querySelector('#vpCoach').offsetWidth && document.querySelector('#rtVoice').offsetWidth === document.querySelector('#coachVoice').offsetWidth"))
    pg.screenshot(path=S + "v62_desk_light_stimmen.png")
    pg.click("#vpThem"); pg.wait_for_timeout(200)
    ok("Stimmen: zweiter Druck beendet die Vorschau", knopf(pg, "#vpThem") == "Anhören" and pg.evaluate("player.paused") and pg.evaluate(NOTE) == "")
    pg.click("#vpThem"); wartet_auf_hoeren(pg, "Cedar")
    ok("Stimmen: dieselbe Stimme wird nicht erneut geladen", len(sprache()) == 1, len(sprache()))
    pg.select_option("#rtVoice", "coral"); pg.wait_for_timeout(200)
    ok("Stimmen: Wechsel der Stimme stoppt die Vorschau und speichert sie", knopf(pg, "#vpThem") == "Anhören" and pg.evaluate("player.paused") and pg.evaluate("settings.rtVoice") == "coral")
    pg.select_option("#coachVoice", "marin"); pg.click("#vpCoach"); wartet_auf_hoeren(pg, "Marin")
    c = [x for x in sprache() if '"voice":"marin"' in x["body"]]
    ok("Stimmen: Coach-Vorschau mit Coach-Ton", len(c) == 1 and "warmer, ruhiger Coach" in c[0]["body"] and "dein Coach" in c[0]["body"], [x["body"][:160] for x in c])
    pg.click("#vpThem"); pg.wait_for_function("document.querySelector('#vpThem').dataset.state === 'on'", timeout=5000)
    ok("Stimmen: neue Vorschau löst die laufende ab", knopf(pg, "#vpCoach") == "Anhören" and knopf(pg, "#vpThem") == "Stopp")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
    ok("Stimmen: Schließen der Einstellungen stoppt die Vorschau", pg.evaluate("player.paused") and knopf(pg, "#vpThem") == "Anhören" and pg.evaluate("voicePrev === null"))
    ok("Stimmen: ohne Konsolenfehler", not errs, errs)
    ctx.close()

    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page(); reset(); pg.goto(BASE); pg.wait_for_timeout(500)
    pg.click("#openSettings"); pg.wait_for_timeout(250); pg.click("#vpThem")
    pg.wait_for_function(f"{NOTE}.includes('Zugangscode')", timeout=5000)
    ok("Stimmen: ohne Zugangscode freundliche Meldung, Knopf wieder bereit", knopf(pg, "#vpThem") == "Anhören" and len(sprache()) == 0, pg.evaluate(NOTE))
    ok("Stimmen: Meldung liegt im sichtbaren Bereich", pg.evaluate("(() => { const r = document.querySelector('#voiceNote').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()"))
    ctx.close()

    # Handy (390 px), hell und dunkel: Zeile passt, Knopf ≥ 44 px, kein waagrechtes Scrollen
    for scheme in ["light", "dark"]:
        ctx = b.new_context(viewport={"width": 390, "height": 844}, color_scheme=scheme, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); reset(); pg.goto(BASE); pg.wait_for_timeout(500)
        pg.fill("#gAccess", "geheim"); pg.click("#gAccessSave"); pg.click("#openSettings"); pg.wait_for_timeout(250)
        pg.evaluate("document.querySelector('#natVoices').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150)
        pg.click("#vpThem"); wartet_auf_hoeren(pg, "Marin")
        r = pg.evaluate("""() => { const b = document.querySelector('#vpThem').getBoundingClientRect(), s = document.querySelector('#rtVoice').getBoundingClientRect(), d = document.querySelector('#dlgSettings .dlg');
          return {knopfL: Math.round(b.left), knopfR: Math.round(b.right), knopfH: Math.round(b.height), selB: Math.round(s.width), dlgOffen: d.scrollWidth - d.clientWidth, seite: document.documentElement.scrollWidth}; }""")
        ok(f"Handy {scheme}: Stimmenzeile passt, Knopf ≥ 44 px, nichts ragt heraus",
           r["knopfL"] >= 0 and r["knopfR"] <= 390 and r["knopfH"] >= 44 and r["selB"] >= 120 and r["dlgOffen"] <= 1 and r["seite"] <= 390, r)
        pg.screenshot(path=S + f"v62_mob_{scheme}_stimmen.png")
        pg.click("#vpThem"); pg.wait_for_timeout(150)
        ctx.close()
    b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} bestanden")
for f in fails: print("FAIL:", f[0], f[2])
