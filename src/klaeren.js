/* ===================== Klären – „Erzähl mal“ (Weg A, K1 Schreiben, v6.8 · Tiefe v6.9) =====================
   Worum geht es? Bisher übt man in der App immer selbst. Hier ist es umgekehrt: Du erzählst,
   was dich beschäftigt, und der Coach hört empathisch zu. Er gibt wieder, was angekommen ist,
   und vermutet als Frage, was du fühlst und was dir wichtig ist. Du entscheidest, ob es passt.
   Grundlage: Konzept „Gemeinsam klären“ (Abschnitte 2, 3, 6, 9) und GFK-Wissensbasis §6–§7.

   Haltung (GFK-Coach): Empathie vor Bildung, Vermutung als Frage, keine Ratschläge, kein Trost,
   keine Urteile über die abwesende Person, Wut ist willkommen. Ruhiger Bereich: keine Feiern, keine Zahlen.
   Daten: nur im Arbeitsspeicher, nichts wird gespeichert. Krisenpfad: kriseVorab + llmJSON (krise.js).
   Eingabeart: Schreiben. Sprechen und Echtzeit folgen nach dem Stimmen-Testlabor (E-26). */

const KL = {phase:"home", turns:[], first:"", conf:{g:[], b:[]}, last:null, nein:0, rejected:{g:[], b:[]}, bitte:"", wichtig:"", busy:false, angekommen:false, gespuert:false};
const KL_TEIL = []; // ausgewählte Wörter bei „Teilweise“

function klReset(){
  Object.assign(KL, {phase:"home", turns:[], first:"", conf:{g:[], b:[]}, last:null, nein:0, rejected:{g:[], b:[]}, bitte:"", wichtig:"", busy:false, gespuert:false});
  KL_TEIL.length = 0;
}
function klHome(){
  $("#klHome").hidden = false; $("#klRun").hidden = true; KL.phase = "home";
}
function klStart(){
  klReset(); KL.phase = "erzaehlen";
  $("#klHome").hidden = true; $("#klRun").hidden = false;
  $("#klRun").innerHTML = `
    <div class="row klbar"><button class="btn ghost" data-kl="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Klären</button><span class="grow"></span><button class="btn" data-kl="stopp">Aufhören</button></div>
    <div class="klhead"><p class="hand">Allein</p><h1 id="klTitel" tabindex="-1">Erzähl mal</h1></div>
    ${KL.angekommen ? "" : `<p class="notice klankommen">Hier hört dir eine KI zu. Sie kann dir helfen zu sortieren, was in dir los ist – einen Menschen ersetzt sie nicht. Bitte keine echten Nachnamen. Die Hilfenummern stehen ganz unten.</p>`}
    <div class="seg klart" role="radiogroup" aria-label="Wie möchtest du erzählen?"><button role="radio" aria-checked="true">Schreiben</button><button role="radio" aria-checked="false" aria-disabled="true" disabled>Sprechen · bald</button><button role="radio" aria-checked="false" aria-disabled="true" disabled>Echtzeit · bald</button></div>
    <div class="kllog" id="klLog" aria-live="polite"></div>
    <div class="klantwort" id="klAntwort" hidden></div>
    <div class="klcomposer" id="klComposer">
      <p class="small muted" id="klHilfe">Zwei Fragen als Hilfe, in beliebiger Reihenfolge: <b>Wie geht es dir gerade?</b> und <b>Was ist passiert – so, wie du es erlebt hast?</b> Du darfst auch einfach losschreiben.</p>
      <div class="inputrow"><label class="sr" for="klIn">Was du erzählen möchtest</label><textarea id="klIn" rows="3" placeholder="Schreib, was dich beschäftigt …"></textarea><button class="btn primary sendbtn" data-kl="senden" aria-label="Senden"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>
      <div class="row"><button class="linkbtn" data-kl="karten" aria-expanded="false" aria-controls="klKarten">Gefühlskarten – wenn dir die Worte fehlen</button><span class="grow"></span><button class="linkbtn" data-kl="weiter" id="klWeiterLink" hidden>Wie weiter?</button></div>
      <div class="klkarten" id="klKarten" hidden></div>
      <p class="note" id="klNote" role="status"></p>
    </div>
    <div id="klEnde" hidden></div>`;
  KL.angekommen = true;
  refocus("#klIn");
}

