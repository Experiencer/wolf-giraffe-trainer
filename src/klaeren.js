/* ===================== Klären – „Erzähl mal“ (Weg A, K1 Schreiben, v6.8) =====================
   Worum geht es? Bisher übt man in der App immer selbst. Hier ist es umgekehrt: Du erzählst,
   was dich beschäftigt, und der Coach hört empathisch zu. Er gibt wieder, was angekommen ist,
   und vermutet als Frage, was du fühlst und was dir wichtig ist. Du entscheidest, ob es passt.
   Grundlage: Konzept „Gemeinsam klären“ (Abschnitte 2, 3, 6, 9) und GFK-Wissensbasis §6–§7.

   Haltung (GFK-Coach): Empathie vor Bildung, Vermutung als Frage, keine Ratschläge, kein Trost,
   keine Urteile über die abwesende Person, Wut ist willkommen. Ruhiger Bereich: keine Feiern, keine Zahlen.
   Daten: nur im Arbeitsspeicher, nichts wird gespeichert. Krisenpfad: kriseVorab + llmJSON (krise.js).
   Eingabeart: Schreiben. Sprechen und Echtzeit folgen nach dem Stimmen-Testlabor (E-26). */

const KL = {phase:"home", turns:[], first:"", conf:{g:[], b:[]}, last:null, nein:0, rejected:{g:[], b:[]}, bitte:"", wichtig:"", busy:false, angekommen:false};
const KL_TEIL = []; // ausgewählte Wörter bei „Teilweise“

