"""Funktionstest des Trainers gegen den Test-Server (tests/devserver.mjs, Port 8766).

Vorbereitung (einmalig):  pip install playwright && python3 -m playwright install chromium
Ablauf:  1) python3 src/build.py   2) node tests/devserver.mjs   3) python3 tests/test_app.py
Screenshots landen in tests/shots/ (nicht im Git).
"""
import json, sys, pathlib, urllib.request
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
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
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

    # 9 Quiz
    pg.click("#t-quiz"); pg.wait_for_timeout(150)
    pg.click('[data-deck="obs"]')
    for i in range(10):
        pg.click('#quizRun [data-ans="a"]'); pg.click("#qNext")
    ok("Quiz-Ergebnis", "von 10 richtig" in pg.inner_text("#quizRun"))
    pg.screenshot(path=S + "v5_quiz.png")

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
    reset(); pg.evaluate("window.__sent = []")
    pg.click("#askCoach2"); pg.wait_for_timeout(2500)
    sent = pg.evaluate("window.__sent")
    ok("Kein response.cancel ohne laufende Antwort", not any(s.get("type") == "response.cancel" for s in sent), sent)
    tts = [x for x in calls() if "audio/speech" in x["url"]]
    ok("Coach spricht in Echtzeit (TTS)", len(tts) >= 1 and '"voice":"sage"' in tts[-1]["body"] and "Vermutlich" in tts[-1]["body"], [x["body"][:100] for x in tts])
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
    b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} bestanden")
for f in fails: print("FAIL:", f[0], f[2])