/* ---------- Gefühlskarten (aus den Lernkarten) ---------- */
function klKartenHTML(){
  const grp = (list, warm) => list.map(g => `<details${warm ? "" : " open"}><summary>${esc(g.gruppe)}</summary><div class="row">${g.woerter.map(x => `<button class="chip" data-klwort="${esc(x.w)}" title="${esc(x.k)}">${esc(x.w)}</button>`).join("")}</div></details>`).join("");
  return `<p class="small muted">Tipp eines oder mehrere an – sie landen in deinem Text.</p>${grp(LK.gefuehle.unerfuellt, false)}${grp(LK.gefuehle.erfuellt, true)}`;
}
function klKartenAuf(on){
  const k = $("#klKarten"), b = $('[data-kl="karten"]'); if(!k) return;
  if(on && !k.innerHTML) k.innerHTML = klKartenHTML();
  k.hidden = !on; if(b) b.setAttribute("aria-expanded", on);
}
function klWortEinfuegen(w){
  const t = $("#klIn"); const v = t.value.trim();
  t.value = v ? (/[,.!?…]$/.test(v) ? v + " " + w : v + ", " + w) : "Ich bin " + w;
  t.focus();
}

/* ---------- Verlauf ---------- */
function klMsg(who, text, cls){
  const el = document.createElement("div"); el.className = "msg " + cls;
  el.innerHTML = `<span class="who">${esc(who)}</span><div class="bubble">${esc(text)}</div>`;
  $("#klLog").append(el); el.scrollIntoView({block:"nearest", behavior:"smooth"}); return el;
}

/* ---------- Coach: empathisch spiegeln ---------- */
/* v6.9: Der Coach bleibt länger beim Zuhören und geht in die Tiefe: Nach einem „Ja“ fasst er nicht zusammen,
   sondern hört eine Schicht tiefer (was unter dem Ärger liegt, was im Bedürfnis steckt, die Sehnsucht).
   Er wechselt die Formulierungen, gibt manchmal nur wieder (ohne Frage) und spürt erst nach,
   wenn erkennbar Entspannung kommt (GFK-Wissensbasis §6: „Wann ist genug Empathie gegeben?“). */