function klReset(){
  Object.assign(KL, {phase:"home", turns:[], first:"", conf:{g:[], b:[]}, last:null, nein:0, rejected:{g:[], b:[]}, bitte:"", wichtig:"", busy:false});
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
function klPrompt(){
  const verlauf = KL.turns.map(t => (t.role === "user" ? "PERSON: " : "COACH: ") + t.content).join("\n");
  return `Du hörst einer Person empathisch zu – nach Marshall B. Rosenberg (Gewaltfreie Kommunikation). Sie erzählt von sich. Du bist kein Rollenspiel-Gegenüber und kein Lehrer: Hier geht es darum, dass sie sich gehört fühlt.
REGELN:
- 2–3 kurze Sätze, du-Form, Alltagssprache, keine Fachbegriffe.
- Erst kurz und ohne Urteil wiedergeben, was angekommen ist. Dann genau EINE Vermutung zu Gefühl und Bedürfnis, als Frage („Bist du …, weil dir … wichtig ist?“). Die Person entscheidet, ob es passt.
- Urteile und Pseudogefühle übersetzen, nicht korrigieren („übergangen“ → „Wolltest du einbezogen werden?“). Wörter wie „nie“ oder „immer“ nicht verbessern.
- Keine Ratschläge („du solltest“, „versuch mal“), kein Trost („Kopf hoch“, „wird schon“), keine eigene Geschichte, kein Ausfragen nach Fakten, keine Erklärungen. Höchstens eine Frage.
- Empathie ist nicht Zustimmung: Urteile nicht über die abwesende Person und verteidige sie auch nicht („Vielleicht meinte er es nicht so“ ist ein Blocker). Höre die Bedürfnisse hinter dem Urteil.
- Wut ist willkommen. Bitte nie darum, netter zu formulieren.
- Keine Diagnosen, keine Therapiesprache, nichts über Stimme, Tonfall oder Weinen.
- Hat die Person zweimal „Eher nicht“ gesagt, stell eine offene Frage („Was trifft es eher?“) statt einer neuen Vermutung.
- Wird es ruhiger, oder sagt die Person, dass etwas angekommen ist, frag: „Ist etwas angekommen? Magst du weitergehen oder es hier stehen lassen?“ und setze genug_signal auf true.
Schon bestätigt – Gefühle: ${KL.conf.g.join(", ") || "noch nichts"}; wichtig: ${KL.conf.b.join(", ") || "noch nichts"}. Nicht gepasst hat: ${[...KL.rejected.g, ...KL.rejected.b].join(", ") || "–"}.
VERLAUF:
${verlauf}

Antworte NUR mit JSON: {"spiegel":"1–2 Sätze: was angekommen ist","vermutung":{"gefuehle":["1–2 Wörter"],"beduerfnisse":["1–2 Wörter"]},"frage":"1 Satz: die Vermutung als Frage (oder offene Frage)","genug_signal":false}`;
}
/* Ohne Verbindung: Alltagswörter, Pseudogefühle und Lernkarten-Wörter im Text finden (umgedreht wie bei „Zuhören“) */
function klOffline(text){
  const low = String(text || "").toLowerCase(), g = [], b = [];
  const add = (arr, w, rej) => { if(w && !arr.includes(w) && !rej.includes(w)) arr.push(w); };
  Object.keys(PSEUDO).forEach(p => { if(low.includes(p)){ const lp = (LK.pseudo || []).find(x => x.w === p);
    (lp ? lp.gefuehle : PSEUDO[p].split(" / ")).forEach(w => add(g, w, KL.rejected.g)); (lp ? lp.beduerfnisse : []).forEach(w => add(b, w, KL.rejected.b)); } });
  EMP_SYN.forEach(([keys, ws]) => { if(keys.some(k => startsWord(low, k))) ws.forEach(w => /^[A-ZÄÖÜ]/.test(w) ? add(b, w, KL.rejected.b) : add(g, w, KL.rejected.g)); });
  [...LK.gefuehle.unerfuellt, ...LK.gefuehle.erfuellt].forEach(gr => gr.woerter.forEach(x => { if(stemHit(low, x.w)) add(g, x.w, KL.rejected.g); }));
  LK.beduerfnisse.forEach(br => br.woerter.forEach(x => { if(x.w.length >= 5 && stemHit(low, x.w)) add(b, x.w, KL.rejected.b); }));
  const gg = g.filter(w => !KL.conf.g.includes(w)).slice(0, 1), bb = b.filter(w => !KL.conf.b.includes(w)).slice(0, 1);
  const kurz = text.length > 110 ? text.slice(0, 100).replace(/\s+\S*$/, "") + " …" : text;
  if(KL.nein >= 2 || (!gg.length && !bb.length)) return {spiegel: KL.turns.length > 1 ? "Danke, dass du das ergänzt." : `Angekommen ist bei mir: „${kurz}“`, vermutung:{gefuehle:[], beduerfnisse:[]},
    frage: "Was trifft es eher – wie geht es dir, wenn du daran denkst? Die Gefühlskarten können helfen, ein Wort zu finden.", genug_signal:false, offen:true};
  const fr = gg.length && bb.length ? `Bist du ${gg[0]}, weil dir ${bb[0]} wichtig ist?` : gg.length ? `Bist du ${gg[0]}?` : `Ist dir ${bb[0]} wichtig?`;
  return {spiegel: KL.turns.length > 1 ? "Danke, dass du das ergänzt." : `Angekommen ist bei mir: „${kurz}“`, vermutung:{gefuehle:gg, beduerfnisse:bb}, frage: fr, genug_signal: KL.conf.g.length + KL.conf.b.length >= 3};
}
async function klCoach(){
  KL.busy = true; const t = klMsg("Coach", "Der Coach hört zu …", "them klwait"); t.setAttribute("aria-busy", "true");
  let r = null;
  if(liveOn()){
    try{ r = await llmJSON(klPrompt(), {tier:"quick"}); }
    catch(e){ t.remove(); KL.busy = false; if(istKrise(e)) return; if(e && e.code === "access") askAccess(); r = null; }
  }
  if(t.isConnected) t.remove();
  if(!r || (!r.spiegel && !r.frage)) r = klOffline(KL.turns.filter(x => x.role === "user").map(x => x.content).join(" "));
  const v = r.vermutung || {}; KL.last = {g:(v.gefuehle || []).filter(Boolean).slice(0, 2), b:(v.beduerfnisse || []).filter(Boolean).slice(0, 2), offen: !!r.offen || !((v.gefuehle || []).length || (v.beduerfnisse || []).length)};
  const text = [r.spiegel, r.frage].filter(Boolean).join(" ");
  klMsg("Coach", text, "them"); KL.turns.push({role:"assistant", content:text});
  KL.busy = false;
  $("#klWeiterLink").hidden = false;
  if(r.genug_signal === true || r.genug_signal === "ja") return klWieWeiter(true);
  klAntwortZeigen();
}
function klAntwortZeigen(){
  const box = $("#klAntwort"); KL_TEIL.length = 0;
  if(KL.last.offen){ box.hidden = true; $("#klIn").placeholder = "Was trifft es eher? …"; if(KL.nein >= 2) klKartenAuf(true); refocus("#klIn"); return; }
  box.hidden = false;
  box.innerHTML = `<p class="lbl" id="klPasstLbl">Passt das?</p>
    <div class="row klpasst" role="group" aria-labelledby="klPasstLbl"><button class="btn" data-klant="ja">● Ja, genau</button><button class="btn" data-klant="teil">◐ Teilweise</button><button class="btn" data-klant="nein">○ Eher nicht</button></div>
    <div id="klTeil" hidden></div>
    <p class="small muted">Du kannst unten auch etwas ergänzen oder einfach weitererzählen.</p>`;
  $("#klIn").placeholder = "Ergänzen oder weitererzählen …";
  refocus('[data-klant="ja"]');
}
function klBestaetigen(g, b){ g.forEach(w => { if(!KL.conf.g.includes(w)) KL.conf.g.push(w); }); b.forEach(w => { if(!KL.conf.b.includes(w)) KL.conf.b.push(w); }); }
async function klAntwort(art){
  if(KL.busy) return;
  const extra = $("#klIn").value.trim(), L = KL.last || {g:[], b:[]};
  if(art === "teil" && !$("#klTeil").dataset.offen){
    const words = [...L.g, ...L.b];
    $("#klTeil").dataset.offen = "1"; $("#klTeil").hidden = false;
    $("#klTeil").innerHTML = `<p class="small" id="klTeilLbl">Was davon passt?</p><div class="row" role="group" aria-labelledby="klTeilLbl">${words.map(w => `<button class="chip" aria-pressed="false" data-klteil="${esc(w)}">${esc(w)}</button>`).join("")}</div><div class="row"><button class="btn primary small" data-klant="teil">Weiter</button></div>`;
    refocus("#klTeil [data-klteil]"); return;
  }
  if(extra && await kriseVorab(extra)) return;
  let say = art === "ja" ? "Ja, genau." : art === "nein" ? "Eher nicht." : "Teilweise.";
  if(art === "ja"){ klBestaetigen(L.g, L.b); KL.nein = 0; }
  if(art === "teil"){ const sel = [...KL_TEIL]; klBestaetigen(L.g.filter(w => sel.includes(w)), L.b.filter(w => sel.includes(w)));
    L.g.filter(w => !sel.includes(w)).forEach(w => KL.rejected.g.push(w)); L.b.filter(w => !sel.includes(w)).forEach(w => KL.rejected.b.push(w));
    if(sel.length) say += " Es passt: " + sel.join(", ") + "."; KL.nein = 0; }
  if(art === "nein"){ KL.nein++; KL.rejected.g.push(...L.g); KL.rejected.b.push(...L.b); }
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
  if(!KL.first) KL.first = text;
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
    <h2 class="klh2">${vomCoach ? "Magst du weitergehen oder es hier stehen lassen?" : "Wie möchtest du weitergehen?"}</h2>
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
