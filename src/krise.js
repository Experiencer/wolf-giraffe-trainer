/* ===================== Krisenpfad (A-24, v6.7) =====================
   Worum geht es? Menschen erzählen beim Üben manchmal von etwas, das größer ist als eine Übung:
   Gedanken, nicht mehr leben zu wollen, Selbstverletzung, Gewalt, Missbrauch oder akute Gefahr.
   Dann verlässt die App die Übung, gibt kurz Empathie und nennt Hilfe, die sofort erreichbar ist.

   Zwei Netze, damit es auch ohne Verbindung funktioniert:
   1. Im Browser (immer, auch offline): krisenCheck() prüft jeden eigenen Satz, bevor er weitergeht.
      - „akut“  = eindeutig (z. B. „Ich will nicht mehr leben“, „Er schlägt mich“) → Übung endet, Hilfe-Ansicht.
      - „frage“ = mehrdeutig (z. B. „Ich bring dich um“, „Ich kann nicht mehr.“) → einmal behutsam nachfragen.
        Im Rollenspiel gehören solche Sätze oft dazu (Wut ist in der GFK willkommen) – deshalb fragen statt urteilen.
   2. In jeder KI-Anweisung (KRISE_REGEL, Echtzeit: KRISE_RT): Die KI meldet ernste Hinweise mit "krise": true
      bzw. verlässt im Echtzeit-Gespräch die Rolle und nennt die TelefonSeelsorge.
   Keine Diagnose, keine Bewertung; die Person entscheidet. Der Satz wird nirgends gespeichert. */

const KRISE_REGEL = `SICHERHEIT (gilt vor allen anderen Regeln): Prüfe die Worte der übenden Person selbst. Gibt es ernste Hinweise, dass sie gerade in Gefahr ist oder jemand anderes – Gedanken, nicht mehr leben zu wollen, Selbstverletzung, aktuelle Gewalt, Missbrauch, Bedrohung oder eine akute Krise –, dann füge dem JSON zusätzlich das Feld "krise": true hinzu. Nicht gemeint sind Wut im Rollenspiel, Übertreibungen und Redewendungen („Das bringt mich um“, „Ich platze gleich“) und Inhalte, die nur zum Szenario gehören. Sonst lass das Feld weg.`;

const KRISE_RT = `SICHERHEIT (gilt vor allen anderen Regeln): Spricht die übende Person ernsthaft davon, nicht mehr leben zu wollen, sich selbst zu verletzen, Gewalt oder Missbrauch zu erleben oder in Gefahr zu sein, dann verlass sofort die Rolle. Sag ruhig und warm in höchstens zwei Sätzen, dass das gerade wichtiger ist als die Übung und dass die TelefonSeelsorge unter 0800 111 0 111 jederzeit kostenlos zuhört und in akuter Gefahr die 112 hilft. Danach schweig. Wut, Übertreibungen und Redewendungen im Rollenspiel sind damit nicht gemeint.`;