const KL_RUNDE = () => KL.turns.filter(t => t.role === "user").length;
function klPrompt(){
  const verlauf = KL.turns.map(t => (t.role === "user" ? "PERSON: " : "COACH: ") + t.content).join("\n");
  return `Du hörst einer Person empathisch zu – nach Marshall B. Rosenberg (Gewaltfreie Kommunikation). Sie erzählt von sich. Du bist kein Rollenspiel-Gegenüber und kein Lehrer. Es geht nur darum, dass sie sich wirklich gehört fühlt – so lange, bis spürbar Entspannung kommt. Erst Verbindung, keine Lösung.

SO HÖRST DU ZU
- 2–3 kurze Sätze, du-Form, warme Alltagssprache. Nimm die Worte der Person auf („immer ich“, „schon wieder“).
- Gib zuerst in eigenen Worten wieder, was du hörst – ohne Urteil. Dann höchstens EINE Vermutung zu dem, was in ihr lebendig ist und was ihr wichtig ist. Die Person entscheidet, ob es passt.
- Etwa jede zweite oder dritte Antwort darf ganz ohne Frage sein: nur wiedergeben, Raum lassen („Erzähl gern weiter, wenn da noch mehr ist.“). Dann lass "vermutung" leer.

ABWECHSELN – keine Formel
- Wechsle die Form der Vermutung. Nie zweimal hintereinander dieselbe. „Bist du …, weil dir … wichtig ist?“ höchstens einmal im ganzen Gespräch.
- Mögliche Formen: „Klingt, als wärst du ziemlich …“ · „Kann es sein, dass …?“ · „Ich frage mich, ob …“ · „Sehnst du dich nach …?“ · „Hättest du gern, dass …?“ · „Wünschst du dir …?“ · „Ist da vielleicht auch …?“ · „… – stimmt das?“

IN DIE TIEFE (besonders nach einem „Ja“)
- Nach einer Bestätigung nicht zusammenfassen und nicht abschließen. Bleib beim Bestätigten und hör eine Schicht tiefer, zum Beispiel:
  - Was liegt unter dem Ärger? Oft Erschöpfung, Traurigkeit, Enttäuschung, Einsamkeit, Sorge.
  - Was steckt im Bedürfnis? Hinter „Gerechtigkeit“ zum Beispiel: gesehen werden mit dem, was man alles trägt; Wertschätzung; Gegenseitigkeit.
  - Die Sehnsucht: Wie schön es wäre, wenn es erfüllt wäre („…, wenn auch mal jemand anderes sagt: Ich mach das.“).
  - Dass es nicht zum ersten Mal so ist – ohne Analyse.
- Nimm neue Dinge, die die Person erzählt, ernst und verbinde sie mit dem schon Gehörten.

NICHT
- Keine Ratschläge („du solltest“, „versuch mal“), kein Trost („Kopf hoch“, „wird schon“), keine eigene Geschichte, kein Ausfragen nach Fakten, keine Erklärungen, keine Lösungen.
- Kein Urteil über die abwesende Person und keine Verteidigung („Vielleicht meinte er es nicht so“). Hör die Bedürfnisse hinter Urteilen. Wörter wie „nie“ oder „immer“ nicht korrigieren.
- Wut ist willkommen. Bitte nie darum, netter zu formulieren.
- Nicht über die Methode reden: kein „Es ist angekommen, dass dir … wichtig ist“, keine Wörter wie „Gefühl“, „Bedürfnis“, „Empathie“, „GFK“.
- Keine Diagnosen, keine Therapiesprache, nichts über Stimme, Tonfall oder Weinen.
- Hat die Person zweimal „Nicht ganz“ gesagt: offene Frage („Was trifft es eher?“) statt neuer Vermutung.

NACHSPÜREN – erst, wenn Entspannung erkennbar ist
- Zeichen: Antworten werden kürzer oder weicher, „genau, das ist es“, Erleichterung, Seufzen, die Person fragt nach Lösungen oder sagt, dass es gut tut. Frühestens ab Runde 4, außer die Person sagt es selbst.
- Dann setze "phase" auf "nachspueren" und frag (abwechseln, nicht wörtlich wiederholen): „Wie ist es für dich, das so zu hören?“ · „Wie geht es dir jetzt, wo es ausgesprochen ist?“ · „Ist da noch mehr – oder fühlt es sich gerade rund an?“ · „Magst du noch bei etwas bleiben, oder ist es für den Moment gut so?“
- Erzählt die Person danach weiter, hör weiter zu. Nicht drängen.

SO KANN ES KLINGEN (Beispiel, nicht kopieren)
PERSON: Mein Bruder hat schon wieder abgesagt. Auf den kann man sich echt nie verlassen.
COACH: Wieder eine Absage – und du bist richtig sauer. Hättest du dich gern auf ihn verlassen können?
PERSON: Ja, genau.
COACH: Gerade bei ihm. Ich frage mich, ob unter dem Ärger auch etwas Trauriges liegt – vermisst du ihn vielleicht?
PERSON: Ja … wir sehen uns kaum noch.
COACH: Ihr seht euch kaum noch. Da fehlt dir die Nähe, so wie es früher vielleicht mal war.
PERSON: Früher waren wir jedes Wochenende zusammen.
COACH: Jedes Wochenende … und jetzt so selten. Das klingt nach Sehnsucht nach euch beiden. Wie ist es für dich, das so auszusprechen?

STAND: Runde ${KL_RUNDE()}. Schon bestätigt – lebendig: ${KL.conf.g.join(", ") || "noch nichts"}; wichtig: ${KL.conf.b.join(", ") || "noch nichts"}. Nicht gepasst: ${[...KL.rejected.g, ...KL.rejected.b].join(", ") || "–"}.
VERLAUF:
${verlauf}

Antworte NUR mit JSON: {"spiegel":"1–2 Sätze: wiedergeben, was du hörst","vermutung":{"gefuehle":["0–2 Wörter"],"beduerfnisse":["0–2 Wörter"]},"frage":"1 Satz oder leer","phase":"vertiefen|nachspueren"}`;
}

