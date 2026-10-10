/* ===================== Zustand ===================== */
const SESSION = {cur:null, open:30, turns:[], log:[], posUsed:false, struggle:0, sinceHelp:9, busy:false, coachBusy:false, ctl:null, lastThem:"", startedAt:0, saved:null};
let LEVEL = LEVELS[store.get("gfk.level")] ? store.get("gfk.level") : "gefuehrt";
let MODE = ["text","voice","rt"].includes(store.get("gfk.mode")) ? store.get("gfk.mode") : "text";
let FILTER = "all";
const CARDS = {}; let cardSeq = 0;
const COACH_WORDS = /^\s*(coach|hilfe|hilf mir)\b[\s.!?,]*$/i;
const STOP_WORDS = /^\s*(auszeit|time ?out|pause|stopp?)\b[\s.!?,]*$/i;
const customs = () => store.json("gfk.custom", []);
const allScenarios = () => [...SZ, ...customs()];
const findSz = id => allScenarios().find(s => s.id === id);
const personName = sz => String(sz.rolle || "Gegenüber").split(",")[0].trim();
const clean = s => String(s || "").replace(/^[AB]:\s*/, "").replace(/\s*\(.*?\)/g, "");
const strip = s => String(s || "").replace(/[„“"]/g, "");
function sys(msg){ $("#sysnote").textContent = msg || ""; }
function status(t){ $("#status").textContent = t; }

/* ===================== Tabs ===================== */
function selectTab(id, focus){
  $$('[role="tab"]').forEach(t => {
    const on = t.id === id;
    t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
    $("#" + t.getAttribute("aria-controls")).hidden = !on;
    if(on && focus) t.focus();
  });
  if(id !== "t-ueben"){ stopListen(); hushAll(); }
  stopVoiceLearning();
  if(id === "t-weg") renderWeg();
  if(id === "t-quiz"){ $("#quizRun").hidden = true; $("#quizHome").hidden = false; renderDecks(); }
  if(id === "t-hoeren"){ $("#empRun").hidden = true; $("#empHome").hidden = false; renderEmpHome(); }
  if(id === "t-karten") renderLK();
  if(id === "t-cheat") renderSZ();
  try{ history.replaceState(null, "", "#" + id.slice(2)); }catch(e){}
}
$(".tabs").addEventListener("click", e => { const t = e.target.closest('[role="tab"]'); if(t) selectTab(t.id); });
$(".tabs").addEventListener("keydown", e => {
  const tabs = $$('[role="tab"]'); const i = tabs.indexOf(document.activeElement); if(i < 0) return;
  let n = null;
  if(e.key === "ArrowRight") n = (i + 1) % tabs.length; else if(e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
  else if(e.key === "Home") n = 0; else if(e.key === "End") n = tabs.length - 1;
  if(n !== null){ e.preventDefault(); selectTab(tabs[n].id, true); }
});

/* ===================== Begleitstufe & Antwortart ===================== */
function setLevel(l){
  if(!LEVELS[l]) return;
  LEVEL = l; store.set("gfk.level", l);
  const app = $("#app"); app.classList.remove("lvl-gefuehrt","lvl-begleitet","lvl-frei"); app.classList.add("lvl-" + l);
  $$("#levelPick [data-level], #lvlSeg [data-level]").forEach(b => b.setAttribute("aria-checked", b.dataset.level === l));
  $("#coachSub").textContent = `${LEVELS[l].name} · ${LEVELS[l].sub}`;
  renderHelpers(); updateCollected();
  if(SESSION.cur){ $("#scene").open = l !== "frei" && SESSION.log.length === 0; }
}
function setMode(m){
  if(!["text","voice","rt"].includes(m)) return;
  if(MODE === "rt" && m !== "rt" && RT.on) rtStop("Echtzeit-Verbindung getrennt.");
  stopListen(); hushAll();
  MODE = m; store.set("gfk.mode", m);
  $$("#modeSeg [data-mode]").forEach(b => b.setAttribute("aria-checked", b.dataset.mode === m));
  $("#m-text").hidden = m !== "text";
  $("#m-mic").hidden = m === "text";
  $("#m-rt-extra").hidden = m !== "rt";
  $("#stage").hidden = m === "text";
  $("#composer").classList.toggle("inflow", m !== "text");
  if(m === "voice" && micBlocked) $("#typeInstead").open = true;
  micUI();
}
function radioGroup(sel, fn){
  const g = $(sel);
  g.addEventListener("click", e => { const b = e.target.closest('[role="radio"]'); if(b) fn(b); });
  g.addEventListener("keydown", e => {
    if(!["ArrowRight","ArrowLeft","ArrowDown","ArrowUp"].includes(e.key)) return;
    const items = [...g.querySelectorAll('[role="radio"]')]; const i = items.indexOf(document.activeElement); if(i < 0) return;
    e.preventDefault(); const n = items[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    n.focus(); fn(n);
  });
}
radioGroup("#levelPick", b => setLevel(b.dataset.level));
radioGroup("#lvlSeg", b => setLevel(b.dataset.level));
radioGroup("#modeSeg", b => setMode(b.dataset.mode));

/* ===================== Galerie ===================== */
function renderGallery(){
  const list = FILTER === "mine" ? customs() : allScenarios().filter(s => FILTER === "all" || String(s.stufe) === FILTER);
  const dots = n => `<span class="lvl" aria-hidden="true">${[1,2,3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
  const card = s => `<div class="scwrap"><button class="scard" data-open="${esc(s.id)}">
      <span class="meta">${esc(s.bereich)} · ${dots(s.stufe)} ${STUFE[s.stufe] || ""}</span>
      <h3>${esc(s.titel)}</h3><span class="focus">${esc(s.fokus || "")}</span></button>
      ${s.id.startsWith("E") ? `<button class="btn ghost small del" data-del="${esc(s.id)}" aria-label="${esc(s.titel)} löschen">Löschen</button>` : ""}</div>`;
  const neu = `<div class="scwrap"><button class="scard new" id="newCustom"><b>+ Eigenes Szenario</b><span class="focus">Beschreib eine Situation aus deinem Leben und übe genau dieses Gespräch.</span></button></div>`;
  $("#sgrid").innerHTML = (FILTER === "all" || FILTER === "mine" ? neu : "") + list.map(card).join("") +
    (FILTER === "mine" && !list.length ? `<p class="muted">Noch keine eigenen Szenarien.</p>` : "");
  $$("#filters [data-f]").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === FILTER));
  renderContinue();
}
function renderContinue(){
  const box = $("#continueBox"); const parts = [];
  if(SERVER && SERVER.locked && !accessCode){
    parts.push(`<div class="card access"><b>Diese App ist geschützt.</b><p class="small muted">Gib den Zugangscode ein, damit Coach und natürliche Stimme funktionieren.</p>
      <div class="row"><label class="sr" for="gAccess">Zugangscode</label><input id="gAccess" type="password" autocomplete="off" style="max-width:280px"><button class="btn primary" id="gAccessSave">Freischalten</button></div></div>`);
  }
  const hist = store.json("gfk.history", []);
  const last = hist[hist.length - 1];
  if(last && findSz(last.sid)) parts.push(`<div class="card"><div><p class="xs muted">Weiterüben</p><b>${esc(findSz(last.sid).titel)}</b></div><button class="btn primary" data-open="${esc(last.sid)}">Weiter</button></div>`);
  const due = dueReviews().slice(0, 3);
  if(due.length) parts.push(`<div class="card"><div><p class="xs muted">Heute dran – Wiederholung</p><div class="row">${due.map(d => `<button class="chip" data-open="${esc(d.sid)}">${esc(d.title)} · ${esc(d.ago)}</button>`).join("")}</div></div></div>`);
  box.innerHTML = parts.join(""); box.hidden = !parts.length;
}
$("#filters").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if(!b) return; FILTER = b.dataset.f; renderGallery(); });
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]"); if(o){ selectTab("t-ueben"); openScenario(o.dataset.open); return; }
  const d = e.target.closest("[data-del]");
  if(d){ if(d.dataset.armed){ store.setJson("gfk.custom", customs().filter(s => s.id !== d.dataset.del)); renderGallery(); } else { d.dataset.armed = "1"; d.textContent = "Wirklich löschen?"; } return; }
  if(e.target.closest("#newCustom")) openCustom();
  if(e.target.closest("#gAccessSave")){ accessCode = $("#gAccess").value.trim(); store.set("gfk.access", accessCode); renderContinue(); }
  const sl = e.target.closest("[data-setlevel]"); if(sl){ setLevel(sl.dataset.setlevel); sl.closest(".notice").textContent = `Erledigt – nächstes Mal übst du „${LEVELS[sl.dataset.setlevel].name}“.`; }
  if(e.target.closest("[data-close]")) e.target.closest("dialog").close();
});

/* ===================== Gespräch starten ===================== */
function openScenario(id){
  const sz = findSz(id); if(!sz) return;
  SESSION.cur = sz; store.set("gfk.sz", id);
  $("#gallery").hidden = true; $("#practice").hidden = false;
  resetSession(); window.scrollTo({top:0});
  $("#pTitle").setAttribute("tabindex", "-1"); $("#pTitle").focus({preventScroll:true});
}
function backToGallery(){
  saveHistoryIfNeeded(); if(RT.on) rtStop(); stopListen(); hushAll();
  $("#practice").hidden = true; $("#gallery").hidden = false; renderGallery(); window.scrollTo({top:0});
}
function resetSession(){
  SESSION.ctl && SESSION.ctl.abort(); stopListen(); hushAll(); if(RT.on) rtStop();
  HELP.key = ""; HELP.p = null;
  Object.assign(SESSION, {open:30, turns:[], log:[], posUsed:false, struggle:0, sinceHelp:9, busy:false, coachBusy:false, lastThem:"", startedAt:Date.now(), saved:null});
  for(const k in CARDS) delete CARDS[k];
  const sz = SESSION.cur, name = personName(sz);
  $("#pTitle").textContent = sz.titel;
  $("#pMeta").textContent = [sz.bereich, STUFE[sz.stufe], sz.fokus].filter(Boolean).join(" · ");
  $("#sceneBody").innerHTML = `<p><b>Situation:</b> ${esc(sz.kontext)}</p><p><b>Dein Gegenüber:</b> ${esc(name)}</p>
    <div class="goal"><span class="hand">Lernziel</span><p>${esc(sz.lernziel)}</p></div>
    <p class="small muted">Du sprichst mit einer KI-Figur, nicht mit einem Menschen.</p>`;
  $("#sceneGoal").textContent = "Lernziel: " + sz.lernziel;
  $("#avThemPic").textContent = name.slice(0, 1).toUpperCase(); $("#avThemName").textContent = name;
  $("#log").innerHTML = ""; $("#feed").innerHTML = ""; $("#yourline").textContent = ""; sys("");
  setOpen(30);
  if(sz.eroeffnung){ them(sz.eroeffnung); SESSION.turns.push({role:"assistant", content:sz.eroeffnung}); }
  else { $("#log").innerHTML = `<p class="empty">Du beginnst das Gespräch.</p>`; $("#caption").textContent = "Du beginnst."; }
  $("#scene").open = LEVEL !== "frei";
  status("Du bist dran"); updateCollected(); renderHelpers(); micUI();
}
$("#backBtn").addEventListener("click", backToGallery);
$("#homeBtn").addEventListener("click", () => { selectTab("t-ueben"); if(!$("#practice").hidden) backToGallery(); });

/* ===================== Anzeige im Gespräch ===================== */
function setOpen(v){
  SESSION.open = Math.max(0, Math.min(100, Math.round(v)));
  const w = moodWord(SESSION.open), m = $("#mood");
  m.setAttribute("aria-valuenow", SESSION.open); m.setAttribute("aria-valuetext", w);
  $("#moodText").innerHTML = `${esc(personName(SESSION.cur || {rolle:"Gegenüber"}))}: <b>${w}</b>`;
  $("#moodMark").style.left = SESSION.open + "%";
}
function them(text, narr){
  $("#log .empty")?.remove();
  const el = document.createElement("div"); el.className = "msg them";
  el.innerHTML = `<span class="who">${esc(personName(SESSION.cur))}</span><div class="bubble">${narr ? `<span class="narr">(${esc(narr)})</span>` : esc(text)}</div>`;
  $("#log").append(el);
  $("#caption").innerHTML = narr ? `<span class="narr">(${esc(narr)})</span>` : esc(text);
  SESSION.lastThem = narr ? "" : text;
  if(MODE === "text") el.scrollIntoView({block:"nearest", behavior:"smooth"});
  return el;
}
try{ new ResizeObserver(() => document.documentElement.style.setProperty("--composer-h", $("#composer").offsetHeight + "px")).observe($("#composer")); }catch(e){}
function me(text){
  $("#log .empty")?.remove();
  const el = document.createElement("div"); el.className = "msg me";
  el.innerHTML = `<span class="who">Du</span><div class="bubble">${esc(text)}</div>`;
  $("#log").append(el);
  const y = $("#yourline"); y.textContent = text; y.classList.add("final");
  if(MODE === "text") el.scrollIntoView({block:"nearest", behavior:"smooth"});
  return el;
}
function speakingUI(who, on){
  $("#avThem").classList.toggle("talking", on && who === "them");
  if(on) status(who === "coach" ? "Coach spricht" : `${SESSION.cur ? personName(SESSION.cur) : "Gegenüber"} spricht …`);
}
function updateCollected(){
  const n = SESSION.log.length;
  const c = $("#collected");
  c.hidden = LEVEL !== "frei";
  c.textContent = n ? `${n} ${n === 1 ? "Notiz" : "Notizen"} gesammelt – du bekommst sie in der Auswertung.` : "Der Coach hört still zu und sammelt Notizen für die Auswertung.";
}
const HELPERS = ["Als ich … gesehen habe, ", "war ich …, ", "weil mir … wichtig ist. ", "Wärst du bereit, …?", "Bist du …, weil dir … wichtig ist?"];
function renderHelpers(){
  const show = LEVEL === "gefuehrt" || (LEVEL === "begleitet" && $("#helpers").dataset.open === "1");
  $("#helpers").innerHTML = show ? HELPERS.map(h => `<button class="chip" data-helper="${esc(h)}">${esc(h.trim())}</button>`).join("") : "";
  $("#helpers").hidden = !show;
  $("#helpersToggle").hidden = LEVEL !== "begleitet";
  $("#helpersToggle").textContent = show ? "Satzhilfe ausblenden" : "Satzhilfe zeigen";
}
$("#helpersToggle").addEventListener("click", () => { const h = $("#helpers"); h.dataset.open = h.dataset.open === "1" ? "" : "1"; renderHelpers(); });
$("#helpers").addEventListener("click", e => { const b = e.target.closest("[data-helper]"); if(!b) return; const t = $("#say"); t.value = (t.value + b.dataset.helper).replace(/\s+$/, " "); t.focus(); });

/* ===================== Coach-Karten ===================== */
const LBL = {O:"Beobachtung", G:"Gefühl", B:"Bedürfnis", R:"Bitte"};
const ELBL = {G:"Gefühl (vermutet)", B:"Bedürfnis (vermutet)", R:"Verbindungsfrage"};
const SYMB = {g:["ok","●","schon da"], y:["part","◐","teilweise"], r:["open","○","noch offen"], n:["na","–","hier nicht nötig"]};
function statusRow(c){
  return `<div class="statusrow" role="group" aria-label="Bausteine">${Object.entries(c.lights).map(([k, v]) => { const s = SYMB[v] || SYMB.n; const name = c.empathy && ELBL[k] ? ELBL[k] : LBL[k];
    return `<span class="st ${s[0]}" title="${s[2]}"><span class="dot" aria-hidden="true"></span>${name}<span class="sr">: ${s[2]}</span></span>`; }).join("")}</div>`;
}
function makePair(cls, html, anchor){
  const a = document.createElement("div"); a.className = "fcard " + cls; a.innerHTML = html;
  $("#feed").append(a); $("#feed").scrollTop = $("#feed").scrollHeight;
  const wrap = document.createElement("div"); wrap.className = "inline-coach"; const b = a.cloneNode(true); wrap.append(b);
  if(anchor && anchor.parentNode) anchor.after(wrap); else $("#log").append(wrap);
  return {els:[a, b], set(c2, h2){ for(const el of [a, b]){ el.className = "fcard " + c2; el.innerHTML = h2; } $("#feed").scrollTop = $("#feed").scrollHeight; }, remove(){ a.remove(); wrap.remove(); }, key(k){ a.dataset.k = k; b.dataset.k = k; }};
}
function createTurnCard(said, anchor, ask){
  const k = "c" + (++cardSeq);
  const R = CARDS[k] = {said, ask, self:null, coach:null, pair:makePair("turn pending", "", anchor)};
  R.pair.key(k); renderTurn(k);
  return {setCoach(c){ R.coach = c; renderTurn(k); }, remove(){ R.pair.remove(); delete CARDS[k]; }};
}
const SELF_OPTS = [["O","Beobachtung"],["G","Gefühl"],["B","Bedürfnis"],["R","Bitte"],["E","Verständnis zeigen"],["x","Überspringen"]];
function renderTurn(k){
  const R = CARDS[k]; const q = `<p class="q">„${esc(R.said)}“</p>`;
  if(R.ask && !R.self){
    R.pair.set("turn", `${q}<p class="lbl">Was wolltest du gerade ausdrücken?</p><div class="row">${SELF_OPTS.map(([v, l]) => `<button class="chip" data-self="${v}">${l}</button>`).join("")}</div>${R.coach ? "" : `<p class="small muted" aria-busy="true">Coach hört nach …</p>`}`);
    return;
  }
  if(!R.coach){ R.pair.set("turn pending", `${q}<p aria-busy="true">Coach hört nach …</p>`); return; }
  const c = R.coach;
  let selfLine = "";
  if(R.self && R.self !== "x"){
    const want = R.self === "E" ? "Verständnis zeigen" : LBL[R.self];
    const v = R.self === "E" ? (c.empathy ? "g" : "r") : (c.lights[R.self] || "n");
    const word = {g:"gelungen", y:"teilweise gelungen", r:"noch nicht hörbar", n:"hier nicht nötig"}[v];
    selfLine = `<p class="small selfline"><b>Du wolltest: ${want}</b> – <span class="st ${SYMB[v][0]}"><span class="dot" aria-hidden="true"></span>${word}</span></p>`;
  }
  const html = `${q}
    <div class="compact"><b>Schon gut:</b> ${esc(c.gut[0] || "")} <b>Als Nächstes:</b> ${esc(c.besser)} <button class="linkbtn" data-more>mehr</button></div>
    <div class="full">
      ${selfLine}
      <div><p class="lbl">Schon gut</p><ul>${c.gut.map(g => `<li>${esc(g)}</li>`).join("")}</ul></div>
      ${c.besser ? `<div><p class="lbl">Nächster Schritt</p><p>${esc(c.besser)}</p></div>` : ""}
      ${c.a ? `<div class="try"><span class="hand">Probier mal:</span><p>${esc(c.a)}</p>${c.g ? `<details><summary class="linkbtn">Lernform zeigen</summary><p>${esc(c.g)}</p></details>` : ""}</div>` : ""}
      ${statusRow(c)}
      <p class="small muted">${esc(EAR_TEXT[c.ear] || "")}</p>
    </div>`;
  R.pair.set("turn", html);
}
function onCardClick(e){
  const card = e.target.closest(".fcard"); if(!card) return;
  const k = card.dataset.k; const R = CARDS[k];
  const s = e.target.closest("[data-self]"); if(s && R){ R.self = s.dataset.self; renderTurn(k); return; }
  if(e.target.closest("[data-more]") && R) R.pair.els.forEach(el => el.classList.add("open"));
  if(e.target.closest("[data-hint]")){ removePair(card.dataset.k); callCoach(false); }
}
$("#feed").addEventListener("click", onCardClick);
$("#log").addEventListener("click", onCardClick);
function helpHTML(h, auto, ctx){
  return `<p class="lbl">${auto ? "Kurzer Halt vom Coach" : "Coach-Hilfe"}</p>${ctx ? `<p class="ctx">zu: „${esc(ctx)}“</p>` : ""}
    ${h.einschaetzung ? `<p>${esc(h.einschaetzung)}</p>` : ""}${h.warum ? `<p class="small muted">${esc(h.warum)}</p>` : ""}
    ${h.vorschlag ? `<div class="try"><p class="lbl">Du könntest sagen</p><p>${esc(strip(h.vorschlag))}</p></div>` : ""}`;
}
function removePair(k){ $$(`.fcard[data-k="${k}"]`).forEach(el => (el.parentElement.classList.contains("inline-coach") ? el.parentElement : el).remove()); }
function addHintCard(){
  const p = makePair("help", `<p>Der Coach hätte einen Tipp für deinen nächsten Satz.</p><div class="row"><button class="btn coach small" data-hint>Tipp zeigen</button></div>`, null);
  p.key("h" + (++cardSeq));
}

/* ===================== Ein Gesprächszug ===================== */
function normCoach(c){
  const lights = {O:c.O || "n", G:c.G || "n", B:c.B || "n", R:c.R || "n"};
  for(const k in lights) if(!"gyrn".includes(lights[k])) lights[k] = "n";
  const ear = ["wolf-innen","wolf-aussen","giraffe-innen","giraffe-aussen","ausdruck"].includes(c.ohr) ? c.ohr : earFrom(c.ohr);
  return {lights, empathy:!!c.empathie, ear, gut:(Array.isArray(c.gut) ? c.gut : []).slice(0, 2), besser:c.besser || "", g:c.lernform || c.giraffe || "", a:c.alltag || ""};
}
const ptsOf = c => Object.values(c.lights).reduce((s, v) => s + (v === "g" ? 2 : v === "y" ? 1 : 0), 0) + (c.empathy ? 3 : 0) - (c.ear.startsWith("wolf") ? 3 : 0);
const RULES = sz => `Du bist Trainingspartner für Gewaltfreie Kommunikation nach Marshall B. Rosenberg. Du spielst das Gegenüber aus dem Szenario und coachst parallel.

SZENARIO (verborgene Gefühle und Bedürfnisse NICHT aussprechen):
${JSON.stringify(sz)}
SCHWIERIGKEIT: ${LEVELS[LEVEL].prompt}

ROLLE: 1–3 kurze Sätze gesprochenes Deutsch, höchstens eine Frage, keine Regieanweisungen. Urteile, Vorwürfe, Drohungen, Ratschläge, Rechtfertigungen und Floskeln führen zu Abwehr gemäß Reaktionslogik. Echte Empathie (Vermutung zu Gefühl und Bedürfnis) und ehrlicher, vorwurfsfreier Ausdruck führen zu schrittweiser Öffnung.
COACH: Bewerte NUR den letzten Satz des Nutzers – die FUNKTION, nicht Formelwörter: Ist eine Beobachtung erkennbar, ein Gefühl, ein Bedürfnis hörbar, eine verhandelbare Bitte – oder eine Empathie-Vermutung über das Gegenüber? Natürliche Alltagssprache ist ausdrücklich gut. Status je Baustein: "g" schon da, "y" teilweise, "r" noch offen, "n" hier nicht nötig. Nenne 1–2 konkrete Dinge, die wirklich gut waren, und genau EINEN nächsten Schritt. Beschreibend und warm, nie über die Person urteilen.

Antworte NUR mit JSON:
{"antwort":"Rollentext","offenheit":0-100,"coach":{"O":"g|y|r|n","G":"g|y|r|n","B":"g|y|r|n","R":"g|y|r|n","empathie":true|false,"ohr":"wolf-innen|wolf-aussen|giraffe-innen|giraffe-aussen|ausdruck","gut":["…"],"besser":"…","lernform":"Satz in den vier Schritten","alltag":"natürlicher Satz, wie man ihn wirklich sagen würde"}}
Aktuelle Offenheit des Gegenübers: ${SESSION.open}.`;

function offlineTurn(text){
  const a = analyze(text), sug = coachSuggestion(a), gb = goodBetter(a, sug), L = LEVELS[LEVEL];
  const coach = {lights:a.lights, empathy:a.empathy, ear:a.ear, gut:gb.gut, besser:gb.besser, g:sug.g, a:sug.a};
  const delta = a.delta > 0 ? Math.round(a.delta * L.gain) : Math.round(a.delta * L.loss);
  return {coach, a, open: Math.max(0, Math.min(100, SESSION.open + delta)), wolf:a.wolf, pts:a.pts};
}
async function processTurn(text){
  SESSION.turns.push({role:"user", content:text});
  if(liveOn()){
    SESSION.ctl = new AbortController();
    try{
      const res = await llmJSON([{role:"user", content:RULES(SESSION.cur)}, ...SESSION.turns.slice(-16)], {tier:"quick", signal:SESSION.ctl.signal});
      const coach = normCoach(res.coach || {});
      return {coach, reply:{say:String(res.antwort || "…")}, open: typeof res.offenheit === "number" ? res.offenheit : SESSION.open, wolf: coach.ear.startsWith("wolf") ? 1 : 0, pts: ptsOf(coach)};
    }catch(e){
      if(e && e.code === "cancelled"){ SESSION.turns.pop(); throw e; }
      if(e && e.code === "access") askAccess();
      sys("Der ausführliche Coach ist gerade nicht erreichbar – diesmal prüft die Schnellanalyse.");
    }
  }
  const r = offlineTurn(text), parts = reactionParts(SESSION.cur);
  let reply;
  if(r.a.delta < 0) reply = parts.neg;
  else if((r.open >= 45 || (r.a.empathy && r.a.delta >= 28)) && !SESSION.posUsed){ reply = parts.pos; SESSION.posUsed = true; }
  else if(r.open >= 45) reply = {say: WARM[SESSION.log.length % WARM.length]};
  else reply = {say: NEUTRAL[SESSION.log.length % NEUTRAL.length]};
  await sleep(350);
  return {coach:r.coach, reply, open:r.open, wolf:r.wolf, pts:r.pts};
}
function isStruggle(r, before){
  const c = r.coach, opens = Object.values(c.lights).filter(v => v === "r").length;
  return r.wolf > 0 || c.ear.startsWith("wolf") || (!c.empathy && opens >= 3) || r.open <= before - 10;
}
function evaluateStruggle(r, before){
  SESSION.struggle = isStruggle(r, before) ? SESSION.struggle + 1 : 0;
  SESSION.sinceHelp++;
  const L = LEVELS[LEVEL];
  if(!L.auto || SESSION.struggle < L.auto || SESSION.sinceHelp < 2) return null;
  SESSION.struggle = 0;
  return LEVEL === "gefuehrt" ? "auto" : "hint";
}
async function autoCoach(kind){
  if(kind === "hint"){ addHintCard(); return; }
  if(MODE === "rt" && RT.on) await rtPauseForCoach(true); else await callCoach(true);
}
function recordTurn(text, r, before, card){
  SESSION.log.push({text, coach:r.coach, openBefore:before, open:r.open, wolf:r.wolf, pts:r.pts});
  setOpen(r.open);
  if(card) card.setCoach(r.coach);
  updateCollected();
  if(SESSION.log.length === 1) $("#scene").open = false;
}
async function submitTurn(text, from){
  text = (text || "").trim(); if(!text || SESSION.busy) return;
  if(STOP_WORDS.test(text)){ openPause("pause"); return; }
  if(COACH_WORDS.test(text)){ callCoach(false); return; }
  SESSION.busy = true; setBusy(true); status(`${personName(SESSION.cur)} denkt nach …`);
  const anchor = me(text);
  const card = LEVEL !== "frei" ? createTurnCard(text, anchor, from === "text" && LEVEL === "gefuehrt" && settings.selfAssess) : null;
  const before = SESSION.open;
  let r;
  try{ r = await processTurn(text); }
  catch(e){ SESSION.busy = false; setBusy(false); status("Du bist dran"); card && card.remove(); anchor.remove(); if(from === "voice") $("#vSay").value = text; else $("#say").value = text; return; }
  recordTurn(text, r, before, card);
  them(r.reply.say, r.reply.narr);
  SESSION.turns.push({role:"assistant", content: r.reply.say || `(${r.reply.narr})`});
  SESSION.busy = false; setBusy(false); status("Du bist dran");
  prefetchHelp();
  const intervene = evaluateStruggle(r, before);
  if(MODE === "voice"){
    if(r.reply.say && settings.themVoice) await speak(r.reply.say, "them");
    if(settings.readFeedback && LEVEL !== "frei") await speak([r.coach.gut[0], r.coach.besser].filter(Boolean).join(" "), "coach");
    status("Du bist dran");
  }
  if(intervene) await autoCoach(intervene);
  else if(MODE === "voice" && settings.hands && !micBlocked) startListen();
}
function setBusy(b){ ["#send","#vSend","#endBtn"].forEach(s => $(s).disabled = b); }
$("#send").addEventListener("click", () => { const v = $("#say").value; $("#say").value = ""; submitTurn(v, "text"); });
$("#say").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); $("#send").click(); } });
$("#vSend").addEventListener("click", () => {
  const v = $("#vSay").value.trim(); $("#vSay").value = ""; if(!v) return;
  if(MODE === "rt" && RT.on){ if(STOP_WORDS.test(v)){ openPause("pause"); return; } if(COACH_WORDS.test(v)){ rtPauseForCoach(false); return; } if(RT.paused) rtResume();
    rtSend({type:"conversation.item.create", item:{type:"message", role:"user", content:[{type:"input_text", text:v}]}}); rtSend({type:"response.create"}); rtUserTurn(v); return; }
  submitTurn(v, "voice");
});
$("#vSay").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); $("#vSend").click(); } });

/* ===================== Coach rufen ===================== */
function offlineHelp(){
  const sz = SESSION.cur, g = clean(sz.verborgen?.gefuehle?.[0] || "unsicher"), b = clean(sz.verborgen?.beduerfnisse?.[0] || "Verständnis");
  const tip = FOCUS_TIP[Object.keys(FOCUS_TIP).find(k => String(sz.fokus).includes(k)) || "Ehrlicher"];
  const empathyFocus = /Empathie|Konflikt|Vermitteln|Entschuldigung|Wut|Kritik/.test(sz.fokus) || SESSION.open < 35;
  return {einschaetzung: SESSION.lastThem ? `Hinter „${SESSION.lastThem}“ könnte ${g} stecken – vielleicht ist da ${b} wichtig.` : `Dein Gegenüber ist vielleicht ${g}.`,
    warum: tip, vorschlag: empathyFocus ? `„Bist du gerade ${g}, weil dir ${b} wichtig ist?“` : "„Als ich … erlebt habe, war ich …, weil mir … wichtig ist. Wärst du bereit, …?“"};
}
/* ===================== Coach-Hilfe vorbereiten (v6) =====================
   Im Sprechen- und Echtzeit-Modus wird nach jeder Antwort des Gegenübers die Hilfe schon im Hintergrund geholt.
   Ruft man dann „Coach“, ist der Text meist schon da – nur noch die Stimme muss entstehen.
   Kosten: ein kurzer zusätzlicher Claude-Aufruf pro Gesprächsrunde. */
const HELP = {key:"", p:null};
const helpKey = () => SESSION.cur ? SESSION.startedAt + ":" + SESSION.turns.length : "";
function fetchHelp(auto){
  const transcript = SESSION.turns.map(t => (t.role === "user" ? "NUTZER: " : "GEGENÜBER: ") + t.content).join("\n");
  return llmJSON(`Du bist ein warmer GFK-Coach nach Marshall B. Rosenberg und begleitest ein Rollenspiel. ${auto ? "Der Nutzer hat gerade mehrfach Schwierigkeiten – halte kurz an und hilf ihm, ohne zu bewerten." : "Der Nutzer ruft dich um Hilfe."}
Szenario (verborgene Gefühle/Bedürfnisse nur als Vermutung weitergeben): ${JSON.stringify(SESSION.cur)}
Verlauf:
${transcript}

Antworte NUR mit JSON: {"einschaetzung":"1 Satz: was beim Gegenüber gerade los sein könnte (als Vermutung)","warum":"1 Satz: worauf es jetzt ankommt","vorschlag":"1 natürlicher Satz, den der Nutzer jetzt sagen könnte"}`, {tier:"quick"});
}
function prefetchHelp(){
  if(MODE === "text" || !liveOn() || !SESSION.cur || SESSION.coachBusy) return;
  const key = helpKey(); if(!key || HELP.key === key) return;
  HELP.key = key; HELP.p = fetchHelp(false).catch(() => null);
}
/* Gibt die vorbereitete Hilfe zurück, wenn sich das Gespräch seitdem nicht verändert hat (sonst null). */
function takeHelp(auto){
  if(auto || !HELP.p || HELP.key !== helpKey()) return null;
  const p = HELP.p; HELP.key = ""; HELP.p = null; return p;
}
async function callCoach(auto){
  if(SESSION.coachBusy || !SESSION.cur) return;
  SESSION.coachBusy = true; stopListen();
  SESSION.sinceHelp = 0; SESSION.struggle = 0;
  const ctx = SESSION.lastThem;
  const pair = makePair(auto ? "auto pending" : "help pending", `<p aria-busy="true">${auto ? "Kurzer Halt – der Coach überlegt …" : "Coach überlegt …"}</p>`, null);
  let h = null;
  if(liveOn()){
    try{
      const pre = takeHelp(auto);
      if(pre) h = await pre;
      if(!h) h = await fetchHelp(auto);
    }catch(e){ if(e && e.code === "access") askAccess(); }
  }
  if(!h) h = offlineHelp();
  pair.set(auto ? "auto" : "help", helpHTML(h, auto, ctx));
  if(MODE !== "text" && settings.coachVoice) await speak([h.einschaetzung, h.vorschlag ? "Du könntest sagen: " + strip(h.vorschlag) : ""].filter(Boolean).join(" "), "coach");
  SESSION.coachBusy = false;
  status(MODE === "rt" && RT.on && RT.paused ? "Pause – tippe aufs Mikrofon, um weiterzusprechen" : "Du bist dran");
  micUI();
}
function onAskCoach(){ if(MODE === "rt" && RT.on && !RT.paused){ rtPauseForCoach(false); return; } callCoach(false); }
$("#askCoach").addEventListener("click", onAskCoach);
$("#askCoach2").addEventListener("click", onAskCoach);

/* ===================== Spracheingabe (Browser) ===================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, micBlocked = INSIDE_CLAUDE || !SR;
function startListen(){
  if(MODE !== "voice" || micBlocked || SESSION.busy || listening) return;
  hushAll();
  let finalText = "";
  try{ rec = new SR(); }catch(e){ blockMic("Die Spracherkennung lässt sich hier nicht starten."); return; }
  rec.lang = "de-DE"; rec.interimResults = true; rec.continuous = false;
  rec.onresult = e => {
    let interim = "";
    for(let i = e.resultIndex; i < e.results.length; i++){ const r = e.results[i]; if(r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
    const y = $("#yourline"); y.classList.remove("final"); y.textContent = (finalText + " " + interim).trim();
  };
  rec.onerror = e => {
    if(["not-allowed","service-not-allowed","audio-capture"].includes(e.error)) blockMic("Das Mikrofon ist nicht freigegeben. Erlaube es über das Schloss-Symbol in der Adresszeile.");
    else if(e.error === "no-speech") sys("Ich habe nichts gehört. Tippe aufs Mikrofon und sprich etwas lauter.");
    else if(e.error === "network") blockMic("Die Spracherkennung braucht eine Internetverbindung.");
  };
  rec.onend = () => { listening = false; micUI(); const t = finalText.trim(); if(t) submitTurn(t, "voice"); else if(!SESSION.busy) status("Du bist dran"); };
  try{ rec.start(); listening = true; sys(""); status("Ich höre zu …"); micUI(); }catch(e){ blockMic("Die Spracherkennung lässt sich hier nicht starten."); }
}
function stopListen(){ if(rec && listening){ try{ rec.stop(); }catch(e){} } }
function blockMic(why){ micBlocked = true; listening = false; sys(why + " Du kannst unten tippen oder mit der Mikrofon-Taste deiner Tastatur diktieren."); $("#typeInstead").open = true; micUI(); }

/* Mikrofon-Knopf: ein Element für „Sprechen“ und „Echtzeit“ */
function micUI(){
  const b = $("#mic"), lab = $("#micLabel"); if(!b) return;
  let state = "ready", label = "", small = "", dis = false;
  if(MODE === "voice"){
    if(micBlocked){ dis = true; label = "Mikrofon hier nicht verfügbar"; small = INSIDE_CLAUDE ? "In Claude ist das Mikrofon gesperrt – tippe oder diktiere unten." : "Tippe oder diktiere unten."; }
    else if(listening){ state = "listening"; label = "Ich höre zu …"; small = "Tippe, wenn du fertig bist"; }
    else { label = "Tippen und sprechen"; small = "Sag „Coach“ für Hilfe oder „Auszeit“ für eine Pause"; }
  } else if(MODE === "rt"){
    const un = $("#rtUnavail");
    if(!canRealtime()){
      dis = true; label = "Echtzeit hier nicht verfügbar";
      un.hidden = false;
      un.textContent = INSIDE_CLAUDE ? "Echtzeit braucht Mikrofon und eine direkte Verbindung zu OpenAI – beides ist hier in Claude gesperrt. Öffne die App auf deiner Website (Vercel) oder lokal."
        : "Für Echtzeit braucht die App einen OpenAI-Zugang: auf Vercel als OPENAI_API_KEY, lokal in den Einstellungen.";
    } else {
      un.hidden = true;
      if(RT.connecting){ state = "busy"; label = "Verbinde …"; }
      else if(!RT.on){ label = "Gespräch beginnen"; small = "Tippe aufs Mikrofon – dann sprichst du frei"; }
      else if(RT.paused){ state = "muted"; label = "Pause – Coach ist dran"; small = "Tippe aufs Mikrofon, um weiterzusprechen"; }
      else if(RT.muted){ state = "muted"; label = "Mikrofon stumm"; small = "Tippe, um weiterzusprechen"; }
      else { state = "listening"; label = "Mikrofon offen"; small = "Sprich frei · „Coach“ holt Hilfe · „Auszeit“ pausiert"; }
    }
    $("#rtStop").hidden = !RT.on;
  }
  b.dataset.state = state; b.disabled = dis;
  b.setAttribute("aria-label", label);
  lab.innerHTML = `${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}`;
}
$("#mic").addEventListener("click", async () => {
  if(MODE === "voice"){ listening ? stopListen() : startListen(); return; }
  if(MODE !== "rt" || !canRealtime()) return;
  if(!RT.on && !RT.connecting){ if(await ensureConsent()) rtStart(); return; }
  if(RT.paused) rtResume(); else rtMute(!RT.muted);
});
document.addEventListener("keydown", e => {
  if(e.key === "Escape" && !document.querySelector("dialog[open]") && !$("#practice").hidden && !$("#p-ueben").hidden){ e.preventDefault(); openPause("pause"); }
});

/* ===================== Echtzeit (OpenAI Realtime, WebRTC) ===================== */
const RT = {on:false, connecting:false, pc:null, dc:null, stream:null, audio:null, paused:false, muted:false, responseActive:false, aiText:"", userDraft:{}, skipFirst:false};
function rtInstructions(sz){
  const hist = SESSION.turns.length > 1 ? `\nBISHERIGER VERLAUF (knüpfe daran an):\n${SESSION.turns.slice(-10).map(t => (t.role === "user" ? "Übender: " : "Du: ") + t.content).join("\n")}` : "";
  return `Du spielst in einem Übungsgespräch zur Gewaltfreien Kommunikation (nach Marshall B. Rosenberg) eine Figur. Sprich ausschließlich Deutsch, in natürlicher gesprochener Alltagssprache.
FIGUR: ${sz.rolle}
SITUATION aus Sicht des Übenden: ${sz.kontext}
DEINE INNERE LAGE (nie direkt aussprechen, nur durchscheinen lassen): Gefühle ${(sz.verborgen?.gefuehle || []).join(", ")}; Bedürfnisse ${(sz.verborgen?.beduerfnisse || []).join(", ")}.
REAKTIONSLOGIK: ${sz.eskalation}
SCHWIERIGKEIT: ${LEVELS[LEVEL].prompt}
REGELN:
- Bleib immer in der Rolle. Du bist nicht Coach, erklärst nichts über GFK und lobst nicht.
- Antworte kurz: ein bis drei Sätze, höchstens eine Frage.
- Lass Gefühle in der Stimme hörbar werden – passend zu deiner Lage.
- Auf Vorwürfe, Urteile, Drohungen, Ratschläge oder Rechtfertigungen reagierst du mit Abwehr. Auf echte Empathie und ehrliche, vorwurfsfreie Sätze öffnest du dich schrittweise.
- Wenn der Übende nur „Coach“, „Hilfe“, „Auszeit“, „Stopp“ oder „Pause“ sagt, antworte nur mit „Mhm.“
${sz.eroeffnung && SESSION.turns.length <= 1 ? `Dein erster Satz lautet: „${sz.eroeffnung}“` : "Warte, bis der Übende spricht."}${hist}`;
}
function rtSessionConfig(withModel){
  const s = {type:"realtime", instructions: rtInstructions(SESSION.cur), output_modalities:["audio"],
    audio:{input:{noise_reduction:{type:"near_field"}, transcription:{model:"gpt-live-transcribe", language:"de"},
      turn_detection:{type:"semantic_vad", eagerness:"low", create_response:true, interrupt_response:true}}, output:{voice: settings.rtVoice}}};
  if(withModel) s.model = "gpt-realtime-2.1";
  return s;
}
function rtSend(o){ if(RT.dc && RT.dc.readyState === "open") RT.dc.send(JSON.stringify(o)); }
function ensureConsent(){
  if(store.get("gfk.rtConsent") === "1") return Promise.resolve(true);
  const d = $("#dlgConsent");
  return new Promise(res => {
    const ok = () => { store.set("gfk.rtConsent", "1"); cleanup(); d.close(); res(true); };
    const cancel = () => { cleanup(); res(false); };
    const cleanup = () => { $("#consOk").removeEventListener("click", ok); d.removeEventListener("close", cancel); };
    $("#consOk").addEventListener("click", ok); d.addEventListener("close", cancel, {once:true});
    d.showModal();
  });
}
async function rtStart(){
  if(RT.on || RT.connecting) return;
  stopListen(); hushAll(); RT.connecting = true; micUI(); status("Verbinde …");
  const manual = store.get("gfk.ek") || "";
  try{
    let ek = "";
    if(SERVER && SERVER.realtime){
      const d = await serverPost("/api/realtime-session", {instructions: rtInstructions(SESSION.cur), voice: settings.rtVoice}).catch(err => { throw {step:"secret", code:err.code, message:err.message}; });
      ek = d.value;
    } else if(manual){ ek = manual; }
    else {
      let r;
      try{ r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {method:"POST", headers:{"Authorization":"Bearer " + keys.openai, "Content-Type":"application/json"}, body:JSON.stringify({expires_after:{anchor:"created_at", seconds:600}, session: rtSessionConfig(true)})}); }
      catch(netErr){ throw {step:"secret", cors:true, message:String(netErr)}; }
      if(!r.ok) throw {step:"secret", status:r.status, message:(await r.text()).slice(0, 300)};
      const d = await r.json(); ek = d.value || d?.client_secret?.value || "";
    }
    if(!ek) throw {step:"secret", message:"Kein Sitzungs-Schlüssel erhalten."};
    try{ RT.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}); }
    catch(micErr){ throw {step:"mic", message:String(micErr)}; }
    RT.pc = new RTCPeerConnection();
    RT.audio = new Audio(); RT.audio.autoplay = true;
    RT.pc.ontrack = e => { RT.audio.srcObject = e.streams[0]; };
    RT.pc.addTrack(RT.stream.getAudioTracks()[0], RT.stream);
    RT.dc = RT.pc.createDataChannel("oai-events");
    RT.dc.onopen = () => {
      if(manual && !(SERVER && SERVER.realtime)) rtSend({type:"session.update", session: rtSessionConfig(false)});
      RT.on = true; RT.connecting = false; RT.paused = false; RT.muted = false;
      if(SESSION.cur.eroeffnung && SESSION.turns.length <= 1){ RT.skipFirst = true; rtSend({type:"response.create", response:{instructions:`Sag jetzt in deiner Rolle genau diesen Satz, mit passender Stimmung: „${SESSION.cur.eroeffnung}“`}}); }
      status("Ich höre zu …"); micUI(); levelMeter(RT.stream);
    };
    RT.dc.onmessage = e => { try{ rtEvent(JSON.parse(e.data)); }catch(err){} };
    RT.dc.onclose = () => { if(RT.on) rtStop("Verbindung beendet."); };
    const offer = await RT.pc.createOffer();
    await RT.pc.setLocalDescription(offer);
    let r2;
    try{ r2 = await fetch("https://api.openai.com/v1/realtime/calls", {method:"POST", body:offer.sdp, headers:{"Authorization":"Bearer " + ek, "Content-Type":"application/sdp"}}); }
    catch(netErr){ throw {step:"call", cors:true, message:String(netErr)}; }
    if(!r2.ok) throw {step:"call", status:r2.status, message:(await r2.text()).slice(0, 300)};
    await RT.pc.setRemoteDescription({type:"answer", sdp: await r2.text()});
  }catch(e){ rtFail(e); }
}
function rtFail(e){
  const s = e && e.status; let msg = "Die Echtzeit-Verbindung kam nicht zustande.";
  if(e && e.code === "access"){ askAccess(); msg = "Bitte zuerst den Zugangscode eingeben."; }
  else if(e && e.step === "mic") msg = "Kein Zugriff aufs Mikrofon. Erlaube es über das Schloss-Symbol in der Adresszeile.";
  else if(e && e.cors) msg = "Der Browser hat die Verbindung blockiert. Öffne die App über deine Website oder http://localhost – oder trage in den Einstellungen einen Sitzungs-Schlüssel ein.";
  else if(s === 401 || s === 403) msg = "OpenAI lehnt den Schlüssel ab. Prüfe ihn oder ob dein Projekt Realtime nutzen darf.";
  else if(s === 429) msg = "OpenAI meldet ein Limit. Prüfe Guthaben und Budget-Limit.";
  else if(e && e.message) msg += " " + e.message;
  sys(msg); rtStop();
}
function rtStop(msg){
  try{ RT.dc && RT.dc.close(); }catch(e){}
  try{ RT.pc && RT.pc.close(); }catch(e){}
  if(RT.stream) RT.stream.getTracks().forEach(t => t.stop());
  if(RT.audio) RT.audio.srcObject = null;
  Object.assign(RT, {on:false, connecting:false, pc:null, dc:null, stream:null, audio:null, paused:false, muted:false, responseActive:false, aiText:"", userDraft:{}, skipFirst:false});
  $("#avThem").classList.remove("talking"); $("#avMe").classList.remove("talking");
  status("Du bist dran"); micUI();
  if(msg) sys(msg);
}
function rtMute(on){ RT.muted = on; if(RT.stream) RT.stream.getAudioTracks().forEach(t => t.enabled = !on); micUI(); }
function levelMeter(stream){
  try{
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC || !stream) return;
    const ac = new AC(), an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.fftSize);
    const tick = () => {
      if(!RT.stream){ ac.close(); $("#mic").style.setProperty("--lvl", 0); return; }
      an.getByteTimeDomainData(data); let sum = 0; for(const v of data){ const d = (v - 128) / 128; sum += d * d; }
      $("#mic").style.setProperty("--lvl", RT.muted ? 0 : Math.min(1, Math.sqrt(sum / data.length) * 5).toFixed(2));
      requestAnimationFrame(tick);
    };
    tick();
  }catch(e){}
}
function rtEvent(ev){
  switch(ev.type){
    case "input_audio_buffer.speech_started":
      $("#avThem").classList.remove("talking"); $("#avMe").classList.add("talking"); status("Ich höre zu …");
      $("#yourline").classList.remove("final"); $("#yourline").textContent = "…"; break;
    case "input_audio_buffer.speech_stopped":
      $("#avMe").classList.remove("talking"); break;
    case "conversation.item.input_audio_transcription.delta":
      RT.userDraft[ev.item_id] = (RT.userDraft[ev.item_id] || "") + (ev.delta || "");
      $("#yourline").textContent = RT.userDraft[ev.item_id]; break;
    case "conversation.item.input_audio_transcription.completed": {
      const text = (ev.transcript || RT.userDraft[ev.item_id] || "").trim(); delete RT.userDraft[ev.item_id];
      if(!text) break;
      if(STOP_WORDS.test(text)){ openPause("pause"); break; }
      if(COACH_WORDS.test(text)){ rtPauseForCoach(false); break; }
      rtUserTurn(text); break; }
    case "response.created": RT.responseActive = true; RT.aiText = ""; break;
    case "response.output_audio_transcript.delta":
      if(RT.paused) break;
      RT.aiText += ev.delta || ""; $("#caption").textContent = RT.aiText;
      $("#avThem").classList.add("talking"); status(`${personName(SESSION.cur)} spricht …`); break;
    case "response.output_audio_transcript.done": {
      const text = (ev.transcript || RT.aiText || "").trim();
      if(!text || RT.paused || /^mhm\.?$/i.test(text)) break;
      if(RT.skipFirst){ RT.skipFirst = false; $("#caption").textContent = text; prefetchHelp(); break; }
      them(text); SESSION.turns.push({role:"assistant", content:text}); prefetchHelp(); break; }
    case "response.done":
      RT.responseActive = false; $("#avThem").classList.remove("talking");
      if(!RT.paused) status("Du bist dran – sprich einfach"); break;
    case "error": {
      const m = (ev.error && ev.error.message) || ""; const c = (ev.error && ev.error.code) || "";
      if(/cancel/i.test(c) || /cancel/i.test(m)) break;   // harmloser Abbruch ohne laufende Antwort
      sys("OpenAI meldet: " + (m || "unbekannter Fehler")); break; }
  }
}
async function rtUserTurn(text){
  const anchor = me(text); SESSION.turns.push({role:"user", content:text});
  const card = LEVEL !== "frei" ? createTurnCard(text, anchor, false) : null;
  const before = SESSION.open;
  const r = await coachTurn(text);
  recordTurn(text, r, before, card);
  const intervene = evaluateStruggle(r, before);
  if(intervene) autoCoach(intervene);
}
async function coachTurn(text){
  if(liveOn()){
    try{
      const transcript = SESSION.turns.slice(-12).map(t => (t.role === "user" ? "NUTZER: " : "GEGENÜBER: ") + t.content).join("\n");
      const res = await llmJSON(`Du bist GFK-Coach nach Marshall B. Rosenberg und begleitest ein gesprochenes Rollenspiel. Szenario: ${JSON.stringify(SESSION.cur)}
Verlauf (gesprochen, das Transkript kann kleine Fehler haben):
${transcript}

Bewerte NUR die letzte Nutzer-Aussage: „${text}“ – die Funktion, nicht Formelwörter. Natürliche Alltagssprache ist gut. Nenne 1–2 Dinge, die wirklich gut waren, und genau EINEN nächsten Schritt. Kurz, warm, nicht wertend. Schätze, wie offen die Figur jetzt ist (0–100, aktuell ${SESSION.open}).
Antworte NUR mit JSON: {"offenheit":0-100,"coach":{"O":"g|y|r|n","G":"g|y|r|n","B":"g|y|r|n","R":"g|y|r|n","empathie":true|false,"ohr":"wolf-innen|wolf-aussen|giraffe-innen|giraffe-aussen|ausdruck","gut":["…"],"besser":"…","lernform":"…","alltag":"…"}}`, {tier:"quick"});
      const coach = normCoach(res.coach || {});
      return {coach, open: typeof res.offenheit === "number" ? res.offenheit : SESSION.open, wolf: coach.ear.startsWith("wolf") ? 1 : 0, pts: ptsOf(coach)};
    }catch(e){ if(e && e.code === "access") askAccess(); }
  }
  const r = offlineTurn(text);
  return {coach:r.coach, open:r.open, wolf:r.wolf, pts:r.pts};
}
async function rtPauseForCoach(auto){
  if(!RT.on){ return callCoach(auto); }
  RT.paused = true;
  if(RT.responseActive) rtSend({type:"response.cancel"});
  if(RT.audio) RT.audio.muted = true;
  rtMute(true); status(auto ? "Kurzer Halt – Coach" : "Pause – Coach"); micUI();
  await callCoach(auto);
}
function rtResume(){
  RT.paused = false; hushAll();
  if(RT.audio) RT.audio.muted = false;
  rtMute(false); status("Ich höre zu …"); micUI();
}
$("#rtStop").addEventListener("click", () => rtStop("Echtzeit-Verbindung getrennt."));
$("#rtDetails").addEventListener("click", () => openSettings("privacy"));

/* ===================== Auszeit & Selbstempathie ===================== */
const SE_FEEL = ["angespannt","traurig","wütend","erschöpft","unsicher","beschämt","ruhig"];
const SE_NEED = ["Ruhe","Verständnis","Sicherheit","Abstand","Unterstützung","Leichtigkeit"];
let pauseMode = "pause";
function openPause(mode){
  pauseMode = mode; stopListen(); hushAll();
  if(RT.on && !RT.paused){ RT.wasLive = true; RT.paused = true; if(RT.responseActive) rtSend({type:"response.cancel"}); if(RT.audio) RT.audio.muted = true; rtMute(true); }
  const chips = (arr, id) => $(id).innerHTML = arr.map(v => `<button class="chip" aria-pressed="false" data-se="${v}">${v}</button>`).join("");
  chips(SE_FEEL, "#seFeel"); chips(SE_NEED, "#seNeed"); $("#seSentence").hidden = true;
  $("#pauseTitle").textContent = mode === "selfemp" ? "60 Sekunden für dich" : "Kurze Pause";
  $("#pauseLead").textContent = mode === "selfemp" ? "Schwere Gespräche hinterlassen Spuren. Spür kurz nach – ohne Bewertung." : "Nichts geht verloren. Nimm dir einen Moment für dich.";
  $("#pRestart").hidden = mode === "selfemp"; $("#pQuit").hidden = mode === "selfemp";
  $("#pResume").textContent = mode === "selfemp" ? "Fertig" : "Weiter, wenn ich bereit bin";
  status("Pause"); $("#dlgPause").showModal();
}
$("#dlgPause").addEventListener("click", e => {
  const b = e.target.closest("[data-se]"); if(!b) return;
  b.parentElement.querySelectorAll("[data-se]").forEach(x => x.setAttribute("aria-pressed", x === b));
  const f = $("#seFeel [aria-pressed=true]")?.dataset.se, n = $("#seNeed [aria-pressed=true]")?.dataset.se;
  if(f && n){ $("#seSentence").hidden = false; $("#seSentence").textContent = `Ich bin gerade ${f}, weil ich ${n} brauche. Das darf so sein.`; discover("selbst"); }
});
function resumeFromPause(){
  if(RT.on && RT.wasLive){ RT.wasLive = false; rtResume(); } else status("Du bist dran");
}
$("#pResume").addEventListener("click", () => $("#dlgPause").close());
$("#dlgPause").addEventListener("close", () => { if(pauseMode === "pause") resumeFromPause(); });
$("#pRestart").addEventListener("click", () => { pauseMode = "x"; $("#dlgPause").close(); resetSession(); });
$("#pQuit").addEventListener("click", () => { pauseMode = "x"; $("#dlgPause").close(); backToGallery(); });
$("#pauseBtn").addEventListener("click", () => openPause("pause"));

/* ===================== Auswertung ===================== */
function computeFacts(){
  const L = SESSION.log, n = L.length;
  const comp = {};
  for(const k of ["O","G","B","R"]){ let g = 0, y = 0, app = 0; L.forEach(x => { const v = x.coach.lights[k]; if(v !== "n"){ app++; if(v === "g") g++; if(v === "y") y++; } }); comp[k] = {g, y, app}; }
  const best = L.slice().sort((a, b) => b.pts - a.pts)[0];
  const turn = L.map((x, i) => ({x, i, d:x.open - x.openBefore})).sort((a, b) => b.d - a.d)[0];
  const count = {}; L.forEach(x => (x.coach.gut || []).forEach(g => { const key = g.replace(/\s*\(„.*?“\)/, ""); count[key] = (count[key] || 0) + 1; }));
  const strengths = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, c]) => c > 1 ? `${k} (${c}×)` : k);
  const bcount = {}; L.forEach(x => { if(x.coach.besser) bcount[x.coach.besser] = (bcount[x.coach.besser] || 0) + 1; });
  const next = Object.entries(bcount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const wolfish = L.filter(x => x.coach.ear.startsWith("wolf")).length;
  const strong = L.filter(x => x.pts >= 5 || (x.coach.empathy && !x.coach.ear.startsWith("wolf"))).length;
  return {n, comp, best: best && best.pts >= 4 && !best.coach.ear.startsWith("wolf") ? best.text : "", turning: turn && turn.d >= 10 ? turn.x.text : "", strengths, next, difficult: SESSION.open < 30 || wolfish >= Math.ceil(n / 2), strong};
}
function nextScenario(){
  const cur = SESSION.cur, pool = SZ.filter(s => s.id !== cur.id);
  return pool.find(s => s.stufe === Math.min(3, (cur.stufe || 1) + (SESSION.open >= 60 ? 1 : 0)) && s.fokus.split(" ")[0] !== String(cur.fokus).split(" ")[0]) || pool[0];
}
const RATES = ["sehr unsicher","eher unsicher","mittel","eher sicher","sehr sicher"];
async function finish(){
  if(!SESSION.log.length){ sys("Schreib oder sag erst mindestens einen Satz – dann gibt es eine Auswertung."); return; }
  stopListen(); hushAll(); if(RT.on) rtStop();
  const f = computeFacts();
  const entry = saveHistory(f);
  markDay(); if(LEVEL === "frei") discover("frei");
  const d = $("#dlgReport"), body = $("#repBody");
  body.innerHTML = `<div class="row"><h2 id="repTitle" class="grow">Wie lief's?</h2><button class="iconbtn" data-close aria-label="Schließen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="field"><span class="lbl" id="rateLbl">Wie sicher hast du dich gefühlt?</span><div class="row" role="group" aria-labelledby="rateLbl" id="repRate">${RATES.map((r, i) => `<button class="chip" aria-pressed="false" data-rate="${i + 1}">${r}</button>`).join("")}</div></div>
    <div id="repMain"><p class="muted" aria-busy="true">${liveOn() ? "Der Coach schreibt seine Auswertung …" : ""}</p></div>`;
  d.showModal();
  let live = null;
  if(liveOn()){
    try{
      const transcript = SESSION.turns.map(t => (t.role === "user" ? "NUTZER: " : "GEGENÜBER: ") + t.content).join("\n");
      live = await llmJSON(`Werte dieses GFK-Rollenspiel nach Marshall B. Rosenberg warm und konkret aus. Szenario: ${JSON.stringify(SESSION.cur)}
Verlauf:
${transcript}

Antworte NUR mit JSON: {"verlauf":"2 Sätze: was im Gespräch passiert ist, mit Wendepunkt","staerken":["2–3 Dinge, die wirklich gelungen sind, konkret mit Bezug auf Sätze des Nutzers"],"lernfokus":"1 Satz: genau ein nächster Schritt"}`, {tier:"default"});
    }catch(e){ if(e && e.code === "access") askAccess(); }
  }
  const sz = SESSION.cur, nx = nextScenario();
  const strengths = (live && Array.isArray(live.staerken) && live.staerken.length ? live.staerken : f.strengths);
  const nextStep = (live && live.lernfokus) || f.next || "Probier im nächsten Gespräch, zuerst nach dem Gefühl des anderen zu fragen.";
  const nextLvl = LEVEL === "gefuehrt" ? "begleitet" : LEVEL === "begleitet" ? "frei" : null;
  const factRow = k => { const c = f.comp[k]; return c.app ? `<span>${LBL[k]}</span><span>in ${c.g} von ${c.app} Sätzen schon da${c.y ? `, ${c.y}× teilweise` : ""}</span>` : ""; };
  $("#repMain").innerHTML = `
    ${live && live.verlauf ? `<p>${esc(live.verlauf)}</p>` : ""}
    <div class="rep-sec"><h3>Was dir schon gelungen ist</h3>${strengths.length ? `<ul>${strengths.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : `<p>Du bist im Gespräch geblieben – das ist der erste Schritt.</p>`}
      ${f.best ? `<p class="small muted">Dein stärkster Satz:</p><p class="quote">„${esc(f.best)}“</p>` : ""}</div>
    <div class="rep-sec"><h3>Dein nächster Schritt</h3><p>${esc(nextStep)}</p></div>
    <div class="rep-sec"><h3>Was bei ${esc(personName(sz))} los war</h3>
      <div class="reveal"><div><p class="xs muted">Gefühle</p>${esc((sz.verborgen?.gefuehle || []).map(clean).join(", "))}</div><div><p class="xs muted">Bedürfnisse</p>${esc((sz.verborgen?.beduerfnisse || []).map(clean).join(", "))}</div></div>
      ${f.turning ? `<p class="small">Wendepunkt: Nach deinem Satz „${esc(f.turning)}“ wurde ${esc(personName(sz))} offener.</p>` : ""}</div>
    ${f.difficult ? `<div class="notice row"><span class="grow">Das war ein schweres Gespräch. Magst du dir 60 Sekunden für dich nehmen?</span><button class="btn small" id="repSelfEmp">Selbstempathie</button></div>` : ""}
    ${nextLvl && f.strong >= 3 ? `<div class="notice row"><span class="grow">${f.strong} starke Sätze. Magst du es beim nächsten Mal „${LEVELS[nextLvl].name}“ probieren?</span><button class="btn small" data-setlevel="${nextLvl}">Ja, ${LEVELS[nextLvl].name}</button></div>` : ""}
    <details><summary class="linkbtn">Zahlen anzeigen</summary><div class="facts" style="margin-top:8px">${["O","G","B","R"].map(factRow).join("")}<span>Sätze</span><span>${f.n}</span><span>${esc(personName(sz))} am Ende</span><span>${moodWord(SESSION.open)}</span></div></details>
    <div class="actions"><button class="btn" id="repGallery">Zur Auswahl</button><button class="btn" id="repAgain">Gleiche Szene nochmal</button>${nx ? `<button class="btn primary" id="repNext" data-nextid="${esc(nx.id)}">Weiter: ${esc(nx.titel)}</button>` : ""}</div>`;
  entry.strength = strengths[0] || ""; updateHistory(entry);
  $("#repRate").onclick = e => { const b = e.target.closest("[data-rate]"); if(!b) return; $$("#repRate [data-rate]").forEach(x => x.setAttribute("aria-pressed", x === b)); entry.rating = +b.dataset.rate; updateHistory(entry); };
  $("#repSelfEmp")?.addEventListener("click", () => { d.close(); openPause("selfemp"); });
  $("#repGallery").onclick = () => { d.close(); SESSION.saved = entry.id; backToGallery(); };
  $("#repAgain").onclick = () => { d.close(); resetSession(); };
  $("#repNext") && ($("#repNext").onclick = () => { d.close(); openScenario($("#repNext").dataset.nextid); });
}
$("#endBtn").addEventListener("click", finish);

/* ===================== Verlauf, Wiedervorlage, Mein Weg ===================== */
function saveHistory(f){
  const hist = store.json("gfk.history", []);
  const entry = {id: "h" + Date.now().toString(36), at: Date.now(), sid: SESSION.cur.id, title: SESSION.cur.titel, level: LEVEL, mode: MODE, n: f.n, open: SESSION.open, rating: null, strength: "", strong: f.strong};
  hist.push(entry); store.setJson("gfk.history", hist.slice(-200)); SESSION.saved = entry.id;
  return entry;
}
function updateHistory(entry){ const hist = store.json("gfk.history", []); const i = hist.findIndex(h => h.id === entry.id); if(i >= 0){ hist[i] = entry; store.setJson("gfk.history", hist); } }
function saveHistoryIfNeeded(){ if(SESSION.cur && SESSION.log.length && !SESSION.saved) saveHistory(computeFacts()); }
function dueReviews(){
  const hist = store.json("gfk.history", []), last = {};
  hist.forEach(h => { if(!last[h.sid] || h.at > last[h.sid].at) last[h.sid] = h; });
  const now = Date.now(), day = 864e5;
  return Object.values(last).map(h => ({sid:h.sid, title:(findSz(h.sid) || h).titel || h.title, days: Math.floor((now - h.at) / day)}))
    .filter(x => findSz(x.sid) && (x.days === 1 || x.days === 3 || x.days === 7 || x.days >= 14))
    .sort((a, b) => b.days - a.days).map(x => ({...x, ago: x.days === 1 ? "vor 1 Tag" : x.days >= 14 ? "vor über 2 Wochen" : `vor ${x.days} Tagen`}));
}
/* renderWeg und Kurzübungen: siehe lernen.js */

/* ===================== Übersetzer ===================== */
function renderXL(a, out){
  $("#xlFlags").innerHTML = a.issues.length ? `<p class="lbl xs muted">Was der Satz auslösen kann</p>${a.issues.slice(0, 4).map(i => `<p class="notice">${esc(i)}</p>`).join("")}` : `<p class="notice">Keine typischen Wolfsmuster gefunden.</p>`;
  const slot = (v, ph) => v ? esc(v) : `<span class="slot">${esc(ph)}</span>`;
  $("#xlOut").innerHTML = `<dt>Beobachtung</dt><dd>${slot(out.o, "Als ich [wann, was genau] gesehen habe …")}</dd>
    <dt>Gefühl</dt><dd>${slot(out.g, a.pseudo ? `… war ich ${PSEUDO[a.pseudo].split(" / ")[0]} …` : "… war ich [traurig / frustriert / besorgt] …")}</dd>
    <dt>Bedürfnis</dt><dd>${slot(out.b, "… weil mir [Verlässlichkeit / Respekt / Verbindung] wichtig ist.")}</dd>
    <dt>Bitte</dt><dd>${slot(out.r, "Wärst du bereit, [konkrete Handlung]?")}</dd>`;
  $("#xlAlt").innerHTML = out.alltag ? `<p class="try" style="background:var(--surface-2);padding:12px;border-radius:8px">${esc(out.alltag)}</p>` : `<p class="muted small">Mit dem ausführlichen Coach (Einstellungen) füllt Claude die Lücken mit deinem Satz und schlägt eine Alltagsfassung vor.</p>`;
}
$("#xlGo").addEventListener("click", async () => {
  const txt = $("#wolfIn").value.trim(); if(!txt) return;
  const a = analyze(txt);
  if(!liveOn()){ renderXL(a, {}); return; }
  $("#xlState").textContent = "Claude übersetzt …"; $("#xlGo").disabled = true;
  try{
    const r = await llmJSON(`Übersetze diesen Satz in Gewaltfreie Kommunikation nach Marshall B. Rosenberg. Erfinde keine Fakten; wo Details fehlen, setze kurze Platzhalter in [eckige Klammern].\nSatz: "${txt}"\nAntworte NUR mit JSON: {"probleme":["kurze, freundliche Hinweise, was der Satz beim Gegenüber auslösen kann"],"o":"Beobachtung","g":"Gefühl","b":"Bedürfnis","r":"Bitte","alltag":"natürliche Alltagsfassung in 1–2 Sätzen"}`, {tier:"quick"});
    renderXL({...a, issues: Array.isArray(r.probleme) && r.probleme.length ? r.probleme : a.issues}, r); $("#xlState").textContent = "";
  }catch(e){ renderXL(a, {}); $("#xlState").textContent = "Claude ist gerade nicht erreichbar – hier das Gerüst."; }
  finally{ $("#xlGo").disabled = false; }
});

/* ===================== Eigenes Szenario ===================== */
let custDraft = null;
radioGroup("#cStart", b => $$("#cStart [role=radio]").forEach(x => x.setAttribute("aria-checked", x === b)));
radioGroup("#cLvl", b => $$("#cLvl [role=radio]").forEach(x => x.setAttribute("aria-checked", x === b)));
function openCustom(){ $("#custForm").hidden = false; $("#custPreview").hidden = true; $("#custState").textContent = ""; $("#dlgCustom").showModal(); $("#cWho").focus(); }
function offlineCustom(f){
  return {titel: ("Gespräch mit " + f.who).slice(0, 60), bereich:"Eigenes", stufe:f.lvl, fokus:"Ehrlicher Ausdruck", kontext:f.what,
    rolle: `${f.who}, ${f.react || "reagiert auf Vorwürfe empfindlich"}`, eroeffnung: f.start === "them" ? "Was gibt's denn?" : "",
    verborgen:{gefuehle:["unsicher","angespannt"], beduerfnisse:["Verständnis","Respekt","Verbindung"]},
    lernziel: f.goal || "Beobachtung, Gefühl, Bedürfnis und eine konkrete Bitte aussprechen – ohne Vorwurf.",
    eskalation:"Bei Vorwurf: wird abwehrend ('Jetzt fang nicht schon wieder so an.'). Bei Empathie: wird offener ('Ja … mir war das auch nicht egal.')."};
}
$("#custForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = {who:$("#cWho").value.trim(), what:$("#cWhat").value.trim(), goal:$("#cGoal").value.trim(), react:$("#cReact").value.trim(),
    start:$("#cStart [aria-checked=true]").dataset.v, lvl:+$("#cLvl [aria-checked=true]").dataset.v};
  if(!f.who || !f.what){ $("#custState").textContent = "Bitte sag, mit wem du sprechen willst und was passiert ist."; return; }
  let sz = null; const btn = $("#custForm [type=submit]");
  if(liveOn()){
    $("#custState").textContent = "Claude baut dein Szenario …"; if(btn) btn.disabled = true;
    try{
      const r = await llmJSON(`Erstelle aus dieser Beschreibung ein Übungsszenario für Gewaltfreie Kommunikation nach Marshall B. Rosenberg. Schwierigkeit ${f.lvl} von 3.
Gegenüber: ${f.who}
Was passiert ist: ${f.what}
Ziel des Übenden: ${f.goal || "(nicht angegeben)"}
Typische Reaktion des Gegenübers: ${f.react || "(nicht angegeben)"}
Wer beginnt: ${f.start === "them" ? "das Gegenüber" : "der Übende"}
Antworte NUR mit JSON: {"titel":"kurzer Titel, max. 6 Wörter","fokus":"z. B. Ehrlicher Ausdruck / Empathie hören / Nein sagen / Bitte statt Forderung","kontext":"2 Sätze in Du-Form aus Sicht des Übenden","rolle":"Name oder Rolle, Beziehung, kurze innere Lage","eroeffnung":"${f.start === "them" ? "erster Satz des Gegenübers, realistisch und leicht angespannt" : ""}","verborgen":{"gefuehle":["2–3"],"beduerfnisse":["2–3"]},"lernziel":"1 Satz","eskalation":"Bei Vorwurf: … ('wörtlicher Satz'). Bei Empathie: … ('wörtlicher Satz')."}`, {tier:"default"});
      sz = {...offlineCustom(f), ...r, bereich:"Eigenes", stufe:f.lvl};
      if(f.start !== "them") sz.eroeffnung = "";
    }catch(err){ sz = null; if(err && err.code === "access") askAccess(); }
    if(btn) btn.disabled = false;
  }
  if(!sz) sz = offlineCustom(f);
  custDraft = sz;
  $("#custForm").hidden = true; $("#custPreview").hidden = false;
  $("#custPreview").innerHTML = `<div class="card stack"><h3>${esc(sz.titel)}</h3><p><b>Situation:</b> ${esc(sz.kontext)}</p><p><b>Dein Gegenüber:</b> ${esc(personName(sz))}</p>
    ${sz.eroeffnung ? `<p><b>Erster Satz:</b> „${esc(sz.eroeffnung)}“</p>` : `<p><b>Du beginnst.</b></p>`}<div class="scene"><div class="goal" style="margin:0"><span class="hand">Lernziel</span><p>${esc(sz.lernziel)}</p></div></div></div>
    <p class="small muted">${liveOn() ? "Claude hat dazu verborgene Gefühle und Bedürfnisse der Figur ergänzt – du siehst sie in der Auswertung." : "Ohne Claude-Verbindung nutzt die Figur einfache Standard-Reaktionen."}</p>
    <div class="actions"><button class="btn" id="custEdit">Ändern</button><button class="btn" id="custTry">Nur üben</button><button class="btn primary" id="custSave">Speichern &amp; üben</button></div>`;
  $("#custEdit").onclick = () => { $("#custForm").hidden = false; $("#custPreview").hidden = true; $("#custState").textContent = ""; };
  const go = save => { const s = {...custDraft, id: (save ? "E" : "T") + Date.now().toString(36)};
    if(save){ const list = customs(); list.push(s); store.setJson("gfk.custom", list); FILTER = "mine"; }
    $("#dlgCustom").close(); renderGallery(); openScenarioObj(s); };
  $("#custTry").onclick = () => go(false); $("#custSave").onclick = () => go(true);
});
function openScenarioObj(s){ SESSION.cur = s; selectTab("t-ueben"); $("#gallery").hidden = true; $("#practice").hidden = false; resetSession(); window.scrollTo({top:0}); }

/* ===================== Einstellungen ===================== */
function renderBrowserVoiceSelects(){
  const opts = browserVoices.map(v => `<option value="${esc(v.name)}">${esc(v.name)}</option>`).join("");
  $("#bvThem").innerHTML = opts; $("#bvCoach").innerHTML = opts;
  if(settings.bvThem) $("#bvThem").value = settings.bvThem; if(settings.bvCoach) $("#bvCoach").value = settings.bvCoach;
  $("#browserVoices").hidden = canTts() || browserVoices.length < 1;
}
function applySettingsUI(){
  const sw = (id, on) => $(id).setAttribute("aria-checked", !!on);
  sw("#swLive", liveOn()); $("#swLive").disabled = !canLive();
  $("#liveSub").textContent = sample || (SERVER && SERVER.coach) ? "Online – Claude gibt ausführliches Feedback." : keys.anthropic && !INSIDE_CLAUDE ? "Online über deinen eigenen Schlüssel." : "Nicht verbunden – es prüft eine einfache Schnellanalyse.";
  sw("#swSelf", settings.selfAssess); sw("#swThem", settings.themVoice); sw("#swCoachVoice", settings.coachVoice); sw("#swFeedback", settings.readFeedback); sw("#swHands", settings.hands);
  $("#optRate").value = settings.rate; $("#rateOut").textContent = rateLabel(settings.rate); $("#rtVoice").value = settings.rtVoice; $("#coachVoice").value = settings.coachTts;
  $("#natVoices").hidden = !(canTts() || canRealtime());
  $("#setAccess").hidden = !(SERVER && SERVER.locked); $("#accessCode").value = accessCode;
  $("#setLocalKeys").hidden = INSIDE_CLAUDE || !!SERVER;
  $("#apiKey").value = keys.anthropic; $("#oaKey").value = keys.openai; $("#ekKey").value = store.get("gfk.ek") || "";
  renderBrowserVoiceSelects();
  if(typeof applyLernSettings === "function") applyLernSettings();
}
function openSettings(section){ applySettingsUI(); $("#dlgSettings").showModal(); if(section === "privacy") $("#setPrivacy").scrollIntoView({block:"start"}); if(section === "access") $("#accessCode").focus(); }
$("#openSettings").addEventListener("click", () => openSettings());
const SW = {"#swLive":"live", "#swSelf":"selfAssess", "#swThem":"themVoice", "#swCoachVoice":"coachVoice", "#swFeedback":"readFeedback", "#swHands":"hands"};
for(const [id, key] of Object.entries(SW)) $(id).addEventListener("click", () => { settings[key] = !settings[key]; saveSettings(); applySettingsUI(); });
function rateLabel(v){ return (+v).toFixed(2).replace(/0$/, "").replace(".", ",") + "×"; }
$("#optRate").addEventListener("input", e => { settings.rate = +e.target.value; $("#rateOut").textContent = rateLabel(settings.rate); saveSettings(); });
$("#rtVoice").addEventListener("change", e => { settings.rtVoice = e.target.value; saveSettings(); });
$("#coachVoice").addEventListener("change", e => { settings.coachTts = e.target.value; saveSettings(); });
$("#bvThem").addEventListener("change", e => { settings.bvThem = e.target.value; saveSettings(); });
$("#bvCoach").addEventListener("change", e => { settings.bvCoach = e.target.value; saveSettings(); });
$("#accessSave").addEventListener("click", () => { accessCode = $("#accessCode").value.trim(); store.set("gfk.access", accessCode); sys("Zugangscode gespeichert."); renderContinue(); });
$("#keysSave").addEventListener("click", () => {
  keys.anthropic = $("#apiKey").value.trim(); keys.openai = $("#oaKey").value.trim();
  keys.anthropic ? store.set("gfk.apikey", keys.anthropic) : store.del("gfk.apikey");
  keys.openai ? store.set("gfk.oakey", keys.openai) : store.del("gfk.oakey");
  const ek = $("#ekKey").value.trim(); ek ? store.set("gfk.ek", ek) : store.del("gfk.ek");
  applySettingsUI(); micUI(); $("#keysSave").textContent = "Gespeichert";
});
$("#wipe").addEventListener("click", () => {
  const b = $("#wipe");
  if(!b.dataset.armed){ b.dataset.armed = "1"; b.textContent = "Wirklich alles löschen?"; return; }
  ["gfk.history","gfk.custom","gfk.quiz","gfk.ku","gfk.emp","gfk.days","gfk.found","gfk.hk","gfk.settings","gfk.level","gfk.mode","gfk.sz","gfk.apikey","gfk.oakey","gfk.ek","gfk.access","gfk.rtConsent"].forEach(k => store.del(k));
  $("#wipeNote").textContent = "Gelöscht. Die Seite startet neu."; setTimeout(() => location.reload(), 900);
});
function askAccess(){
  if(!(SERVER && SERVER.locked)) return;
  sys("Bitte zuerst den Zugangscode eingeben.");
  if(!$("#dlgSettings").open) openSettings("access");
}

/* ===================== Start ===================== */
function init(){
  setLevel(LEVEL); setMode(MODE); renderGallery(); applySettingsUI();
  const h = (location.hash || "").slice(1);
  if(["hoeren","quiz","karten","xl","cheat","weg"].includes(h)) selectTab("t-" + h);
  (async () => {
    if(INSIDE_CLAUDE){
      try{ sample = await window.claude.use("sample"); }catch(e){ sample = null; }
    } else if(/^https?:$/.test(location.protocol)){
      try{ const r = await fetch("/api/config", {cache:"no-store"}); if(r.ok){ const d = await r.json(); if(d && d.server) SERVER = d; } }catch(e){}
    }
    applySettingsUI(); micUI(); renderContinue();
  })();
}
/* init() wird am Ende von lernen.js aufgerufen, damit alle Teile geladen sind. */