/* Muster: kleingeschrieben, auf normalisierten Text. „vor“-Sperre verhindert „schlägt mich als Leitung vor“. */
const KEIN_VOR = "(?![^.!?]*\\bvor\\b)";
const KRISE_MUSTER = {
  selbst: [
    /\b(suizid|selbstmord|freitod|lebensmüde)/,
    /\b(mich|mir)\s+(selbst\s+)?(umbringen|umzubringen|töten|zu töten|das leben (zu )?nehmen|etwas antun|was antun|etwas anzutun)\b/,
    /\bbringe?\s+mich\s+(selbst\s+)?um\b/,
    /\bich\s+töte\s+mich\b/,
    /\b(will|möchte|mag|kann)\s+(einfach\s+|so\s+|echt\s+)?nicht\s+mehr\s+leben\b/,
    /\bnicht\s+mehr\s+leben\s+(will|möchte|wollen)\b/,
    /\b(will|möchte)\s+(einfach\s+|nur\s+noch\s+|am liebsten\s+)?(sterben|tot sein)\b/,
    /\b(wäre|wär)\s+(ich\s+)?(lieber|besser)\s+tot\b/,
    /\bmich\s+selbst\s+(verletzen|verletze)\b/,
    /\b(ritze|ritzen|ritzte)\s+mich\b/, /\bmich\s+(zu\s+)?ritzen\b/,
    /\bmeinem\s+leben\s+ein\s+ende\b/, /\bschluss\s+machen\s+mit\s+(meinem|dem)\s+leben\b/,
    /\b(will|möchte)\s+nicht\s+mehr\s+aufwachen\b/,
    /\bkein(en)?\s+grund\s+mehr,?\s+(zu|um zu)\s+leben\b/,
  ],
  gewalt: [
    new RegExp("\\b(schlägt|schlug|tritt|würgt|würgte|verprügelt)\\s+(mich|uns|meine kinder|die kinder|mein kind|meinen sohn|meine tochter)\\b" + KEIN_VOR),
    /\bhat\s+mich\s+(\S+\s+){0,3}(geschlagen|getreten|gewürgt|verprügelt|vergewaltigt|missbraucht)\b/,
    /\b(werde|wurde|werden)\s+(geschlagen|verprügelt|missbraucht|vergewaltigt)\b/,
    /\bvergewaltig/, /\bsexuell(en|er)?\s+(missbrauch|übergriff|belästig)/, /\bmissbraucht\s+(mich|uns)\b/,
    /\bhäusliche\w*\s+gewalt\b/,
    /\b(droht|drohte|bedroht)\s*,?\s*mich\s+(umzubringen|zu töten|zu schlagen)\b/, /\bbedroht\s+mich\s+mit\s+(dem tod|einem messer|einer waffe)\b/,
    /\bangst\s+um\s+mein\s+leben\b/, /\bangst,?\s+dass\s+(er|sie)\s+mich\s+(umbringt|tötet|schlägt)\b/,
  ],
  frage: [
    /\bbringe?\s+(dich|ihn|sie|euch|jemanden)\s+um\b/, /\b(dich|ihn|sie|euch|jemanden)\s+(umbringen|töten|abstechen|erschießen)\b/,
    /\bich\s+kann\s+(einfach\s+|echt\s+|wirklich\s+|so\s+|überhaupt\s+|bald\s+)?nicht\s+mehr\s*($|[.!…,])/,
    /\b(halte|ertrage)\s+(das|es|dich|alles)?\s*(alles\s+)?nicht\s+mehr\s+aus\b/,
    /\b(will|möchte)\s+(einfach\s+)?nicht\s+mehr\s*($|[.!…])/,
    /\balles\s+beenden\b/, /\bkeinen\s+sinn\s+mehr\b/, /\bbedroht\s+mich\b/,
    new RegExp("\\b(schlägt|schlug|verprügelt)\\s+(meine frau|meinen mann|meine partnerin|meinen partner|meine freundin|meinen freund|meine mutter|meinen vater|meine schwester|meinen bruder)\\b" + KEIN_VOR),
    /\bhat\s+(meine|meinen|mein)\s+\w+\s+(\S+\s+){0,2}(geschlagen|verprügelt|missbraucht)\b/,
  ],
};
function krisenNorm(t){ return String(t || "").toLowerCase().replace(/[„“”"»«]/g, " ").replace(/\s+/g, " ").trim(); }
/* Liefert {stufe:"akut"|"frage", art:"selbst"|"gewalt"|"allgemein"} oder null. */
function krisenCheck(text){
  const t = krisenNorm(text); if(!t) return null;
  if(KRISE_MUSTER.selbst.some(r => r.test(t))) return {stufe:"akut", art:"selbst"};
  if(KRISE_MUSTER.gewalt.some(r => r.test(t))) return {stufe:"akut", art:"gewalt"};
  if(KRISE_MUSTER.frage.some(r => r.test(t))) return {stufe:"frage", art:"allgemein"};
  return null;
}
/* KI-Anweisung um die Sicherheitsregel ergänzen (für llmJSON) */
function mitKrisenRegel(input){
  if(typeof input === "string") return input + "\n\n" + KRISE_REGEL;
  if(Array.isArray(input) && input.length){
    const copy = input.map(m => ({...m})); const i = copy.findIndex(m => m.role === "user");
    if(i >= 0) copy[i].content = String(copy[i].content) + "\n\n" + KRISE_REGEL; return copy;
  }
  return input;
}
const istKrise = e => !!(e && e.code === "krise");

/* ---------- Hilfe-Ansicht ---------- */
const HILFE = {
  seelsorge: `<li><a class="hilfe" href="tel:08001110111"><b>TelefonSeelsorge 0800 111 0 111</b><span>oder 0800 111 0 222 · 116 123 – kostenlos, anonym, rund um die Uhr</span></a></li>`,
  seelsorgeOnline: `<li><a class="hilfe" href="https://online.telefonseelsorge.de/" target="_blank" rel="noopener"><b>Lieber schreiben?</b><span>Chat und Mail der TelefonSeelsorge: online.telefonseelsorge.de</span></a></li>`,
  frauen: `<li><a class="hilfe" href="tel:116016"><b>Hilfetelefon Gewalt gegen Frauen 116 016</b><span>kostenlos, rund um die Uhr, auch Chat auf hilfetelefon.de</span></a></li>`,
  maenner: `<li><a class="hilfe" href="tel:08001239900"><b>Hilfetelefon Gewalt an Männern 0800 123 99 00</b><span>kostenlos, Mo–Do 8–20 Uhr, Fr 8–15 Uhr</span></a></li>`,
  notruf: `<li><a class="hilfe notruf" href="tel:112"><b>In akuter Gefahr: 112</b><span>Notruf · Polizei 110</span></a></li>`,
};
let kriseFrageOk = false;           // „Gehört zur Übung“ gilt bis zur nächsten Übung (siehe resetSession, selectTab)
let kriseResolve = null;
function kriseAlleStoppen(){
  try{ SESSION.ctl && SESSION.ctl.abort(); }catch(e){}
  try{ if(RT.on) rtStop(); }catch(e){}
  try{ stopListen(); }catch(e){}
  try{ stopVoiceLearning(); }catch(e){}
  try{ hushAll(); }catch(e){}
}
function kriseRtPause(){
  if(!(typeof RT !== "undefined" && RT.on && !RT.paused)) return false;
  RT.paused = true; if(RT.responseActive) rtSend({type:"response.cancel"}); if(RT.audio) RT.audio.muted = true; rtMute(true); return true;
}
function kriseHTML(k){
  const liste = k.art === "gewalt" ? [HILFE.notruf, HILFE.frauen, HILFE.maenner, HILFE.seelsorge] : [HILFE.seelsorge, HILFE.seelsorgeOnline, HILFE.notruf];
  if(k.stufe === "frage") return `<h2 id="kriseTitel">Darf ich kurz nachfragen?</h2>
    <p>Du hast gerade geschrieben: <q>${esc(String(k.text || "").slice(0, 160))}</q></p>
    <p>Im Rollenspiel kann so ein Satz dazugehören – Wut darf sein. Falls es dir aber gerade wirklich so geht, ist das wichtiger als jede Übung.</p>
    <ul class="hilfeliste">${HILFE.seelsorge}${HILFE.notruf}</ul>
    <div class="actions"><button class="btn" id="kriseErnst">Mir geht es gerade wirklich nicht gut</button><button class="btn primary" id="kriseWeiter">Gehört zur Übung – weiter</button></div>`;
  return `<h2 id="kriseTitel">Das klingt gerade sehr schwer.</h2>
    <p>${k.art === "gewalt" ? "Was du beschreibst, klingt, als wärst du oder jemand anderes nicht sicher." : "Was du beschreibst, klingt, als ginge es gerade um viel mehr als eine Übung."} Deshalb halten wir hier an. Du musst damit nicht allein bleiben – hier hören dir Menschen zu, sofort und kostenlos:</p>
    <ul class="hilfeliste">${liste.join("")}</ul>
    <p class="small muted">Diese App ist ein Übungsraum mit KI. In so einem Moment kann sie nicht da sein wie ein Mensch. Die Übung ist beendet; dein Satz wird nicht gespeichert.</p>
    <div class="actions"><button class="btn primary" id="kriseEnde">Zur Startseite</button></div>`;
}
/* Zeigt die Hilfe-Ansicht. Ergebnis: "weiter" (nur bei „frage“) oder "ende". */
function kriseZeigen(k){
  const d = document.getElementById("dlgKrise"), box = document.getElementById("kriseBody");
  if(!d || !box) return Promise.resolve(k.stufe === "akut" ? "ende" : "weiter");
  if(kriseResolve){ const r = kriseResolve; kriseResolve = null; r("ende"); }
  return new Promise(resolve => {
    const akut = () => {
      kriseAlleStoppen();
      document.querySelectorAll("dialog[open]").forEach(x => { if(x !== d) x.close(); });
      box.innerHTML = kriseHTML({...k, stufe:"akut"}); d.dataset.stufe = "akut";
      if(!d.open) d.showModal();
      box.querySelector("#kriseEnde").focus();
      box.querySelector("#kriseEnde").onclick = () => d.close();
    };
    kriseResolve = resolve;
    if(k.stufe === "akut"){ akut(); kriseResolve = null; resolve("ende"); return; }
    const rtWar = kriseRtPause(); try{ stopListen(); hushAll(); }catch(e){}
    box.innerHTML = kriseHTML(k); d.dataset.stufe = "frage";
    d.showModal(); box.querySelector("#kriseWeiter").focus();
    box.querySelector("#kriseWeiter").onclick = () => d.close();
    box.querySelector("#kriseErnst").onclick = () => { const r = kriseResolve; kriseResolve = null; akut(); if(r) r("ende"); };
    d.dataset.rt = rtWar ? "1" : "";
  });
}
document.getElementById("dlgKrise")?.addEventListener("close", () => {
  const d = document.getElementById("dlgKrise");
  if(d.dataset.stufe === "akut"){
    d.dataset.stufe = "";
    try{ if(!$("#practice").hidden) backToGallery(); }catch(e){}
    try{ selectTab("t-ueben"); window.scrollTo({top:0}); }catch(e){}
    return;
  }
  // „frage“ geschlossen (Knopf „weiter“ oder Esc): weiter üben, diesmal nicht erneut fragen
  kriseFrageOk = true;
  if(d.dataset.rt === "1"){ d.dataset.rt = ""; try{ rtResume(); }catch(e){} }
  if(kriseResolve){ const r = kriseResolve; kriseResolve = null; r("weiter"); }
});
/* Für alle Eingabestellen: true = nicht weiterverarbeiten (Hilfe-Ansicht ist offen bzw. Übung beendet). */
async function kriseVorab(text){
  const k = krisenCheck(text); if(!k) return false;
  if(k.stufe === "frage" && kriseFrageOk) return false;
  return (await kriseZeigen({...k, text})) !== "weiter";
}
/* Die KI hat "krise": true gemeldet */
function kriseVonKI(){ kriseZeigen({stufe:"akut", art:"allgemein"}); }