/* ---------- Ohne Verbindung: Wortabgleich, mit Tiefe und wechselnden Formen ---------- */
const KL_AERGER = ["ärgerlich", "wütend", "verärgert", "genervt", "gereizt", "frustriert", "sauer", "irritiert"];
const KL_DARUNTER = ["erschöpft", "traurig", "enttäuscht", "einsam", "müde"];
const KL_TIEFER = {"Gerechtigkeit":"Wertschätzung", "Fairness":"Wertschätzung", "Entlastung":"Unterstützung", "Verlässlichkeit":"Vertrauen", "Respekt":"Wertschätzung",
  "Ruhe":"Erholung", "Erholung":"Leichtigkeit", "Unterstützung":"gesehen werden", "Verständnis":"Verbindung", "Anerkennung":"gesehen werden", "Nähe":"Verbindung", "Einbezogensein":"Zugehörigkeit"};
const KL_FORM = [
  (g, b) => g && b ? `Klingt, als wärst du ziemlich ${g} – hättest du gern mehr ${b}?` : g ? `Klingt, als wärst du ziemlich ${g}?` : `Hättest du gern mehr ${b}?`,
  (g, b) => g && b ? `Kann es sein, dass du ${g} bist und dir ${b} fehlt?` : g ? `Kann es sein, dass du ${g} bist?` : `Kann es sein, dass dir ${b} fehlt?`,
  (g, b) => g && b ? `Ich frage mich, ob du ${g} bist – und dich nach ${b} sehnst?` : g ? `Ich frage mich, ob du auch ${g} bist?` : `Ich frage mich, ob du dich nach ${b} sehnst?`,
  (g, b) => g && b ? `Bist du ${g}, weil dir ${b} wichtig ist?` : g ? `Fühlst du dich ${g}?` : `Ist dir ${b} wichtig?`,
];
const KL_SPUEREN = ["Wie ist es für dich, das so zu hören?", "Wie geht es dir jetzt, wo es ausgesprochen ist?", "Ist da noch mehr – oder fühlt es sich gerade rund an?", "Magst du noch bei etwas bleiben, oder ist es für den Moment gut so?"];
function klFinde(text){
  const low = String(text || "").toLowerCase(), g = [], b = [];
  const add = (arr, w, rej) => { if(w && !arr.includes(w) && !rej.includes(w)) arr.push(w); };
  Object.keys(PSEUDO).forEach(p => { if(low.includes(p)){ const lp = (LK.pseudo || []).find(x => x.w === p);
    (lp ? lp.gefuehle : PSEUDO[p].split(" / ")).forEach(w => add(g, w, KL.rejected.g)); (lp ? lp.beduerfnisse : []).forEach(w => add(b, w, KL.rejected.b)); } });
  EMP_SYN.forEach(([keys, ws]) => { if(keys.some(k => startsWord(low, k))) ws.forEach(w => /^[A-ZÄÖÜ]/.test(w) ? add(b, w, KL.rejected.b) : add(g, w, KL.rejected.g)); });
  if(/\b(immer ich|schon wieder ich|immer muss ich|nur ich)\b/.test(low)){ add(g, "genervt", KL.rejected.g); add(b, "Gerechtigkeit", KL.rejected.b); add(b, "Entlastung", KL.rejected.b); }
  [...LK.gefuehle.unerfuellt, ...LK.gefuehle.erfuellt].forEach(gr => gr.woerter.forEach(x => { if(stemHit(low, x.w)) add(g, x.w, KL.rejected.g); }));
  LK.beduerfnisse.forEach(br => br.woerter.forEach(x => { if(x.w.length >= 5 && stemHit(low, x.w)) add(b, x.w, KL.rejected.b); }));
  return {g: g.filter(w => !KL.conf.g.includes(w)), b: b.filter(w => !KL.conf.b.includes(w))};
}
const KL_NOMEN = {erschöpft:"Erschöpfung", traurig:"Traurigkeit", enttäuscht:"Enttäuschung", einsam:"Einsamkeit", müde:"Müdigkeit"};
const KL_DA = ["Und das nicht zum ersten Mal.", "Das kennst du schon.", "Das sitzt.", "Da kommt einiges zusammen."];
function klTiefer(spiegel){
  const aerger = KL.conf.g.some(w => KL_AERGER.includes(w.toLowerCase()));
  const g2 = aerger ? KL_DARUNTER.find(w => !KL.conf.g.includes(w) && !KL.rejected.g.includes(w)) : "";
  const b2 = KL.conf.b.map(w => KL_TIEFER[w]).find(w => w && !KL.conf.b.includes(w) && !KL.rejected.b.includes(w)) || "";
  if(!g2 && !b2) return null;
  const n = KL_NOMEN[g2] || g2;
  return {spiegel, vermutung:{gefuehle:g2 ? [g2] : [], beduerfnisse:b2 ? [b2] : []}, phase:"vertiefen",
    frage: g2 && b2 ? `Ist unter dem Ärger vielleicht auch ${n} – und wünschst du dir ${b2}?` : g2 ? `Ist unter dem Ärger vielleicht auch ${n}?` : `Wünschst du dir auch ${b2} – dass jemand sieht, was du alles trägst?`};
}
function klOffline(letzte){
  const runde = KL_RUNDE(), form = KL_FORM[runde % KL_FORM.length], da = KL_DA[runde % KL_DA.length];
  const antwort = /^(ja|zum teil|nicht ganz|da ist noch mehr)\b/i.test(letzte), ja = /^(ja|zum teil)\b/i.test(letzte);
  const alles = KL.turns.filter(x => x.role === "user").map(x => x.content).join(" ");
  const kurz = s => s.length > 110 ? s.slice(0, 100).replace(/\s+\S*$/, "") + " …" : s;
  // Nachspüren erst nach einem „Ja“, mehreren Bestätigungen und frühestens ab Runde 4
  if(ja && runde >= 4 && KL.conf.g.length + KL.conf.b.length >= 3 && !KL.gespuert){ KL.gespuert = true;
    return {spiegel: `${joinDe(KL.conf.b.slice(-2)) || "Das"} – das ist dir richtig wichtig.`, vermutung:{gefuehle:[], beduerfnisse:[]}, frage: KL_SPUEREN[runde % KL_SPUEREN.length], phase:"nachspueren"}; }
  // Nach einem „Ja“ tiefer hören: unter dem Ärger, im Bedürfnis
  if(ja && (KL.conf.g.length || KL.conf.b.length)) return klTiefer(da) || {spiegel: "Erzähl gern weiter, wenn da noch mehr ist.", vermutung:{gefuehle:[], beduerfnisse:[]}, frage:"", phase:"vertiefen", offen:true};
  const f = klFinde(antwort ? alles : letzte), gg = f.g[0] || "", bb = f.b[0] || "";
  const spiegel = runde <= 1 ? `Ich höre: „${kurz(alles)}“`
    : /^nicht ganz/i.test(letzte) ? "Danke – dann hab ich es noch nicht richtig getroffen."
    : antwort ? "Danke, dass du das so genau sagst." : `„${kurz(letzte)}“ – das kommt noch obendrauf.`;
  if(KL.nein < 2 && !gg && !bb && !antwort){ const t = klTiefer(spiegel); if(t) return t; }
  if(KL.nein >= 2 || (!gg && !bb)) return {spiegel, vermutung:{gefuehle:[], beduerfnisse:[]}, frage: "Was trifft es eher – wie geht es dir, wenn du daran denkst? Die Gefühlskarten können helfen, ein Wort zu finden.", phase:"vertiefen", offen:true};
  return {spiegel, vermutung:{gefuehle: gg ? [gg] : [], beduerfnisse: bb ? [bb] : []}, frage: form(gg, bb), phase:"vertiefen"};
}
async function klCoach(){
  KL.busy = true; const t = klMsg("Coach", "Der Coach hört zu …", "them klwait"); t.setAttribute("aria-busy", "true");
  let r = null;
  if(liveOn()){
    try{ r = await llmJSON(klPrompt(), {tier:"quick"}); }
    catch(e){ t.remove(); KL.busy = false; if(istKrise(e)) return; if(e && e.code === "access") askAccess(); r = null; }
  }
  if(t.isConnected) t.remove();
  const letzte = (KL.turns.filter(x => x.role === "user").slice(-1)[0] || {}).content || "";
  if(!r || (!r.spiegel && !r.frage)) r = klOffline(letzte);
  const v = r.vermutung || {}, g = (v.gefuehle || []).filter(Boolean).slice(0, 2), b = (v.beduerfnisse || []).filter(Boolean).slice(0, 2);
  const spueren = r.phase === "nachspueren" || r.genug_signal === true;
  KL.last = {g, b, spueren, offen: !spueren && (!!r.offen || !(g.length || b.length) || !String(r.frage || "").trim())};
  const text = [r.spiegel, r.frage].filter(x => String(x || "").trim()).join(" ");
  klMsg("Coach", text, "them"); KL.turns.push({role:"assistant", content:text});
  KL.busy = false;
  $("#klWeiterLink").hidden = false;
  klAntwortZeigen();
}
/* Antwortmöglichkeiten unter der Coach-Antwort. Weitererzählen geht immer über das Textfeld. */
function klAntwortZeigen(){
  const box = $("#klAntwort"); KL_TEIL.length = 0;
  if(KL.last.spueren){
    box.hidden = false;
    box.innerHTML = `<div class="row klpasst" role="group" aria-label="Wie möchtest du weitermachen?"><button class="btn" data-klant="mehr">Da ist noch mehr</button><button class="btn" data-klant="rund">Für jetzt ist es gut</button></div>
      <p class="small muted">Oder schreib einfach, wie es dir gerade damit geht.</p>`;
    $("#klIn").placeholder = "Wie geht es dir jetzt? …";
    return refocus('[data-klant="mehr"]');
  }
  if(KL.last.offen){ box.hidden = true; $("#klIn").placeholder = "Erzähl gern weiter …"; if(KL.nein >= 2) klKartenAuf(true); return refocus("#klIn"); }
  box.hidden = false;
  box.innerHTML = `<p class="lbl" id="klPasstLbl">Trifft es das?</p>
    <div class="row klpasst" role="group" aria-labelledby="klPasstLbl"><button class="btn" data-klant="ja">● Ja, genau</button><button class="btn" data-klant="teil">◐ Zum Teil</button><button class="btn" data-klant="nein">○ Nicht ganz</button></div>
    <div id="klTeil" hidden></div>
    <p class="small muted">Oder erzähl einfach weiter – in deinen Worten.</p>`;
  $("#klIn").placeholder = "Ergänzen oder weitererzählen …";
  refocus('[data-klant="ja"]');
}
function klBestaetigen(g, b){ g.forEach(w => { if(!KL.conf.g.includes(w)) KL.conf.g.push(w); }); b.forEach(w => { if(!KL.conf.b.includes(w)) KL.conf.b.push(w); }); }
async function klAntwort(art){
  if(KL.busy) return;
  if(art === "rund") return klWieWeiter(true);
  const extra = $("#klIn").value.trim(), L = KL.last || {g:[], b:[]};
  if(art === "teil" && !$("#klTeil").dataset.offen){
    const words = [...L.g, ...L.b];
    $("#klTeil").dataset.offen = "1"; $("#klTeil").hidden = false;
    $("#klTeil").innerHTML = `<p class="small" id="klTeilLbl">Was davon passt?</p><div class="row" role="group" aria-labelledby="klTeilLbl">${words.map(w => `<button class="chip" aria-pressed="false" data-klteil="${esc(w)}">${esc(w)}</button>`).join("")}</div><div class="row"><button class="btn primary small" data-klant="teil">Weiter</button></div>`;
    refocus("#klTeil [data-klteil]"); return;
  }
  if(extra && await kriseVorab(extra)) return;
  let say = art === "ja" ? "Ja, genau." : art === "nein" ? "Nicht ganz." : art === "mehr" ? "Da ist noch mehr." : "Zum Teil.";
  if(art === "ja"){ klBestaetigen(L.g, L.b); KL.nein = 0; }
  if(art === "teil"){ const sel = [...KL_TEIL]; klBestaetigen(L.g.filter(w => sel.includes(w)), L.b.filter(w => sel.includes(w)));
    L.g.filter(w => !sel.includes(w)).forEach(w => KL.rejected.g.push(w)); L.b.filter(w => !sel.includes(w)).forEach(w => KL.rejected.b.push(w));
    say = sel.length ? `Zum Teil – vor allem ${joinDe(sel)}.` : "Zum Teil."; KL.nein = 0; }
  if(art === "nein"){ KL.nein++; KL.rejected.g.push(...L.g); KL.rejected.b.push(...L.b); }
  if(art === "mehr") KL.gespuert = false;
  if(extra) say += " " + extra;
  $("#klIn").value = ""; $("#klAntwort").hidden = true; $("#klAntwort").innerHTML = "";
  klMsg("Du", say, "me"); KL.turns.push({role:"user", content:say});
  await klCoach();
}
async function klSenden(){
  if(KL.busy) return;
  const text = $("#klIn").value.trim(); if(!text) { $("#klNote").textContent = "Schreib ein paar Worte – oder tipp eine Gefühlskarte an."; return; }
  $("#klNote").textContent = "";
  if(await kriseVorab(text)) return;
  if(!KL.first){ KL.first = text; const h = $("#klHilfe"); if(h) h.hidden = true; }   // Hilfsfragen nur am Anfang
  if(KL.last && !KL.last.offen && !$("#klAntwort").hidden){ /* weitererzählt statt geantwortet: Vermutung bleibt offen */ }
  $("#klIn").value = ""; $("#klAntwort").hidden = true; klKartenAuf(false);
  klMsg("Du", text, "me"); KL.turns.push({role:"user", content:text});
  await klCoach();
}

/* ---------- Wie weiter? ---------- */
function klWieWeiter(vomCoach){
  KL.phase = "weiter"; $("#klAntwort").hidden = true;
  const box = $("#klEnde"); box.hidden = false;
  box.innerHTML = `<div class="card stack klweiter" tabindex="-1" id="klWeiterBox">
    <h2 class="klh2">${vomCoach ? "Wie möchtest du es für heute abrunden?" : "Wie möchtest du weitergehen?"}</h2>
    <p class="small muted">Nichts davon ist Pflicht.</p>
    <div class="klwahl">
      <button class="btn primary" data-kl="stehen">So stehen lassen</button>
      <button class="btn" data-kl="bitte">Eine Bitte an mich selbst</button>
      <button class="btn" data-kl="vorbereiten">Gespräch vorbereiten</button>
      <button class="btn ghost" data-kl="mehr">Noch etwas erzählen</button>
    </div>
    <div id="klBitteBox" hidden><label for="klBitte" class="lbl">Worum möchtest du dich selbst bitten?</label><textarea id="klBitte" rows="2" placeholder="z. B. Heute Abend gönne ich mir eine Stunde nur für mich."></textarea><div class="row"><button class="btn primary small" data-kl="bitteok">Mitnehmen</button></div></div>
    <p class="small muted">Gespräch zu zweit kommt später dazu.</p></div>`;
  refocus("#klWeiterBox");
}
function klZusammenfassung(){
  KL.phase = "ende";
  const g = KL.conf.g, b = KL.conf.b;
  $("#klComposer").hidden = true;
  $("#klEnde").innerHTML = `<div class="card stack klsumme" tabindex="-1" id="klSumme">
    <h2 class="klh2">Was du heute über dich gehört hast</h2>
    ${g.length || b.length ? `${g.length ? `<p><span class="xs muted">Was in dir lebendig war</span><br>${esc(joinDe(g))}</p>` : ""}${b.length ? `<p><span class="xs muted">Was dir wichtig ist</span><br>${esc(joinDe(b))}</p>` : ""}`
      : `<p>Du hast erzählt, was dich beschäftigt. Manchmal ist das schon viel – auch ohne passende Worte für Gefühle und Bedürfnisse.</p>`}
    ${b.length ? `<div class="field"><span class="lbl" id="klWiLbl">Was davon ist dir gerade am wichtigsten?</span><div class="row" role="group" aria-labelledby="klWiLbl">${b.map(w => `<button class="chip" aria-pressed="${KL.wichtig === w}" data-klwichtig="${esc(w)}">${esc(w)}</button>`).join("")}</div>
      <p class="quote" id="klSatz" ${KL.wichtig ? "" : "hidden"}>${KL.wichtig ? `Mir ist ${esc(KL.wichtig)} wichtig.` : ""}</p></div>` : ""}
    ${KL.bitte ? `<p><span class="xs muted">Deine Bitte an dich</span><br>${esc(KL.bitte)}</p>` : ""}
    <p class="small muted">Nichts davon wird gespeichert. Mit wem magst du das vielleicht teilen?</p>
    <div class="row"><button class="btn" data-kl="vorbereiten">Gespräch vorbereiten</button><button class="btn primary" data-kl="neu">Fertig</button></div></div>`;
  refocus("#klSumme");
}
function klVorbereiten(){
  const was = (KL.first || "").slice(0, 400), b = KL.conf.b;
  selectTab("t-ueben"); try{ if(!$("#practice").hidden) backToGallery(); }catch(e){}
  openCustom();
  $("#cWhat").value = was;
  if(b.length) $("#cGoal").value = `Sagen, dass mir ${joinDe(b)} wichtig ist – und eine Bitte formulieren.`;
  $("#cWho").focus();
}
function klAufhoeren(){
  KL.phase = "stopp"; KL.busy = false;
  $("#klRun").innerHTML = `<div class="card stack klsumme" tabindex="-1" id="klStopp"><h2 class="klh2">Wie geht es dir jetzt?</h2>
    <div class="row" role="group" aria-label="Wie geht es dir jetzt?"><button class="chip" data-kljetzt="leichter">etwas leichter</button><button class="chip" data-kljetzt="gleich">wie vorher</button><button class="chip" data-kljetzt="schwerer">schwerer</button></div>
    <p id="klJetzt" class="small" role="status"></p>
    <div class="row"><button class="btn primary" data-kl="home">Zur Übersicht</button></div></div>`;
  refocus("#klStopp");
}

/* ---------- Ereignisse ---------- */
$("#p-klaeren").addEventListener("click", e => {
  const k = e.target.closest("[data-kl]")?.dataset.kl;
  const w = e.target.closest("[data-klwort]"); if(w) return klWortEinfuegen(w.dataset.klwort);
  const a = e.target.closest("[data-klant]"); if(a) return klAntwort(a.dataset.klant);
  const t = e.target.closest("[data-klteil]"); if(t){ const on = t.getAttribute("aria-pressed") !== "true"; t.setAttribute("aria-pressed", on);
    const i = KL_TEIL.indexOf(t.dataset.klteil); if(on && i < 0) KL_TEIL.push(t.dataset.klteil); if(!on && i >= 0) KL_TEIL.splice(i, 1); return; }
  const wi = e.target.closest("[data-klwichtig]"); if(wi){ KL.wichtig = wi.dataset.klwichtig; $$("[data-klwichtig]").forEach(x => x.setAttribute("aria-pressed", x === wi)); const s = $("#klSatz"); s.hidden = false; s.textContent = `Mir ist ${KL.wichtig} wichtig.`; return; }
  const j = e.target.closest("[data-kljetzt]"); if(j){ $$("[data-kljetzt]").forEach(x => x.setAttribute("aria-pressed", x === j));
    $("#klJetzt").innerHTML = j.dataset.kljetzt === "schwerer" ? `Danke, dass du das sagst. Wenn es gerade schwer ist, hören dir Menschen zu: <a href="tel:08001110111">TelefonSeelsorge 0800 111 0 111</a>, kostenlos und rund um die Uhr. In akuter Gefahr: <a href="tel:112">112</a>.` : "Danke, dass du dir die Zeit genommen hast."; return; }
  if(!k) return;
  if(k === "start") return klStart();
  if(k === "home"){ klReset(); return klHome(); }
  if(k === "senden") return klSenden();
  if(k === "karten") return klKartenAuf($("#klKarten").hidden);
  if(k === "weiter") return klWieWeiter(false);
  if(k === "stopp") return klAufhoeren();
  if(k === "stehen") return klZusammenfassung();
  if(k === "mehr"){ $("#klEnde").hidden = true; KL.phase = "erzaehlen"; return refocus("#klIn"); }
  if(k === "bitte"){ $("#klBitteBox").hidden = false; return refocus("#klBitte"); }
  if(k === "bitteok"){ const v = $("#klBitte").value.trim(); (v ? kriseVorab(v) : Promise.resolve(false)).then(stop => { if(stop) return; KL.bitte = v; klZusammenfassung(); }); return; }
  if(k === "vorbereiten") return klVorbereiten();
  if(k === "neu"){ klReset(); return klHome(); }
});
$("#p-klaeren").addEventListener("keydown", e => {
  if(e.target.id === "klIn" && e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); klSenden(); }
});
