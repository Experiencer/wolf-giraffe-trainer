/* ======================================================================
   Lernen (v6): Kurzübungen mit Sprachmodus, Empathisch zuhören, Lernkarten,
   Spickzettel mit Hörkarten, kleine Feiern, Übungstage, Entdeckungen, Mein Weg.
   Wird nach engine.js und ui.js eingebunden (gleicher <script>-Block).
   ====================================================================== */

/* ===================== Hilfen ===================== */
const KU_BY = Object.fromEntries(KU.uebungen.map(u => [u.id, u]));
const SPICK_BY = Object.fromEntries(SPICK.map(s => [s.id, s]));
const TYP_NAME = {wahl:"Einordnen", umformulieren:"Umformulieren", schritte:"Schritt für Schritt"};
const REDUCED = () => { try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
const pick = a => a[Math.floor(Math.random() * a.length)];
function shuffle(a){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const refocus = sel => requestAnimationFrame(() => { const el = typeof sel === "string" ? $(sel) : sel; if(el){ if(!el.matches("button,a,input,textarea,select,[tabindex]")) el.setAttribute("tabindex", "-1"); el.focus({preventScroll:true}); } });
const genitiv = n => /[sßxz]$/i.test(n) ? n + "’" : n + "s";
const joinDe = a => a.length > 1 ? a.slice(0, -1).join(", ") + " und " + a[a.length - 1] : (a[0] || "");
/* Kontext in Klammern am Satzanfang abtrennen: „(Chefin: …) Satz“ */
function splitCtx(t){ const m = String(t || "").match(/^\(([^)]*)\)\s*([\s\S]*)$/); return m ? {ctx:m[1].trim(), main:m[2].trim()} : {ctx:"", main:String(t || "")}; }
/* Text für die Sprachausgabe säubern */
function speechText(s){
  return String(s || "").replace(/^\(([^)]*)\)\s*/, "$1. ").replace(/[„“"»«]/g, "").replace(/[()[\]]/g, ", ")
    .replace(/\bz\.\s?B\./g, "zum Beispiel").replace(/\bd\.\s?h\./g, "das heißt").replace(/§\s?/g, "Abschnitt ")
    .replace(/\s?→\s?/g, ": ").replace(/\s\/\s|\//g, " oder ").replace(/…/g, " ").replace(/\s{2,}/g, " ").trim();
}
/* Wortschatz der Schnellanalyse um die Lernkarten-Wörter erweitern */
(function extendLexicon(){
  const f = new Set(FEEL), n = new Set(NEEDS);
  [...LK.gefuehle.erfuellt, ...LK.gefuehle.unerfuellt].forEach(g => g.woerter.forEach(x => f.add(x.w.toLowerCase())));
  LK.beduerfnisse.forEach(b => b.woerter.forEach(x => { const w = x.w.toLowerCase(); if(w.length >= 5 && w !== "spiel") n.add(w); }));
  FEEL.length = 0; FEEL.push(...f); NEEDS.length = 0; NEEDS.push(...n);
})();

/* ===================== Feiern, Töne, Hinweise ===================== */
let actx = null;
function chime(){
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime + 0.02;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = t0 + i * 0.09;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.55);
    });
  }catch(e){}
}
/* Kurze Feier: Farbschimmer am Element, Konfetti nur wenn erlaubt (Einstellung + System „Bewegung reduzieren“) */
function celebrate(target, size = "big"){
  if(target){ target.classList.add("done"); target.classList.remove("glow"); void target.offsetWidth; target.classList.add("glow"); }
  if(settings.sound) chime();
  if(!settings.anim || REDUCED() || size === "none") return;
  const box = $("#confetti"); if(!box) return;
  const n = size === "big" ? 44 : 16;
  const colors = ["#FC4700", "#F2B705", "#2E8B57", "#B83C00", "#5DA9E9", "#D9608F"];
  const r = target ? target.getBoundingClientRect() : {left: innerWidth / 2 - 120, width: 240, top: innerHeight / 3};
  const top = Math.max(0, Math.min(innerHeight - 40, r.top + 8));
  for(let i = 0; i < n; i++){
    const s = document.createElement("i");
    s.style.left = (r.left + 20 + Math.random() * Math.max(40, r.width - 40)) + "px";
    s.style.top = top + "px";
    s.style.background = colors[i % colors.length];
    s.style.setProperty("--dx", (Math.random() * 260 - 130).toFixed(0) + "px");
    s.style.setProperty("--dy", (140 + Math.random() * 260).toFixed(0) + "px");
    s.style.setProperty("--rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
    s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
    s.style.animationDuration = (0.9 + Math.random() * 0.6).toFixed(2) + "s";
    if(i % 3 === 0) s.className = "round";
    box.append(s);
  }
  clearTimeout(celebrate.t); celebrate.t = setTimeout(() => { box.innerHTML = ""; }, 1900);
}
let toastT = null;
function toast(html){ const el = $("#toast"); if(!el) return; el.innerHTML = html; clearTimeout(toastT); toastT = setTimeout(() => { el.innerHTML = ""; }, 6000); }
$("#toast")?.addEventListener("click", () => { $("#toast").innerHTML = ""; });

/* ===================== Übungstage (ohne Serien) & Entdeckungen ===================== */
function weekDays(){
  const now = new Date(), mon = new Date(now); mon.setHours(12, 0, 0, 0); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return dayKey(d); });
}
function markDay(){
  const days = store.json("gfk.days", []), k = dayKey();
  if(days.includes(k)) return;
  days.push(k); store.setJson("gfk.days", days.slice(-400));
  const wk = weekDays(), n = wk.filter(d => days.includes(d)).length, goal = +settings.weekGoal || 3;
  if(settings.days && n === Math.min(goal, 7) && store.get("gfk.weekDone") !== wk[0]){
    store.set("gfk.weekDone", wk[0]);
    setTimeout(() => toast(`<b>Dein Wochenrhythmus ist erfüllt.</b> Diese Woche hast du an ${n} ${n === 1 ? "Tag" : "Tagen"} geübt – Pausen sind jederzeit okay.`), 1600);
  }
}
const FOUND = {
  klar:    {t:"Ganz klar",            d:"Eine Kurzübung komplett sicher eingeordnet."},
  mix:     {t:"Gut gemischt",         d:"Die gemischte Runde vollständig auseinandergehalten."},
  ohr:     {t:"Offene Ohren",         d:"Deine Vermutung hat jemanden erreicht."},
  angriff: {t:"Hinter dem Angriff",   d:"Bei einem Vorwurf das Bedürfnis dahinter gehört."},
  selbst:  {t:"Freundlich mit dir",   d:"Dir selbst Empathie gegeben."},
  dank:    {t:"Dank statt Lob",       d:"Einen Dank in drei Teilen geübt."},
  hoeren:  {t:"Unterwegs gelernt",    d:"Drei Hörkarten angehört."},
  vielfalt:{t:"Viele Wege",           d:"In allen fünf Themenbereichen geübt."},
  frei:    {t:"Ohne Netz",            d:"Ein Gespräch in der Stufe „Frei“ geführt."}
};
function discover(id){
  const f = store.json("gfk.found", {});
  if(f[id] || !FOUND[id]) return;
  f[id] = Date.now(); store.setJson("gfk.found", f);
  setTimeout(() => toast(`<b>Entdeckt: ${esc(FOUND[id].t)}</b> ${esc(FOUND[id].d)} <span class="xs">Alle Entdeckungen findest du in „Mein Weg“.</span>`), 900);
}

/* ===================== Stimme fürs Lernen (Hören & Sprechen) ===================== */
const SRL = window.SpeechRecognition || window.webkitSpeechRecognition;
const canListen = () => !!SRL && !INSIDE_CLAUDE;
let lrec = null, vtoken = 0;
function stopListenL(){ if(lrec){ const r = lrec; lrec = null; try{ r.abort(); }catch(e){} } $$("[data-listening]").forEach(b => b.removeAttribute("data-listening")); }
function stopVoiceLearning(){ vtoken++; stopListenL(); try{ hushAll(); }catch(e){} }
function micErrText(e){
  if(["not-allowed", "service-not-allowed", "audio-capture"].includes(e)) return "Das Mikrofon ist nicht freigegeben. Erlaube es über das Schloss-Symbol in der Adresszeile – oder antworte per Tippen.";
  if(e === "no-speech") return "Ich habe nichts gehört. Tippe aufs Mikrofon und sprich noch einmal.";
  if(e === "network") return "Die Spracherkennung braucht eine Internetverbindung.";
  if(e === "unavailable") return "Dein Browser erlaubt hier keine Spracherkennung – tippe deine Antwort.";
  return "Die Spracherkennung hat gerade nicht geklappt. Du kannst tippen.";
}
/* Einmal zuhören. interim(text) während des Sprechens, final(text) am Ende, error(code) bei Problemen. */
function listenL({interim, final, error, btn} = {}){
  if(!canListen()){ error && error("unavailable"); return; }
  stopListenL(); try{ hushAll(); }catch(e){}
  let fin = "", failed = false;
  let r; try{ r = new SRL(); }catch(e){ error && error("start"); return; }
  lrec = r; r.lang = "de-DE"; r.interimResults = true; r.continuous = false;
  r.onresult = e => { let im = ""; for(let i = e.resultIndex; i < e.results.length; i++){ const x = e.results[i]; if(x.isFinal) fin += x[0].transcript; else im += x[0].transcript; } interim && interim((fin + " " + im).trim()); };
  r.onerror = e => { failed = true; if(e.error !== "aborted") error && error(e.error); };
  r.onend = () => { const mine = lrec === r; if(mine) lrec = null; btn && btn.removeAttribute("data-listening"); if(!failed && mine) final && final(fin.trim()); };
  try{ r.start(); btn && btn.setAttribute("data-listening", "1"); }catch(e){ lrec = null; error && error("start"); }
}
/* Sprechen mit Coach-Stimme; „then“ läuft nur, wenn inzwischen nichts anderes passiert ist */
async function voiceSay(text, then){
  const tok = ++vtoken;
  await speak(speechText(text), "coach");
  if(tok === vtoken && then) setTimeout(() => { if(tok === vtoken) then(); }, 300);
}
function voiceCmd(t){
  const words = String(t || "").trim().split(/\s+/).filter(Boolean);
  if(!words.length || words.length > 3) return "";
  const s = " " + String(t || "").toLowerCase().replace(/[.,!?]/g, "") + " ";
  if(/ (nochmal|noch mal|wiederholen|wiederhole|wie bitte) /.test(s)) return "repeat";
  if(/ (stopp|stop|aufhören|beenden|stimme aus) /.test(s)) return "stop";
  if(/^ (weiter|nächster|nächste|nächstes|okay weiter) $/.test(s)) return "next";
  return "";
}
const MIC_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>`;
const micBtn = (id, label = "Sprechen") => canListen() ? `<button class="btn lmic" type="button" id="${id}" aria-label="${esc(label)}">${MIC_SVG}<span class="hide-sm">${esc(label)}</span></button>` : "";

/* ===================== Kurzübungen ===================== */
let KZ = null;
const LV = [["neu", "○"], ["entdeckt", "◔"], ["geübt", "◐"], ["sicher", "●"]];
function kuStore(){
  const s = store.json("gfk.ku", null); if(s) return s;
  const old = store.json("gfk.quiz", {}), m = {};
  for(const k in old) m[k] = {runs:1, best:old[k].best, total:old[k].total, clear: old[k].best === old[k].total, last:0};
  return m;
}
function kuLevel(id, typ){
  const r = kuStore()[id]; if(!r || !r.runs) return 0;
  if(r.clear) return 3;
  if(typ === "schritte") return r.runs >= 2 ? 2 : 1;
  return (r.best || 0) / (r.total || 1) >= 0.7 ? 2 : 1;
}
const pie = l => `<svg class="pie" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${l >= 3 ? `<circle cx="8" cy="8" r="6.5" fill="currentColor"/>` : l === 2 ? `<path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/>` : l === 1 ? `<path d="M8 8V1.5A6.5 6.5 0 0 1 14.5 8z" fill="currentColor"/>` : ""}</svg>`;
const lvlTag = l => l ? `<span class="lvltag l${l}">${pie(l)} ${LV[l][0]}</span>` : "";
function deckCard(u){
  return `<button class="scard" data-deck="${u.id}"><span class="meta">${esc(u.dauer || "")} · ${TYP_NAME[u.typ]}</span><h3>${esc(u.titel)}</h3><span class="focus clamp">${esc(u.intro)}</span>${lvlTag(kuLevel(u.id, u.typ))}</button>`;
}
function renderDecks(){
  $("#deckgrid").innerHTML = `<div class="deckgrid"><button class="scard mixcard" data-deck="MIX"><span class="meta">4 Min. · Gemischt</span><h3>Gemischte Runde</h3><span class="focus clamp">Zehn Sätze aus allen Einordnungs-Übungen. Das Abwechseln schärft den Blick für Unterschiede.</span>${lvlTag(kuLevel("MIX", "wahl"))}</button></div>`
    + KU.gruppen.map(g => `<section class="kugroup" aria-labelledby="kg-${g.id}"><h2 class="section-title" id="kg-${g.id}">${esc(g.titel)} <span class="muted small sub">${esc(g.sub)}</span></h2><div class="deckgrid">${KU.uebungen.filter(u => u.gruppe === g.id).map(deckCard).join("")}</div></section>`).join("");
  kuHowUI();
}
function kuHowUI(){
  $$("#kuHow [role=radio]").forEach(b => b.setAttribute("aria-checked", (b.dataset.how === "voice") === !!settings.kuVoice));
  const n = $("#kuHowNote");
  n.textContent = !settings.kuVoice ? "" : canListen()
    ? "Die App liest vor, du antwortest mit deiner Stimme. „Nochmal“ wiederholt, „Stopp“ beendet die Stimme. Tippen geht immer."
    : "Die App liest vor. Antworten per Stimme erlaubt dieser Browser hier nicht – du tippst deine Antwort.";
}
radioGroup("#kuHow", b => { settings.kuVoice = b.dataset.how === "voice"; saveSettings(); kuHowUI(); });
$("#deckgrid").addEventListener("click", e => { const b = e.target.closest("[data-deck]"); if(b) startDeck(b.dataset.deck); });

function startDeck(id, only){
  stopVoiceLearning();
  let u, queue;
  if(id === "MIX"){
    u = {id:"MIX", titel:"Gemischte Runde", typ:"wahl", mix:true, gruppe:"mix",
      ansage:"Gemischte Runde. Du hörst zehn Sätze aus verschiedenen Übungen. Ich sage dir jeweils dazu, worum es geht.",
      merksatz:"Unterscheiden ist die halbe Übersetzung: Wer Wolf erkennt, kann Giraffe wählen."};
    const pool = []; KU.uebungen.filter(x => x.typ === "wahl").forEach(x => x.items.forEach((_, i) => pool.push({u:x, i})));
    queue = only || shuffle(pool).slice(0, 10);
  } else {
    u = KU_BY[id]; if(!u) return;
    queue = only || (u.typ === "schritte" ? [] : u.typ === "wahl" ? shuffle(u.items.map((_, i) => ({u, i}))) : u.items.map((_, i) => ({u, i})));
  }
  KZ = {u, queue, pos:0, right:0, wrong:[], rates:[], answered:false, step:-1, answers:{}, full:!only, intro:true, voice:!!settings.kuVoice, token:0};
  $("#quizHome").hidden = true; $("#quizRun").hidden = false;
  renderKZ(); window.scrollTo({top:0});
}
function kzHome(){ const last = KZ && KZ.u.id; stopVoiceLearning(); KZ = null; $("#quizRun").hidden = true; $("#quizHome").hidden = false; renderDecks(); if(last) refocus(`[data-deck="${last}"]`); }
function renderKZ(){
  vtoken++; stopListenL();
  if(KZ.u.typ === "schritte") return renderSchritte();
  if(KZ.pos >= KZ.queue.length) return KZ.u.typ === "wahl" ? endWahl() : endUmf();
  KZ.u.typ === "wahl" ? renderWahl() : renderUmf();
}
function nextKZ(){ if(!KZ) return; KZ.pos++; renderKZ(); }
const voiceToggle = () => `<button class="btn ghost small" data-kz="voice" aria-pressed="${KZ.voice}" title="Vorlesen und mit Stimme antworten">${KZ.voice ? "Stimme: an" : "Stimme: aus"}</button>`;
function kzTop(label){
  const n = KZ.queue.length;
  return `<div class="row"><button class="btn ghost small" data-kz="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Übersicht</button><span class="grow"></span>${voiceToggle()}<span class="xs muted">${label || `${KZ.pos + 1} von ${n}`}</span></div>
    ${n ? `<div class="progress" aria-hidden="true"><i style="width:${KZ.pos / n * 100}%"></i></div>` : ""}`;
}
const stmtHTML = t => { const {ctx, main} = splitCtx(t); return `${ctx ? `<p class="ctx">${esc(ctx)}</p>` : ""}<p class="stmt">${esc(main)}</p>`; };
const kzNote = msg => { const n = $("#kzNote"); if(n) n.textContent = msg || ""; const h = $("#kzHeard"); if(h) h.textContent = ""; };
const kzHeard = t => { const h = $("#kzHeard"); if(h) h.textContent = t ? "„" + t + "“" : ""; };
const kzHead = (u, extra) => `<h2 class="kzq" id="kzQ" tabindex="-1">${esc(extra || u.aufgabe || u.frage || u.titel)}</h2>${KZ.pos === 0 && KZ.full && u.intro && !KZ.u.mix ? `<p class="small muted kzintro">${esc(u.intro)}</p>` : ""}`;

/* ---------- Typ „wahl“ ---------- */
const OK_WORDS = ["Stimmt.", "Genau.", "Ja, das passt."];
function renderWahl(){
  const e = KZ.queue[KZ.pos], u = e.u, it = u.items[e.i], n = u.optionen.length;
  $("#quizRun").innerHTML = kzTop() + kzHead(u, KZ.u.mix ? u.titel + " · " + (u.frage || "") : (u.frage || u.titel)) + stmtHTML(it.t) + `
    <div class="answers n${n}" role="group" aria-label="Antwort wählen">${u.optionen.map((o, k) => `<button class="btn ans" data-ans="${o.id}" aria-keyshortcuts="${k + 1}"><span class="key" aria-hidden="true">${k + 1}</span><span>${esc(o.text)}</span></button>`).join("")}</div>
    ${KZ.voice && canListen() ? `<div class="row"><button class="btn small lmic" id="kzListen">${MIC_SVG}Zuhören</button><p class="note grow" id="kzNote" role="status"></p></div><p class="note" id="kzHeard"></p>` : `<p class="note" id="kzNote" role="status"></p>`}
    <div id="qFb" role="status"></div>`;
  KZ.answered = false;
  if(!KZ.voice) refocus("#kzQ");
  if(KZ.voice) voiceWahl(true);
}
async function voiceWahl(withIntro){
  const e = KZ.queue[KZ.pos], u = e.u, it = u.items[e.i], tok = ++vtoken;
  let pre = "";
  if(withIntro && KZ.intro){ KZ.intro = false; pre = (KZ.u.ansage || "") + " "; }
  if(KZ.u.mix) pre += (u.frage || u.titel) + " ";
  kzNote("Ich lese vor …");
  await speak(speechText(pre + it.t), "coach");
  if(tok !== vtoken || KZ.answered) return;
  if(canListen()) listenOption(tok, 0); else kzNote("Tippe deine Antwort an.");
}
const ORD = [["eins", "1", "erste", "erstens"], ["zwei", "2", "zweite", "zweitens"], ["drei", "3", "dritte"], ["vier", "4", "vierte"], ["fünf", "5", "fünfte"], ["sechs", "6", "sechste"]];
function matchOption(u, t){
  const s = " " + String(t || "").toLowerCase().replace(/[.,!?;:„“"]/g, " ").replace(/\s+/g, " ") + " ";
  let best = null, bestLen = 0;
  u.optionen.forEach((o, k) => {
    const cands = [...(o.sprich || []), o.text.toLowerCase(), ...(ORD[k] || [])];
    cands.forEach(c => { if(c && new RegExp("(^|\\s)" + escRe(c.toLowerCase()) + "(\\s|$)").test(s) && c.length > bestLen){ best = o.id; bestLen = c.length; } });
  });
  return best;
}
function listenOption(tok, tries){
  const e = KZ.queue[KZ.pos], u = e.u;
  kzNote("Ich höre zu …");
  listenL({btn: $("#kzListen"), interim: t => kzHeard(t),
    final: t => {
      if(tok !== vtoken || !KZ || KZ.answered) return;
      const cmd = voiceCmd(t);
      if(cmd === "repeat") return voiceWahl(false);
      if(cmd === "stop") return setKzVoice(false);
      const id = matchOption(u, t);
      if(id) return answerWahl(id);
      if(!t){ kzNote("Ich habe nichts gehört. Tippe auf „Zuhören“ oder wähle eine Antwort."); return; }
      if(tries < 1) voiceSay(`Das konnte ich nicht zuordnen. Sag zum Beispiel ${u.optionen.slice(0, 3).map(o => o.text).join(" oder ")}.`, () => listenOption(vtoken, tries + 1));
      else kzNote(`„${t}“ konnte ich nicht zuordnen. Tippe deine Antwort an oder sag „nochmal“.`);
    },
    error: er => { if(tok === vtoken) kzNote(micErrText(er)); }});
}
function answerWahl(id){
  if(!KZ || KZ.answered) return;
  KZ.answered = true; stopListenL();
  const e = KZ.queue[KZ.pos], u = e.u, it = u.items[e.i], ok = id === it.ans, opt = u.optionen.find(o => o.id === it.ans);
  if(ok) KZ.right++; else KZ.wrong.push(e);
  $$("#quizRun [data-ans]").forEach(x => { x.disabled = true; if(x.dataset.ans === it.ans) x.classList.add("is-ok"); else if(x.dataset.ans === id) x.classList.add("is-part"); });
  $("#qFb").innerHTML = `<div class="fb ${ok ? "ok" : "part"}"><p><b>${pie(ok ? 3 : 2)} ${ok ? pick(OK_WORDS) : `Eher: ${esc(opt.text)}.`}</b> ${esc(it.why)}</p>${it.giraffe ? `<p class="giraffe"><span class="hand">Giraffe:</span> ${esc(it.giraffe)}</p>` : ""}</div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="qNext">${KZ.pos + 1 < KZ.queue.length ? "Weiter" : "Zum Abschluss"}</button><span class="xs muted hide-sm">oder Enter</span></div>`;
  $("#qNext").focus({preventScroll:true});
  $("#qFb").scrollIntoView({block:"nearest", behavior: REDUCED() ? "auto" : "smooth"});
  if(KZ.voice) voiceSay((ok ? "Stimmt. " : `Eher ${opt.text}. `) + it.why + (it.giraffe && !ok ? " Giraffe könnte sagen: " + it.giraffe : ""), nextKZ);
}
function saveKu(id, rec){
  const s = kuStore(), prev = s[id] || {runs:0, best:0, total:0, clear:false};
  s[id] = {runs: prev.runs + 1, best: Math.max(prev.best || 0, rec.best || 0), total: rec.total || prev.total, clear: !!(prev.clear || rec.clear), last: Date.now()};
  store.setJson("gfk.ku", s); markDay();
  const groups = new Set(Object.keys(s).filter(k => s[k].runs && KU_BY[k]).map(k => KU_BY[k].gruppe));
  if(KU.gruppen.every(g => groups.has(g.id))) discover("vielfalt");
}
const DANK_ALL = [
  n => `Du hast alle ${n} Sätze klar eingeordnet. Wer diese Unterscheidung so sicher trifft, kann im echten Gespräch leichter innehalten und wählen.`,
  n => `Bei allen ${n} Sätzen hast du den Unterschied gesehen. Das ist die Grundlage, um Wolf und Giraffe auseinanderzuhalten.`,
  n => `Jeder der ${n} Sätze saß. Mich freut, wie klar diese Unterscheidung für dich schon ist.`
];
function endWahl(){
  stopListenL();
  const n = KZ.queue.length, r = KZ.right, all = r === n, u = KZ.u;
  if(KZ.full) saveKu(u.id, {best:r, total:n, clear:all});
  const sp = u.spick && SPICK_BY[u.spick];
  const dank = all ? pick(DANK_ALL)(n) : r >= n * 0.7
    ? `Du hast ${r} von ${n} Sätzen klar eingeordnet. Bei ${n - r} lohnt sich ein zweiter Blick – genau dort lernst du am meisten.`
    : r === 0 ? "Diese Unterscheidung ist knifflig. Eine zweite Runde – vielleicht mit dem Spickzettel daneben – macht sie dir vertrauter."
    : `Du hast dich durch alle ${n} Sätze gearbeitet. Bei ${r} war es schon klar – die anderen noch einmal zu üben, festigt am meisten.`;
  const head = all ? "Alles klar eingeordnet" : r >= n * 0.7 ? "Fast alles klar" : "Eine knifflige Unterscheidung";
  $("#quizRun").innerHTML = kzTop(" ") + `<div class="kzend card stack${all ? " done" : ""}" tabindex="-1">
      <h2 class="section-title" style="margin:0">${esc(u.titel)}</h2>
      <p class="bigline">${pie(all ? 3 : 2)} ${head}</p>
      <p>${esc(dank)}</p>
      ${u.merksatz ? `<p class="merk"><span class="hand">Zum Mitnehmen:</span> ${esc(u.merksatz)}</p>` : ""}
      <div class="row">${KZ.wrong.length ? `<button class="btn primary" data-kz="wrong">Die ${KZ.wrong.length} offenen nochmal</button>` : `<button class="btn primary" data-kz="again">Nochmal mischen</button>`}<button class="btn" data-kz="home">Andere Übung</button>${sp ? `<button class="btn ghost" data-spick="${sp.id}">Spickzettel: ${esc(sp.titel)}</button>` : ""}</div>
    </div>`;
  const card = $(".kzend"); card.focus({preventScroll:true});
  if(all){ celebrate(card, KZ.full ? "big" : "small"); if(KZ.full) discover(u.mix ? "mix" : "klar"); }
  if(KZ.voice) voiceSay(dank + (u.merksatz ? " Zum Mitnehmen: " + u.merksatz : ""));
}

/* ---------- Typ „umformulieren“ ---------- */
function renderUmf(){
  const e = KZ.queue[KZ.pos], u = e.u, it = u.items[e.i];
  $("#quizRun").innerHTML = kzTop() + kzHead(u) + `${stmtHTML(it.t)}
    <div class="field"><label for="kzIn">Deine Fassung</label>
      <div class="inputrow"><textarea id="kzIn" rows="3" placeholder="${canListen() ? "Schreib oder sprich deine Fassung …" : "Schreib deine Fassung …"}"></textarea>${micBtn("kzMic")}</div></div>
    <div class="row"><button class="btn primary" id="kzCheck">Vergleichen</button>${it.tipp ? `<button class="linkbtn" id="kzTip" aria-expanded="false">Tipp</button>` : ""}<span class="grow"></span><button class="btn ghost small" id="kzSkip">Gleich Vorschläge ansehen</button></div>
    ${it.tipp ? `<p class="notice" id="kzTipT" hidden><span class="hand">Tipp:</span> ${esc(it.tipp)}</p>` : ""}
    <p class="note" id="kzNote" role="status"></p><div id="kzRes"></div>`;
  if(KZ.voice) voiceUmf(true); else refocus("#kzQ");
}
async function voiceUmf(withIntro){
  const e = KZ.queue[KZ.pos], u = e.u, it = u.items[e.i], tok = ++vtoken;
  let pre = ""; if(withIntro && KZ.intro){ KZ.intro = false; pre = (u.ansage || "") + " "; }
  kzNote("Ich lese vor …");
  await speak(speechText(pre + (u.aufgabe || "") + " " + it.t), "coach");
  if(tok !== vtoken) return;
  if(canListen()) listenUmf(tok); else kzNote("Schreib deine Fassung und tippe auf „Vergleichen“.");
}
function listenUmf(tok){
  kzNote("Ich höre zu – sprich deine Fassung.");
  listenL({btn: $("#kzMic"), interim: t => { $("#kzIn").value = t; },
    final: t => {
      if(tok !== vtoken || !KZ) return;
      const cmd = voiceCmd(t);
      if(cmd === "repeat") return voiceUmf(false);
      if(cmd === "stop") return setKzVoice(false);
      if(!t){ kzNote("Ich habe nichts gehört. Tippe aufs Mikrofon oder schreib deine Fassung."); return; }
      $("#kzIn").value = t; checkUmf(true);
    },
    error: er => { if(tok === vtoken) kzNote(micErrText(er)); }});
}
const hasWord = (low, w) => w && new RegExp("(^|[^a-zäöüß])" + escRe(w.toLowerCase())).test(low);
function quickCheck(check, text, warn){
  if(!text) return null;
  const low = text.toLowerCase(), a = analyze(text), good = [], next = [], sp = " " + low + " ";
  const w = (warn || []).filter(x => hasWord(low, x));
  const concrete = /\d|\b(uhr|gestern|heute|morgen|vorhin|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|woche|minuten|stunden|mal|seit|abends|morgens|letzte|letzten)\b/.test(low);
  const isQ = /\?\s*$/.test(text.trim()) || a.empathy;
  switch(check){
    case "beobachtung":
      if(!WOLF[0][0].test(sp) && !WOLF[1][0].test(sp)) good.push("ohne Verallgemeinerung und ohne Etikett");
      if(concrete) good.push("mit konkreten Angaben"); else next.push("eine Zeit, eine Zahl oder einen Ort ergänzen – so wird es überprüfbar");
      break;
    case "gefuehl":
      if(a.fw) good.push(`ein echtes Gefühl („${a.fw}“)`);
      if(a.pseudo && !a.fw) next.push(`„${a.pseudo}“ deutet noch, was der andere tut`);
      else if(!a.fw) next.push("ein Gefühlswort, das nur dich beschreibt – zum Beispiel traurig, angespannt oder erschöpft");
      if(a.nw) good.push(`ein Bedürfnis („${a.nw}“)`);
      break;
    case "beduerfnis":
      if(a.nw) good.push(`ein Bedürfnis („${a.nw}“)`);
      if(/\b(brauche|will|möchte),? dass (du|sie|ihr|er)\b/.test(low)) next.push("„… dass du …“ beschreibt noch eine Strategie");
      else if(!a.nw && !/wichtig|brauche|wünsche/.test(low)) next.push("sagen, was dir wichtig ist – ohne bestimmte Person");
      break;
    case "bitte":
      if(isQ) good.push("als Frage – ein Nein bleibt möglich"); else next.push("als Frage formulieren, auf die auch ein Nein okay wäre");
      if(/\b(nicht mehr|nie wieder|hör auf|aufhören|lass das)\b/.test(low)) next.push("positiv sagen, was du dir wünschst, statt was aufhören soll");
      if(concrete || /\b(bis|ab|um|bevor|nach dem)\b/.test(low)) good.push("mit konkretem Zeitpunkt oder Umfang");
      break;
    case "empathie":
      if(isQ || /^(klingt|hört sich)/.test(low.trim())) good.push("als Vermutung angeboten, nicht behauptet"); else next.push("als Frage formulieren: „Bist du …?“ oder „Klingt, als …?“");
      if(a.fw) good.push(`ein Gefühl vermutet („${a.fw}“)`);
      if(a.nw) good.push(`ein Bedürfnis vermutet („${a.nw}“)`);
      break;
    case "dank":
      if(a.nw) good.push(`ein erfülltes Bedürfnis („${a.nw}“)`);
      if(a.fw) good.push(`dein Gefühl („${a.fw}“)`);
      if(!a.nw && !a.fw) next.push("sagen, was die Handlung für dich bedeutet hat – Gefühl oder Bedürfnis");
      break;
    case "entscheidung":
      if(!/\b(muss|müsste|sollte|soll)\b/.test(low)) good.push("als eigene Wahl formuliert");
      if(a.nw || /\b(weil|damit|um|dann)\b/.test(low)) good.push("mit einem Grund, der dir wichtig ist");
      break;
    case "alltag":
      if(!/bedürfnis nach|wärst du bereit|wenn ich sehe, dass|fühle ich mich/.test(low)) good.push("ohne Lehrbuch-Floskeln"); else next.push("eine Lehrbuch-Floskel durch deine eigenen Worte ersetzen");
      break;
  }
  if(w.length) next.unshift(`„${w[0]}“ steckt noch drin – geht es auch ohne?`);
  if(!good.length) good.push("Du hast es in eigenen Worten versucht – das ist der wichtigste Schritt");
  return {good, next: next[0] || ""};
}
/* Erst selbst einschätzen, dann Schnellhinweis und Vorschläge (Produktprinzip „Feedback stärkt“) */
async function checkUmf(fromVoice){
  const text = ($("#kzIn")?.value || "").trim();
  if(text && await kriseVorab(text)) return;
  stopListenL();
  $("#kzCheck").disabled = true; $("#kzSkip").hidden = true;
  if(!text) return revealUmf(fromVoice);
  $("#kzRes").innerHTML = `<div class="field selfrate"><span class="lbl" id="kzRateLbl">Bevor du Vorschläge siehst: Wie sitzt deine Fassung für dich?</span>
      <div class="seg" role="radiogroup" aria-labelledby="kzRateLbl" id="kzRate"><button role="radio" aria-checked="false" data-rate="3">Sitzt</button><button role="radio" aria-checked="false" data-rate="2">Fast</button><button role="radio" aria-checked="false" data-rate="1">Noch unsicher</button></div>
      <button class="linkbtn" data-kz="reveal">Ohne Einschätzung weiter</button></div>`;
  if(KZ.voice) voiceSay("Wie sitzt deine Fassung für dich? Sag sitzt, fast oder unsicher.", () => listenRate(vtoken));
  else refocus("#kzRate [data-rate]");
}
function revealUmf(fromVoice){
  const e = KZ.queue[KZ.pos], u = e.u, it = u.items[e.i], text = ($("#kzIn")?.value || "").trim();
  const q = quickCheck(u.check, text, it.warn), m = it.muster || [], lab = u.check === "alltag" ? ["Kurz", "Ausführlicher"] : ["Lernform", "Alltag"];
  const r = KZ.rates[KZ.pos];
  $("#kzRes").innerHTML = `${r ? `<p class="small muted">Deine Einschätzung: <b>${["", "noch unsicher", "fast", "sitzt"][r]}</b></p>` : ""}
    ${q ? `<div class="fb"><p><b>Schon da:</b> ${esc(q.good.join(", "))}.</p>${q.next ? `<p><b>Magst du noch:</b> ${esc(q.next)}${/[?.!]$/.test(q.next) ? "" : "?"}</p>` : ""}<p class="xs muted">Schnellhinweis – er prüft nur Wörter, nicht die Absicht. Dein Gefühl für den Satz zählt mehr.</p></div>` : ""}
    <div class="muster stack"><p class="xs muted">So könnte es klingen</p>${m[0] ? `<p><span class="tag">${lab[0]}</span>${esc(m[0])}</p>` : ""}${m[1] ? `<p><span class="tag alt">${lab[1]}</span>${esc(m[1])}</p>` : ""}</div>
    ${it.pruef && it.pruef.length ? `<div class="pruef"><p class="xs muted">Prüf deine Fassung</p><ul>${it.pruef.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}
    ${liveOn() && text ? `<div><button class="btn coach small" id="kzCoach">Coach um Rückmeldung bitten</button><div id="kzCoachOut" role="status"></div></div>` : ""}
    <div class="row"><button class="btn primary" id="kzNext">${KZ.pos + 1 < KZ.queue.length ? "Weiter" : "Zum Abschluss"}</button></div>`;
  if(KZ.voice){
    const say = (q ? `Schon da: ${q.good[0]}. ${q.next ? "Vielleicht noch: " + q.next + " " : ""}` : "") + `So könnte es klingen: ${m[1] || m[0] || ""}. Sag weiter, wenn du bereit bist.`;
    voiceSay(say, () => listenNext(vtoken));
  } else if(!fromVoice) refocus("#kzRes .fb, #kzRes .muster");
}
function listenNext(tok){
  if(!canListen()) return;
  kzNote("Sag „weiter“ – oder tippe auf „Weiter“.");
  listenL({interim: t => kzHeard(t), final: t => {
    if(tok !== vtoken || !KZ) return;
    const c = voiceCmd(t);
    if(c === "next") return nextKZ();
    if(c === "stop") return setKzVoice(false);
    if(c === "repeat") return revealUmf(true);
    kzNote("Tippe auf „Weiter“, wenn du bereit bist.");
  }, error: er => { if(tok === vtoken) kzNote(micErrText(er)); }});
}
function listenRate(tok){
  if(!canListen()) return;
  kzNote("Sitzt, fast oder unsicher?");
  listenL({interim: t => kzHeard(t), final: t => {
    if(tok !== vtoken || !KZ) return;
    const s = " " + t.toLowerCase().replace(/[.,!?]/g, "") + " ";
    if(voiceCmd(t) === "stop") return setKzVoice(false);
    const v = /(nicht|unsicher|nein|schwer|keine ahnung)/.test(s) ? 1 : /(fast|teilweise|halb|so lala)/.test(s) ? 2 : /(sitzt|passt|gut| ja )/.test(s) ? 3 : 0;
    if(v) rateUmf(v); else kzNote("Tippe auf „Sitzt“, „Fast“ oder „Noch unsicher“.");
  }, error: er => { if(tok === vtoken) kzNote(micErrText(er)); }});
}
function rateUmf(v){
  KZ.rates[KZ.pos] = v;
  $$("#kzRate [data-rate]").forEach(b => b.setAttribute("aria-checked", +b.dataset.rate === v));
  revealUmf(false);
}
async function coachUmf(){
  const e = KZ.queue[KZ.pos], u = e.u, it = u.items[e.i], text = $("#kzIn").value.trim(), out = $("#kzCoachOut"), b = $("#kzCoach");
  if(await kriseVorab(text)) return;
  b.disabled = true; out.innerHTML = `<p class="note">Der Coach liest …</p>`;
  try{
    const r = await llmJSON(`Du bist ein warmer Coach für Gewaltfreie Kommunikation nach Marshall B. Rosenberg. Übung: „${u.titel}“ – Auftrag: ${u.aufgabe}
Ausgangssatz: ${it.t}
Fassung der übenden Person: ${text}
Mögliche Lösungen: ${(it.muster || []).join(" / ")}
Regeln: Alltagssprache ist ausdrücklich gut, wenn die Funktion stimmt. Keine Noten, nicht beschämen, nicht belehren. Du-Form.
Antworte NUR mit JSON: {"gut":"1 Satz: was konkret gelungen ist","schritt":"1 Satz: genau ein nächster Schritt – oder leer, wenn nichts Wesentliches fehlt"}`, {tier:"quick"});
    out.innerHTML = `<div class="fb coachfb"><p><b>Coach:</b> ${esc(r.gut || "")}</p>${r.schritt ? `<p><b>Nächster Schritt:</b> ${esc(r.schritt)}</p>` : ""}</div>`;
    if(KZ.voice) voiceSay((r.gut || "") + " " + (r.schritt || ""), () => listenRate(vtoken));
  }catch(err){
    if(istKrise(err)){ out.innerHTML = ""; b.disabled = false; return; }
    if(err && err.code === "access") askAccess();
    out.innerHTML = `<p class="note">Der Coach ist gerade nicht erreichbar. Die Vorschläge oben helfen dir trotzdem weiter.</p>`; b.disabled = false;
  }
}
function endUmf(){
  stopListenL();
  const n = KZ.queue.length, sitzt = KZ.rates.filter(v => v === 3).length, u = KZ.u, all = sitzt === n;
  KZ.wrong = KZ.queue.filter((_, i) => (KZ.rates[i] || 0) < 3);
  if(KZ.full) saveKu(u.id, {best:sitzt, total:n, clear:all});
  if(u.id === "K14" && KZ.full) discover("dank");
  const dank = all ? `Du hast alle ${n} Sätze in eigene Worte gebracht, und sie sitzen. Diese Übung im Kopf macht es leichter, im Gespräch spontan so zu reden.`
    : `Du hast ${n} Sätze selbst umformuliert. ${sitzt ? `${sitzt} davon sitzen schon. ` : ""}Die anderen noch einmal zu üben, macht sie dir vertrauter.`;
  const sp = u.spick && SPICK_BY[u.spick];
  $("#quizRun").innerHTML = kzTop(" ") + `<div class="kzend card stack${all ? " done" : ""}" tabindex="-1">
      <h2 class="section-title" style="margin:0">${esc(u.titel)}</h2>
      <p class="bigline">${pie(all ? 3 : 2)} ${all ? "Alle Fassungen sitzen" : `${n} Sätze umformuliert`}</p>
      <p>${esc(dank)}</p>${u.merksatz ? `<p class="merk"><span class="hand">Zum Mitnehmen:</span> ${esc(u.merksatz)}</p>` : ""}
      <div class="row">${KZ.wrong.length ? `<button class="btn primary" data-kz="wrong">Die ${KZ.wrong.length} unsicheren nochmal</button>` : ""}<button class="btn${KZ.wrong.length ? "" : " primary"}" data-kz="home">Andere Übung</button>${sp ? `<button class="btn ghost" data-spick="${sp.id}">Spickzettel: ${esc(sp.titel)}</button>` : ""}</div></div>`;
  const card = $(".kzend"); card.focus({preventScroll:true});
  if(all) celebrate(card, "small");
  if(KZ.voice) voiceSay(dank);
}

/* ---------- Typ „schritte“ ---------- */
function fillSatz(tpl, ans){
  return String(tpl || "").split(/(?<=[.!?])\s+/).filter(sent => {
    const keys = [...sent.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    return keys.every(k => (ans[k] || "").trim());
  }).map(sent => sent.replace(/\{(\w+)\}(?=([.!?]?))/g, (m, k, p) => { const v = (ans[k] || "").trim(); return p ? v.replace(/[.!?]+$/, "") : v; })).join(" ");
}
function renderSchritte(){
  const u = KZ.u, n = u.schritte.length;
  if(KZ.step < 0){
    $("#quizRun").innerHTML = kzTop(TYP_NAME.schritte) + `<h2 class="section-title" style="margin:0">${esc(u.titel)}</h2><p>${esc(u.intro)}</p>
      ${u.beispiel ? `<div class="notice"><p class="xs muted">Kein eigenes Beispiel zur Hand?</p><p>${esc(u.beispiel)}</p><button class="linkbtn" data-kz="example">Mit diesem Beispiel üben</button></div>` : ""}
      <p class="small muted">Deine Antworten bleiben nur auf diesem Bildschirm und werden nicht gespeichert. Wenn du sprichst, wandelt dein Browser die Sprache in Text um – je nach Browser über einen Online-Dienst.</p>
      <div class="row"><button class="btn primary" data-kz="go">Los geht’s</button></div>`;
    refocus('[data-kz="go"]');
    if(KZ.voice){ const tok = ++vtoken; speak(speechText(u.ansage || u.intro), "coach").then(() => { if(tok === vtoken) kzNote(""); }); }
    return;
  }
  if(KZ.step >= n) return endSchritte();
  const s = u.schritte[KZ.step], val = KZ.answers[s.key] || "";
  $("#quizRun").innerHTML = kzTop(`Schritt ${KZ.step + 1} von ${n}`) + `<div class="progress" aria-hidden="true"><i style="width:${KZ.step / n * 100}%"></i></div>
    <p class="lbl xs muted">${esc(u.titel)}</p><h2 class="stepq" id="kzQ" tabindex="-1">${esc(s.titel)}</h2><p class="stmt small-stmt">${esc(s.frage)}</p>
    ${s.hilfe ? `<p class="small muted">${esc(s.hilfe)}</p>` : ""}
    ${s.chips && s.chips.length ? `<div class="row" role="group" aria-label="Wörter zum Einfügen">${s.chips.map(c => `<button class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
    <div class="field"><label class="sr" for="kzIn">Deine Antwort</label><div class="inputrow"><textarea id="kzIn" rows="3" placeholder="${esc(s.platzhalter || "")}">${esc(val)}</textarea>${micBtn("kzMic")}</div></div>
    <p class="note" id="kzNote" role="status"></p>
    <div class="row"><button class="btn" data-kz="back">Zurück</button>${s.optional ? `<button class="btn ghost" data-kz="skip">Auslassen</button>` : ""}<span class="grow"></span><button class="btn primary" data-kz="stepnext">${KZ.step + 1 < n ? "Weiter" : "Fertig"}</button></div>`;
  if(KZ.voice) voiceStep(); else refocus("#kzQ");
}
async function voiceStep(){
  const s = KZ.u.schritte[KZ.step], tok = ++vtoken;
  await speak(speechText(s.ansage || s.frage), "coach");
  if(tok !== vtoken || !canListen()) return;
  kzNote("Ich höre zu …");
  listenL({btn: $("#kzMic"), interim: t => { $("#kzIn").value = t; }, final: t => {
    if(tok !== vtoken) return;
    const cmd = voiceCmd(t);
    if(cmd === "repeat") return voiceStep();
    if(cmd === "stop") return setKzVoice(false);
    if(cmd === "next" || !t){ if(!t) kzNote("Ich habe nichts gehört. Tippe aufs Mikrofon oder schreib deine Antwort."); else stepNext(); return; }
    $("#kzIn").value = t;
    voiceSay("Notiert. Sag weiter, wenn es passt – oder sprich neu.", () => listenStepNext(vtoken));
  }, error: er => { if(tok === vtoken) kzNote(micErrText(er)); }});
}
function listenStepNext(tok){
  kzNote("Sag „weiter“, wenn es passt – oder sprich neu.");
  listenL({btn: $("#kzMic"), interim: t => kzHeard(t), final: t => {
    if(tok !== vtoken || !KZ) return;
    const c = voiceCmd(t);
    if(c === "next") return stepNext();
    if(c === "stop") return setKzVoice(false);
    if(c === "repeat") return voiceStep();
    if(t){ $("#kzIn").value = t; return voiceSay("Notiert. Sag weiter, wenn es passt.", () => listenStepNext(vtoken)); }
    kzNote("Tippe auf „Weiter“, wenn es passt.");
  }, error: er => { if(tok === vtoken) kzNote(micErrText(er)); }});
}
function stepSave(){ const s = KZ.u.schritte[KZ.step]; if(s && $("#kzIn")) KZ.answers[s.key] = $("#kzIn").value.trim(); }
async function stepNext(){
  const s = KZ.u.schritte[KZ.step];
  stepSave();
  if(KZ.answers[s.key] && await kriseVorab(KZ.answers[s.key])) return;
  if(!s.optional && !KZ.answers[s.key]){ kzNote("Schreib oder sag ein paar Worte – oder nimm das Beispiel aus dem Platzhalter."); $("#kzIn").focus(); return; }
  KZ.step++; renderKZ();
}
function endSchritte(){
  const u = KZ.u, satz = fillSatz(u.satz, KZ.answers);
  saveKu(u.id, {best:1, total:1, clear:false});
  if(u.gruppe === "selbst" && /K12|K13/.test(u.id)) discover("selbst");
  $("#quizRun").innerHTML = kzTop(" ") + `<div class="kzend card stack" tabindex="-1"><h2 class="section-title" style="margin:0">${esc(u.titel)}</h2>
      <p class="xs muted">Dein Satz</p><p class="quote big">${esc(satz)}</p>
      ${u.abschluss ? `<p>${esc(u.abschluss)}</p>` : ""}${u.merksatz ? `<p class="merk"><span class="hand">Zum Mitnehmen:</span> ${esc(u.merksatz)}</p>` : ""}
      <div class="row"><button class="btn" data-kz="read">Vorlesen</button><button class="btn" data-kz="again">Nochmal</button><button class="btn primary" data-kz="home">Andere Übung</button>${u.spick && SPICK_BY[u.spick] ? `<button class="btn ghost" data-spick="${u.spick}">Spickzettel: ${esc(SPICK_BY[u.spick].titel)}</button>` : ""}</div></div>`;
  const card = $(".kzend"); card.focus({preventScroll:true});
  KZ.satz = satz;
  if(KZ.voice) voiceSay(satz + " " + (u.abschluss || ""));
}
function setKzVoice(on){
  settings.kuVoice = !!on; saveSettings(); if(KZ) KZ.voice = !!on; kuHowUI();
  if(!on){ stopVoiceLearning(); kzNote("Stimme aus – du kannst weiter tippen."); }
  const b = $('[data-kz="voice"]'); if(b){ b.setAttribute("aria-pressed", !!on); b.textContent = on ? "Stimme: an" : "Stimme: aus"; }
  if(on && KZ){ KZ.intro = false; if(KZ.u.typ === "wahl" && !KZ.answered && KZ.pos < KZ.queue.length) voiceWahl(false); else if(KZ.u.typ === "umformulieren" && KZ.pos < KZ.queue.length && !$("#kzRes")?.innerHTML) voiceUmf(false); else if(KZ.u.typ === "schritte" && KZ.step >= 0 && KZ.step < KZ.u.schritte.length) voiceStep(); }
}
$("#quizRun").addEventListener("click", e => {
  if(!KZ) return;
  const a = e.target.closest("[data-ans]"); if(a) return answerWahl(a.dataset.ans);
  if(e.target.closest("#qNext") || e.target.closest("#kzNext")) return nextKZ();
  const k = e.target.closest("[data-kz]")?.dataset.kz;
  const sp = e.target.closest("[data-spick]"); if(sp) return openSpick(sp.dataset.spick);
  if(e.target.closest("#kzListen")){ const tok = ++vtoken; return listenOption(tok, 1); }
  if(e.target.closest("#kzMic")){
    if(lrec){ stopListenL(); return; }
    const tok = ++vtoken; hushAll();
    if(KZ.u.typ === "umformulieren") return listenUmf(tok);
    return listenL({btn:$("#kzMic"), interim: t => { $("#kzIn").value = t; }, final: t => { if(t && tok === vtoken) $("#kzIn").value = t; }, error: er => kzNote(micErrText(er))});
  }
  if(e.target.closest("#kzCheck")) return checkUmf(false);
  if(e.target.closest("#kzSkip")){ $("#kzIn").value = ""; return checkUmf(false); }
  if(e.target.closest("#kzTip")){ const t = $("#kzTipT"); t.hidden = !t.hidden; e.target.setAttribute("aria-expanded", !t.hidden); return; }
  if(e.target.closest("#kzCoach")) return coachUmf();
  const rb = e.target.closest("#kzRate [data-rate]"); if(rb) return rateUmf(+rb.dataset.rate);
  const ch = e.target.closest("[data-chip]");
  if(ch){ const t = $("#kzIn"); t.value = (t.value.trim() ? t.value.trim().replace(/[,]?$/, ", ") : "") + ch.dataset.chip; t.focus(); return; }
  if(!k) return;
  if(k === "home") return kzHome();
  if(k === "reveal") return revealUmf(false);
  if(k === "voice") return setKzVoice(!KZ.voice);
  if(k === "wrong") return startDeck(KZ.u.id, KZ.wrong);
  if(k === "again") return startDeck(KZ.u.id);
  if(k === "go"){ KZ.step = 0; return renderKZ(); }
  if(k === "example"){ KZ.example = true; const s0 = KZ.u.schritte[0]; KZ.answers[s0.key] = KZ.u.beispiel.replace(/[.!?]+$/, ""); KZ.step = 0; return renderKZ(); }
  if(k === "back"){ stepSave(); KZ.step = Math.max(-1, KZ.step - 1); return renderKZ(); }
  if(k === "skip"){ KZ.answers[KZ.u.schritte[KZ.step].key] = ""; KZ.step++; return renderKZ(); }
  if(k === "stepnext") return stepNext();
  if(k === "read") return voiceSay(KZ.satz || "");
});
document.addEventListener("keydown", e => {
  if(!KZ || $("#p-quiz").hidden || $("#quizRun").hidden || document.querySelector("dialog[open]")) return;
  if(/^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement?.tagName || "")) return;
  if(KZ.u.typ === "wahl" && !KZ.answered && /^[1-6]$/.test(e.key)){
    const u = KZ.queue[KZ.pos]?.u, o = u && u.optionen[+e.key - 1];
    if(o){ e.preventDefault(); answerWahl(o.id); }
  } else if(KZ.u.typ === "wahl" && KZ.answered && e.key === "Enter" && $("#qNext")){
    const a = document.activeElement;
    if(!a || a === document.body || !a.closest("button,a,input,textarea,select,[tabindex]") || a.id === "kzQ"){ e.preventDefault(); nextKZ(); }
  }
});

/* ===================== Spickzettel mit Hörkarten ===================== */
let SZF = "all", szPlaying = null;
const SZ_FILTERS = [["all", "Alle"], ...KU.gruppen.map(g => [g.id, g.titel])];
function deckName(id){ return KU_BY[id]?.titel || ""; }
function renderSZ(){
  $("#szFilters").innerHTML = SZ_FILTERS.map(([id, t]) => `<button class="chip" aria-pressed="${SZF === id}" data-szf="${id}">${esc(t)}</button>`).join("");
  $("#szPdf").href = PDF_BASE + "spickzettel.pdf";
  $("#szGrid").innerHTML = SPICK.filter(s => SZF === "all" || s.gruppe === SZF).map(s => `<article class="card szcard" id="sz-${s.id}" aria-labelledby="szh-${s.id}">
    <div class="row" style="align-items:baseline"><h2 class="grow" id="szh-${s.id}">${esc(s.titel)}</h2><span class="xs muted">${esc(s.abschnitt || "")}</span></div>
    ${s.kurz ? `<p class="small muted" style="margin-bottom:8px">${esc(s.kurz)}</p>` : ""}
    <table><tbody>${(s.zeilen || []).map(z => `<tr><td>${esc(z[0])}</td><td>${esc(z[1])}</td></tr>`).join("")}</tbody></table>
    ${s.probier ? `<p style="margin-top:12px"><span class="hand">Probier mal:</span><br>„${esc(String(s.probier).replace(/^„|“$/g, ""))}“</p>` : ""}
    ${s.merksatz ? `<p class="merk"><b>Merksatz:</b> ${esc(s.merksatz)}</p>` : ""}
    ${s.eselsbruecke ? `<p class="small muted">Eselsbrücke: ${esc(s.eselsbruecke)}</p>` : ""}
    <div class="row szact">${s.hoeren ? `<button class="btn small" data-hear="${s.id}" aria-pressed="${szPlaying === s.id}"><span aria-hidden="true">${szPlaying === s.id ? "■" : "▶"}</span> Anhören</button>` : ""}${s.uebung && KU_BY[s.uebung] ? `<button class="btn small ghost" data-godeck="${s.uebung}">Üben: ${esc(deckName(s.uebung))}</button>` : ""}</div>
  </article>`).join("");
}
$("#szFilters").addEventListener("click", e => { const b = e.target.closest("[data-szf]"); if(!b) return; SZF = b.dataset.szf; renderSZ(); refocus(`[data-szf="${SZF}"]`); });
$("#szGrid").addEventListener("click", async e => {
  const g = e.target.closest("[data-godeck]"); if(g){ selectTab("t-quiz"); startDeck(g.dataset.godeck); return; }
  const h = e.target.closest("[data-hear]"); if(!h) return;
  const id = h.dataset.hear;
  if(szPlaying === id){ szPlaying = null; stopVoiceLearning(); renderSZ(); refocus(`[data-hear="${id}"]`); return; }
  szPlaying = id; renderSZ(); refocus(`[data-hear="${id}"]`); const tok = ++vtoken;
  const heard = store.json("gfk.hk", []); if(!heard.includes(id)){ heard.push(id); store.setJson("gfk.hk", heard); if(heard.length >= 3) discover("hoeren"); }
  await speak(speechText(SPICK_BY[id].hoeren), "coach");
  if(tok === vtoken && szPlaying === id){ szPlaying = null; const had = document.activeElement?.dataset?.hear === id; renderSZ(); if(had) refocus(`[data-hear="${id}"]`); }
});
function openSpick(id){
  stopVoiceLearning(); SZF = "all"; selectTab("t-cheat");
  const el = $("#sz-" + id); if(!el) return;
  el.scrollIntoView({block:"start", behavior: REDUCED() ? "auto" : "smooth"}); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  el.querySelector("h2")?.setAttribute("tabindex", "-1"); el.querySelector("h2")?.focus({preventScroll:true});
}

/* ===================== Lernkarten ===================== */
const PDF_BASE = INSIDE_CLAUDE ? "https://wolf-giraffe-trainer.vercel.app/pdf/" : "pdf/";
const PDF_INFO = __PDFINFO__;
let LKK = "gef";
const allFeel = () => [...LK.gefuehle.erfuellt.map(g => ({...g, art:"erfuellt"})), ...LK.gefuehle.unerfuellt.map(g => ({...g, art:"unerfuellt"}))];
const lkCard = (w, k, cls) => `<div class="lkcard ${cls}"><b>${esc(w)}</b>${k ? `<span class="lkk">${esc(k)}</span>` : ""}</div>`;
function renderLK(){
  $$("#lkKind [role=radio]").forEach(b => b.setAttribute("aria-checked", b.dataset.kind === LKK));
  let html = "";
  if(LKK === "gef"){
    const sec = (title, sub, list, cls) => `<section class="lksec"><h2 class="section-title">${esc(title)} <span class="muted small sub">${esc(sub)}</span></h2>${list.map(g => `<h3 class="lkgh">${esc(g.gruppe)}</h3><div class="lkgrid">${g.woerter.map(x => lkCard(x.w, x.k, cls, g.gruppe)).join("")}</div>`).join("")}</section>`;
    html = sec("Wenn Bedürfnisse erfüllt sind", "warme Karten", LK.gefuehle.erfuellt, "warm") + sec("Wenn Bedürfnisse nicht erfüllt sind", "kühle Karten", LK.gefuehle.unerfuellt, "cool");
  } else if(LKK === "bed"){
    html = `<section class="lksec"><p class="muted" style="max-width:68ch;margin-bottom:12px">Bedürfnisse teilen alle Menschen – unabhängig davon, wer oder was sie erfüllt. Kommt eine bestimmte Person oder Handlung vor, ist es eine Strategie.</p>${LK.beduerfnisse.map(b => `<h3 class="lkgh">${esc(b.bereich)}</h3><div class="lkgrid">${b.woerter.map(x => lkCard(x.w, x.k, "b-" + b.id, b.bereich)).join("")}</div>`).join("")}</section>`;
  } else {
    html = `<section class="lksec"><p class="muted" style="max-width:68ch;margin-bottom:12px">Diese Wörter klingen wie Gefühle, beschreiben aber, was andere uns angeblich antun. Darunter liegen echte Gefühle und Bedürfnisse – als Vermutung, nicht als Regel.</p>
      <div class="tablewrap"><table class="hist pseudo"><thead><tr><th>„Ich fühle mich …“</th><th>Darunter vielleicht</th><th>Und dahinter</th></tr></thead><tbody>${LK.pseudo.map(p => `<tr><td><b>${esc(p.w)}</b></td><td>${esc((p.gefuehle || []).join(", "))}</td><td>${esc((p.beduerfnisse || []).join(", "))}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  $("#lkBody").innerHTML = html;
  const nG = allFeel().reduce((s, g) => s + g.woerter.length, 0), nB = LK.beduerfnisse.reduce((s, b) => s + b.woerter.length, 0);
  const dl = [["gefuehlskarten.pdf", "Gefühlskarten", `${nG} Karten zum Ausschneiden, warm und kühl, mit Spielideen`],
    ["beduerfniskarten.pdf", "Bedürfniskarten", `${nB} Karten in acht Bereichen, dazu eine Seite „Pseudogefühle übersetzen“`],
    ["workshop-handout.pdf", "Übungen für Teilnehmende", "Zehn Workshop-Übungen mit Arbeitsblättern und Lösungsvorschlägen – allein, zu zweit, zu dritt"],
    ["spickzettel.pdf", "Spickzettel", "Alle 16 Spickzettel, zwei pro Seite zum Falten"]];
  $("#lkDownloads").innerHTML = `<h2 class="section-title" style="margin:0">Zum Ausdrucken</h2><p class="small muted">Für dich, deine Übungsgruppe oder deinen Workshop. Am besten in Originalgröße drucken.</p>
    <ul class="dllist">${dl.map(([f, t, d]) => `<li><a class="btn" href="${PDF_BASE}${f}" download="${f}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>${esc(t)}<span class="sr"> als PDF herunterladen</span></a><span class="small muted">${esc(d)} · PDF${PDF_INFO[f] ? `, ${PDF_INFO[f]} KB` : ""}</span></li>`).join("")}</ul>`;
  $("#lkSource").textContent = LK.quelle || "";
}
radioGroup("#lkKind", b => { LKK = b.dataset.kind; $("#lkDrawn").hidden = true; renderLK(); });
function drawCard(){
  const box = $("#lkDrawn");
  let html = "";
  if(LKK === "gef"){
    drawCard.n = (drawCard.n || 0) + 1;
    const g = drawCard.n === 1 ? pick(allFeel().filter(f => f.art === "erfuellt")) : pick(allFeel()), x = pick(g.woerter);
    html = `<div class="lkcard big ${g.art === "erfuellt" ? "warm" : "cool"}"><span class="lkg">${esc(g.gruppe)}</span><b>${esc(x.w)}</b><span class="lkk">${esc(x.k || "")}</span></div>
      <div class="stack"><p><b>Wann hast du dich zuletzt ${esc(x.w)} gefühlt?</b></p><p class="muted">Welches Bedürfnis war da ${g.art === "erfuellt" ? "erfüllt" : "nicht erfüllt"}? Nimm dir einen Atemzug Zeit – es gibt keine falsche Antwort.</p>`;
  } else if(LKK === "bed"){
    const b = pick(LK.beduerfnisse), x = pick(b.woerter);
    html = `<div class="lkcard big b-${b.id}"><span class="lkg">${esc(b.bereich)}</span><b>${esc(x.w)}</b><span class="lkk">${esc(x.k || "")}</span></div>
      <div class="stack"><p><b>Wie ist es gerade um ${esc(x.w)} in deinem Leben bestellt?</b></p><p class="muted">Was wäre ein kleiner Schritt, mit dem du heute dafür sorgen könntest – ohne dass eine bestimmte Person etwas tun muss?</p>`;
  } else {
    const p = pick(LK.pseudo);
    html = `<div class="lkcard big"><span class="lkg">Pseudogefühl</span><b>${esc(p.w)}</b><span class="lkk">„Ich fühle mich ${esc(p.w)}.“</span></div>
      <div class="stack"><p><b>Was könnte darunter liegen?</b></p><p class="muted">Vielleicht: ${esc(joinDe(p.gefuehle || []))} – weil ${esc(joinDe(p.beduerfnisse || []))} wichtig ${(p.beduerfnisse || []).length > 1 ? "sind" : "ist"}.</p>`;
  }
  box.innerHTML = html + `<p class="small muted">Zu viel gerade? Zieh einfach eine neue Karte.</p><div class="row"><button class="btn small" data-lk="again">Noch eine</button><button class="btn small ghost" data-lk="close">Schließen</button></div></div>`;
  box.hidden = false; box.classList.remove("flash"); void box.offsetWidth; box.classList.add("flash");
  refocus('[data-lk="again"]');
}
$("#lkDraw").addEventListener("click", drawCard);
$("#lkDrawn").addEventListener("click", e => { const k = e.target.closest("[data-lk]")?.dataset.lk; if(k === "again") drawCard(); if(k === "close"){ $("#lkDrawn").hidden = true; $("#lkDraw").focus(); } });

/* ===================== Empathisch zuhören ===================== */
let EMPF = "all", ER = null;
const EMP_BY = Object.fromEntries(EMP.erzaehlungen.map(e => [e.id, e]));
/* Alltagswörter → Wörter der Erzählungen (Wortanfänge, kleingeschrieben) */
const EMP_SYN = [
  [["sauer", "wütend", "zornig", "stinkig"], ["ärgerlich", "wütend", "verärgert"]], [["fertig", "kaputt", "platt", "ausgelaugt", "am ende", "leer", "k.o."], ["erschöpft", "müde", "ausgelaugt", "kraftlos"]],
  [["gestresst", "unter strom", "angespannt", "unter druck"], ["angespannt", "gestresst"]], [["genervt", "gereizt"], ["genervt", "gereizt", "irritiert"]],
  [["allein", "einsam"], ["einsam"]], [["sorge", "besorgt"], ["besorgt", "beunruhigt"]], [["angst", "ängstlich", "fürchte"], ["ängstlich", "besorgt"]],
  [["zu viel", "überfordert", "über den kopf"], ["überfordert"]], [["down", "bedrückt", "niedergeschlagen"], ["niedergeschlagen", "bedrückt", "traurig"]],
  [["erhol", "ausruhen", "ausschlafen", "schlaf", "pause", "durchatmen", "auftanken"], ["Erholung", "Ruhe"]], [["hilfe", "helfen", "unterstütz", "mit anpack", "jemand, der", "jemanden, der"], ["Unterstützung", "Entlastung"]],
  [["entlast", "abgeben", "weniger auf"], ["Entlastung"]], [["verstanden", "verstehen", "verständnis"], ["Verständnis"]], [["zuhör", "gehört", "ernst genommen"], ["gehört werden", "Verständnis"]],
  [["gesehen", "wahrgenommen", "bemerkt"], ["gesehen werden", "Anerkennung"]], [["anerkannt", "anerkennung", "gewürdigt"], ["Anerkennung", "Wertschätzung"]],
  [["wertgeschätzt", "wertschätzung", "geschätzt"], ["Wertschätzung", "Anerkennung"]], [["respekt"], ["Respekt"]], [["fair", "gerecht"], ["Fairness"]],
  [["ehrlich"], ["Ehrlichkeit"]], [["sicher", "geschützt"], ["Sicherheit", "Schutz"]], [["selbst entscheiden", "selbstbestimm", "mitentscheiden", "mitreden"], ["Selbstbestimmung", "Mitsprache", "Autonomie"]],
  [["frei", "freiraum"], ["Freiheit", "Wahlfreiheit"]], [["klar", "wissen, woran"], ["Klarheit", "Orientierung"]], [["verlassen können", "zuverlässig", "verlässlich"], ["Verlässlichkeit", "Vertrauen"]],
  [["dazugehör", "dabei sein", "zugehörig"], ["Zugehörigkeit", "Einbezogensein"]], [["einbezogen", "gefragt werden", "mit einbezogen"], ["Einbezogensein", "Mitsprache"]],
  [["nähe", "nah ", "kontakt", "verbunden", "verbindung"], ["Nähe", "Verbindung"]], [["ruhe", "ruhig", "still"], ["Ruhe"]], [["leicht", "spaß", "freude"], ["Leichtigkeit", "Freude"]],
  [["sinn", "bewirken", "beitragen"], ["Sinn", "Beitrag"]], [["planen", "planbar", "absehbar"], ["Planbarkeit", "Orientierung"]]
];
const startsWord = (low, w) => new RegExp("(^|[^a-zäöüß])" + escRe(w)).test(low);
const EMP_BLOCK = [
  [/\b(du solltest|sie sollten|versuch doch|versuchen sie doch|an deiner stelle|an ihrer stelle|mach doch|machen sie doch|hast du schon mal|haben sie schon mal|probier doch|warum gehst du nicht|du musst einfach|du könntest doch)\b/, "einem Ratschlag"],
  [/\b(kopf hoch|wird schon|halb so (wild|schlimm)|nicht so schlimm|das wird wieder|mach dir keinen kopf|beruhig dich|beruhigen sie sich|ist doch nicht so|alles gut)\b/, "Trost oder Beschwichtigung"],
  [/\b(bei mir (war|ist)|kenn ich|kenne ich|das hatte ich auch|mir geht'?s genauso|ich hatte mal|geht mir auch so)\b/, "einer eigenen Geschichte"],
  [/^\s*(warum|wieso|weshalb|seit wann|wann|wie oft|wer)\b/, "einer Nachfrage zu den Fakten"],
  [/\b(ich hab doch|ich habe doch|ich konnte (ja|doch) nicht|das war doch nicht|ich wollte doch nur|das stimmt (doch )?nicht|so war das nicht)\b/, "einer Erklärung oder Rechtfertigung"]
];
function stemHit(low, word){
  const w = String(word).toLowerCase().split(" ")[0]; if(!w) return false;
  const st = w.length >= 9 ? w.slice(0, w.length - 4) : w.length >= 6 ? w.slice(0, w.length - 2) : w;
  return new RegExp("(^|[^a-zäöüß])" + escRe(st)).test(low);
}
function evalGuess(e, text){
  const low = String(text || "").toLowerCase(), canon = new Set();
  EMP_SYN.forEach(([keys, ws]) => { if(keys.some(k => startsWord(low, k))) ws.forEach(w => canon.add(w.toLowerCase())); });
  const hitIn = list => (list || []).filter(w => stemHit(low, w) || canon.has(w.toLowerCase()));
  const gC = hitIn(e.gefuehle), gN = hitIn(e.nahe_gefuehle), bC = hitIn(e.beduerfnisse), bN = hitIn(e.nahe_beduerfnisse);
  const g = gC.length ? 2 : gN.length ? 1 : 0, b = bC.length ? 2 : bN.length ? 1 : 0;
  const blocker = EMP_BLOCK.find(([re]) => re.test(low));
  const fm = low.match(/fühl\w*\s+(?:du\s+|sie\s+)?(?:dich|sich|mich)\s+([^?.!,]+)/);
  const pseudoW = fm ? (Object.keys(PSEUDO).find(k => fm[1].includes(k)) || (LK.pseudo || []).map(p => p.w).find(w => fm[1].includes(w.toLowerCase()))) : "";
  const question = /\?/.test(text) || /^(bist|sind|ist|brauchst|brauchen|wünschst|wünschen|klingt|hört sich)/.test(low.trim());
  const diagnose = !question && /\b(du bist|sie sind|du willst doch|sie wollen doch)\b/.test(low);
  let art = g && b ? "treffer" : g ? "teil_gefuehl" : b ? "teil_beduerfnis" : blocker ? "blocker" : "daneben";
  return {art, gC, gN, bC, bN, blocker: blocker && blocker[1], pseudoW, question, diagnose, hits: [...gC, ...gN, ...bC, ...bN]};
}
function empHowUI(){ $$("#empHow [role=radio]").forEach(b => b.setAttribute("aria-checked", b.dataset.how === (settings.empHow || "pick"))); }
radioGroup("#empHow", b => { settings.empHow = b.dataset.how; saveSettings(); empHowUI(); if(ER && !$("#empRun").hidden) renderErInput(); });
function empStatus(id){ const s = store.json("gfk.emp", {})[id]; return !s ? "" : s.hit ? `<span class="lvltag l3">${pie(3)} verstanden</span>` : `<span class="lvltag l1">${pie(1)} zugehört</span>`; }
function renderEmpHome(){
  $("#empIntro").innerHTML = esc(EMP.intro || "") + `<span class="small" style="display:block;margin-top:6px">Die Personen sind erfunden. Ausgewählte Wörter prüft die App selbst; frei formulierte Vermutungen beantwortet – wenn verbunden – eine KI (Claude).</span>`;
  empHowUI();
  $$("#empFilters [data-f]").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === EMPF));
  const list = EMP.erzaehlungen.filter(e => EMPF === "all" || String(e.stufe) === EMPF);
  $("#empGrid").innerHTML = `<button class="scard new" data-emp="RANDOM"><b>Zufällige Person</b><span class="focus">Lass dich überraschen – wie im echten Leben.</span></button>` + list.map(e => `<button class="scard" data-emp="${e.id}">
      <span class="meta"><span class="lvl" aria-label="Stufe ${e.stufe}">${[1, 2, 3].map(i => `<i class="${i <= e.stufe ? "on" : ""}"></i>`).join("")}</span> ${esc(STUFE[e.stufe])} · ${esc(e.bereich)}</span>
      <h3>${esc(e.person)}</h3><span class="focus">${esc(e.rolle)}</span>${empStatus(e.id)}</button>`).join("");
}
$("#empFilters").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if(!b) return; EMPF = b.dataset.f; renderEmpHome(); });
$("#empGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-emp]"); if(!b) return;
  let id = b.dataset.emp;
  if(id === "RANDOM"){ const pool = EMP.erzaehlungen.filter(x => EMPF === "all" || String(x.stufe) === EMPF); const fresh = pool.filter(x => !store.json("gfk.emp", {})[x.id]); id = pick(fresh.length ? fresh : pool).id; }
  startEmp(id);
});
const sieOf = e => /^sie$/i.test(e.anrede || "");
const NEED_SAY = {"gesehen werden":"gesehen zu werden", "gehört werden":"gehört zu werden", "Trauer":"Raum für Trauer", "Abschied":"ein guter Abschied", "Einbezogensein":"einbezogen zu werden"};
function buildGuess(g, b, sie){
  b = b.map(x => NEED_SAY[x] || x);
  const verb = b.length > 1 ? "sind" : "ist";
  if(g.length && b.length) return sie ? `Sind Sie ${joinDe(g)}, weil Ihnen ${joinDe(b)} wichtig ${verb}?` : `Bist du ${joinDe(g)}, weil dir ${joinDe(b)} wichtig ${verb}?`;
  if(g.length) return sie ? `Sind Sie gerade ${joinDe(g)}?` : `Bist du gerade ${joinDe(g)}?`;
  if(b.length) return sie ? `Ist Ihnen gerade ${joinDe(b)} wichtig?` : `Ist dir gerade ${joinDe(b)} wichtig?`;
  return "";
}
function startEmp(id){
  stopVoiceLearning();
  const e = EMP_BY[id]; if(!e) return;
  ER = {e, tries:0, done:false, hit:false, picks:{g:[], b:[]}, log:[], firstHit:false, questions:0};
  $("#empHome").hidden = true; $("#empRun").hidden = false;
  $("#empRun").innerHTML = `<div class="phead emphead"><button class="btn ghost" data-er="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Personen</button>
      <div class="title"><h1>${esc(e.person)}</h1><p class="meta">${esc(e.rolle)} · ${esc(STUFE[e.stufe])}</p></div></div>
    <p class="muted empsit">${esc(e.situation)}</p>
    <div class="log emplog" id="erLog" role="log" aria-live="polite" aria-label="Gespräch mit ${esc(e.person)}"></div>
    <div id="erInput" class="card stack erinput"></div>
    <p class="note ernote" id="erNote" role="status"></p>
    <div id="erCoach"></div>`;
  refocus("#empRun h1");
  erThem(e.sagt, true);
  renderErInput();
  window.scrollTo({top:0});
  if((settings.empHow || "pick") === "voice") erSpeakThem(e.sagt, () => erListen());
}
function erThem(text, first){
  const el = document.createElement("div"); el.className = "msg them";
  el.innerHTML = `<span class="who">${esc(ER.e.person)}</span><div class="bubble">${esc(text)}</div>${first ? `<button class="linkbtn small" data-er="hear">Anhören</button>` : ""}`;
  $("#erLog").append(el); return el;
}
function erMe(text){ const el = document.createElement("div"); el.className = "msg me"; el.innerHTML = `<span class="who">Du</span><div class="bubble">${esc(text)}</div>`; $("#erLog").append(el); return el; }
const erMicState = (st, label) => { const m = $("#erMic"); if(m) m.setAttribute("data-state", st); const l = $("#erMicLbl"); if(l && label) l.textContent = label; };
async function erSpeakThem(text, then){
  const tok = ++vtoken; erMicState("busy", `${ER ? ER.e.person : "Die Person"} spricht …`);
  await speak(speechText(text), "them");
  if(tok !== vtoken) return;
  erMicState("ready", canListen() ? "Tippe und sprich deine Vermutung" : "");
  if(then) then();
}
function renderErInput(){
  if(!ER) return;
  const e = ER.e, how = settings.empHow || "pick", sie = sieOf(e), box = $("#erInput");
  if(ER.done){ box.hidden = true; return; }
  box.hidden = false;
  const lead = `<p class="lbl"><b>Was könnte in ${esc(e.person)} lebendig sein?</b> <span class="muted small">Vermute als Frage – ${esc(e.person)} sagt dir, ob es passt.</span></p>`;
  const tail = ER.tries ? `<div class="row"><button class="linkbtn" data-er="reveal">Auflösung zeigen</button></div>` : "";
  if(how === "pick"){
    const chips = (arr, kind, sel) => arr.map(w => `<button class="chip" aria-pressed="${sel.includes(w)}" data-pick="${kind}" data-w="${esc(w)}">${esc(w)}</button>`).join("");
    box.innerHTML = lead + `<div class="field"><span class="lbl small" id="erGl">Gefühle <span class="muted">(bis zu zwei)</span></span><div class="row" role="group" aria-labelledby="erGl">${chips(e.auswahl_g || [], "g", ER.picks.g)}</div></div>
      <div class="field"><span class="lbl small" id="erBl">Was könnte wichtig sein? <span class="muted">(bis zu zwei)</span></span><div class="row" role="group" aria-labelledby="erBl">${chips(e.auswahl_b || [], "b", ER.picks.b)}</div></div>
      <p class="quote" id="erPreview" ${ER.picks.g.length || ER.picks.b.length ? "" : "hidden"}>${esc(buildGuess(ER.picks.g, ER.picks.b, sie))}</p>
      <div class="row"><button class="btn primary" data-er="ask" ${ER.picks.g.length || ER.picks.b.length ? "" : "disabled"}>Fragen</button></div>` + tail;
  } else {
    const helpers = sie ? ["Sind Sie …, weil Ihnen … wichtig ist?", "Klingt, als …", "Brauchen Sie gerade …?"] : ["Bist du …, weil dir … wichtig ist?", "Klingt, als …", "Brauchst du gerade …?"];
    box.innerHTML = lead + `${how === "voice" ? `<div class="micwrap"><button class="mic lmic big" id="erMic" data-state="ready" aria-label="Vermutung sprechen">${MIC_SVG}</button><p class="miclabel" id="erMicLbl">${canListen() ? "Tippe und sprich deine Vermutung" : "Sprechen geht in diesem Browser nicht – tippe unten"}</p></div>` : ""}
      <div class="helpers row" aria-label="Satzhilfe">${helpers.map(h => `<button class="chip" data-erhelp="${esc(h)}">${esc(h)}</button>`).join("")}</div>
      <div class="inputrow"><label class="sr" for="erIn">Deine Vermutung</label><textarea id="erIn" rows="2" placeholder="${sie ? "Sind Sie vielleicht …?" : "Bist du vielleicht …?"}"></textarea><button class="btn primary sendbtn" data-er="send" aria-label="Fragen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>` + tail;
  }
}
function erListen(){
  if(!ER || ER.done) return;
  if(!canListen()){ const n = $("#erNote"); if(n) n.textContent = micErrText("unavailable"); return; }
  const tok = ++vtoken, n = $("#erNote");
  if(n) n.textContent = "";
  erMicState("listening", "Ich höre zu – sprich jetzt");
  listenL({interim: t => { const i = $("#erIn"); if(i) i.value = t; }, final: t => {
    erMicState("ready", "Tippe und sprich deine Vermutung");
    if(tok !== vtoken || !ER) return;
    if(!t){ if(n) n.textContent = "Ich habe nichts gehört. Tippe aufs Mikrofon und sprich noch einmal."; return; }
    if(voiceCmd(t) === "repeat") return erSpeakThem(ER.e.sagt, erListen);
    erAsk(t);
  }, error: er => { erMicState("ready", "Tippe und sprich deine Vermutung"); if(tok === vtoken && n) n.textContent = micErrText(er); }});
}
async function erAsk(text){
  if(!ER || ER.done || !text.trim() || ER.busy) return;
  if(await kriseVorab(text)) return;
  const e = ER.e; ER.busy = true; ER.tries++; stopListenL();
  erMe(text.trim());
  if($("#erIn")) $("#erIn").value = "";
  const r = evalGuess(e, text);
  if(r.question) ER.questions++;
  let art = r.art, reply = e.reaktion[art] || e.reaktion.daneben, note = "";
  const how = settings.empHow || "pick";
  if(how !== "pick" && liveOn()){
    try{
      const prev = ER.log.map(x => `${x.who}: ${x.t}`).join("\n");
      const j = await llmJSON(`Du spielst ${e.person} (${e.rolle}) in einer Übung zum empathischen Zuhören nach Marshall B. Rosenberg. Situation: ${e.situation}
${e.person} hat erzählt: „${e.sagt}“
Was wirklich in ${e.person} lebendig ist – Gefühle: ${e.gefuehle.join(", ")} (verwandt: ${(e.nahe_gefuehle || []).join(", ")}); Bedürfnisse: ${e.beduerfnisse.join(", ")} (verwandt: ${(e.nahe_beduerfnisse || []).join(", ")}).
${prev ? "Bisher:\n" + prev + "\n" : ""}Die übende Person sagt jetzt: „${text}“
Ordne ein: "treffer" (Gefühl UND Bedürfnis im Kern getroffen, Alltagssprache zählt), "teil_gefuehl" (nur das Gefühl), "teil_beduerfnis" (nur das Bedürfnis), "daneben" (Vermutung trifft nicht), "blocker" (Rat, Trost, Ausfragen, eigene Geschichte oder Rechtfertigung statt Vermutung).
Antworte als ${e.person} menschlich in 1–2 kurzen Sätzen, Anrede „${e.anrede || "du"}“. Verrate ein nicht getroffenes Bedürfnis nicht als Wort, deute es höchstens an.
Antworte NUR mit JSON: {"art":"…","antwort":"…","coach":"1 kurzer Satz an die übende Person: würdigend, oder genau ein nächster Schritt"}`, {tier:"quick"});
      if(j && e.reaktion[j.art] && j.antwort){ art = j.art; reply = j.antwort; note = j.coach || ""; }
    }catch(err){ if(istKrise(err)){ ER.busy = false; return; } if(err && err.code === "access") askAccess(); }
  }
  if(!note){
    if(art === "blocker") note = `Das klingt nach ${r.blocker || "einer Lösung"} – gut gemeint. Magst du vorher vermuten, was ${e.person} fühlt und braucht?`;
    else if(r.diagnose) note = "Als Frage formuliert klingt es wie eine Vermutung, nicht wie eine Diagnose.";
    else if(r.pseudoW) note = `„${r.pseudoW}“ deutet, was andere tun. Welches Gefühl könnte darunter liegen?`;
    else if(art === "teil_gefuehl") note = "Das Gefühl ist angekommen. Was könnte dahinter wichtig sein?";
    else if(art === "teil_beduerfnis") note = "Das Bedürfnis klingt an. Welches Gefühl passt dazu?";
    else if(art === "daneben" && ER.tries >= 2) note = `Hör noch einmal auf ${genitiv(e.person)} letzte Worte – oft steckt der Hinweis darin.`;
  }
  ER.log.push({who:"Du", t:text}, {who:e.person, t:reply});
  await sleep(450);
  const bubble = erThem(reply);
  const n = $("#erNote"); if(n) n.textContent = note;
  ER.busy = false;
  if(art === "treffer"){
    ER.hit = true; ER.firstHit = ER.tries === 1; ER.done = true;
    bubble.classList.add("hit"); celebrate(bubble.querySelector(".bubble"), "small");
    if(how === "voice") await erSpeakThem(reply);
    await sleep(700);
    if(e.reaktion.mehr){ erThem(e.reaktion.mehr); if(how === "voice") await erSpeakThem(e.reaktion.mehr); }
    erFinish(true, note);
  } else {
    renderErInput();
    if(how === "voice") erSpeakThem(reply, () => erListen());
    else refocus(how === "pick" ? "#erInput [data-pick]" : "#erIn");
  }
}
function erFinish(hit, note){
  const e = ER.e;
  ER.done = true; $("#erInput").hidden = true;
  const s = store.json("gfk.emp", {}), prev = s[e.id] || {n:0, hit:false};
  s[e.id] = {n: prev.n + 1, hit: prev.hit || hit, at: Date.now()}; store.setJson("gfk.emp", s);
  markDay();
  if(hit){ discover("ohr"); if(e.stufe === 3) discover("angriff"); }
  const gut = [];
  if(hit && ER.firstHit) gut.push(`Gleich deine erste Vermutung hat ${e.person} erreicht.`);
  else if(hit) gut.push(`Du bist drangeblieben und hast nachgefragt, bis ${e.person} sich verstanden gefühlt hat.`);
  else gut.push(`Du hast ${ER.tries} ${ER.tries === 1 ? "Vermutung" : "Vermutungen"} angeboten – jede lädt ${e.person} ein, genauer hinzuspüren.`);
  if(ER.questions) gut.push("Du hast gefragt statt behauptet.");
  const next = ER.e.lernhinweis || "";
  $("#erCoach").innerHTML = `<div class="card stack coachfin${hit ? " done" : ""}">
      <div class="coachhead"><img src="${IMG.giraffe}" alt=""><div><b>Coach</b><span>${hit ? "verstanden" : "Auflösung"}</span></div></div>
      ${note && hit ? `<p class="small">${esc(note)}</p>` : ""}
      <p><b>Schon gut:</b> ${esc(gut.join(" "))}</p>
      ${next ? `<p><b>Worauf es hier ankommt:</b> ${esc(next)}</p>` : ""}
      <div class="reveal"><div><p class="xs muted">Was ${esc(e.person)} fühlt</p>${esc(joinDe(e.gefuehle || []))}</div><div><p class="xs muted">Was ${esc(e.person)} braucht</p>${esc(joinDe(e.beduerfnisse || []))}</div></div>
      <p class="xs muted">So hätte es auch klingen können</p>
      ${e.muster ? `<p><span class="tag">Lernform</span>${esc(e.muster)}</p>` : ""}${e.alltag ? `<p><span class="tag alt">Alltag</span>${esc(e.alltag)}</p>` : ""}
      <div class="actions"><button class="btn" data-er="again">Nochmal mit ${esc(e.person)}</button><button class="btn" data-er="home">Alle Personen</button><button class="btn primary" data-er="next">Nächste Person</button></div></div>`;
  $("#erCoach").scrollIntoView({block:"nearest", behavior: REDUCED() ? "auto" : "smooth"});
  refocus("#erCoach .coachfin");
}
$("#empRun").addEventListener("click", e => {
  if(!ER) return;
  const p = e.target.closest("[data-pick]");
  if(p){
    const k = p.dataset.pick, w = p.dataset.w, arr = ER.picks[k], i = arr.indexOf(w);
    if(i >= 0) arr.splice(i, 1); else { arr.push(w); if(arr.length > 2) arr.shift(); }
    $$(`#erInput [data-pick="${k}"]`).forEach(c => c.setAttribute("aria-pressed", arr.includes(c.dataset.w)));
    const g = buildGuess(ER.picks.g, ER.picks.b, sieOf(ER.e)), pv = $("#erPreview");
    pv.textContent = g; pv.hidden = !g; $('[data-er="ask"]').disabled = !g; return;
  }
  const h = e.target.closest("[data-erhelp]"); if(h){ const t = $("#erIn"); t.value = h.dataset.erhelp.replace(/ …,? ?/, " "); t.focus(); return; }
  if(e.target.closest("#erMic")){ if(lrec){ stopListenL(); $("#erMic").setAttribute("data-state", "ready"); } else erListen(); return; }
  const k = e.target.closest("[data-er]")?.dataset.er; if(!k) return;
  if(k === "home"){ stopVoiceLearning(); ER = null; $("#empRun").hidden = true; $("#empHome").hidden = false; renderEmpHome(); return; }
  if(k === "hear") return erSpeakThem(ER.e.sagt);
  if(k === "ask"){ const g = buildGuess(ER.picks.g, ER.picks.b, sieOf(ER.e)); ER.picks = {g:[], b:[]}; return erAsk(g); }
  if(k === "send") return erAsk($("#erIn").value);
  if(k === "reveal"){ stopVoiceLearning(); return erFinish(false, ""); }
  if(k === "again") return startEmp(ER.e.id);
  if(k === "next"){
    const list = EMP.erzaehlungen, seen = store.json("gfk.emp", {});
    const same = list.filter(x => x.id !== ER.e.id && x.stufe === ER.e.stufe && !seen[x.id]);
    const up = list.filter(x => x.id !== ER.e.id && x.stufe === Math.min(3, ER.e.stufe + 1) && !seen[x.id]);
    const nx = (ER.hit ? (same[0] || up[0]) : same[0]) || list.find(x => x.id !== ER.e.id && !seen[x.id]) || list[(list.indexOf(ER.e) + 1) % list.length];
    return startEmp(nx.id);
  }
});
$("#empRun").addEventListener("keydown", e => { if(e.target.id === "erIn" && e.key === "Enter" && !e.shiftKey){ e.preventDefault(); erAsk(e.target.value); } });

/* ===================== Mein Weg ===================== */
function renderWeg(){
  const hist = store.json("gfk.history", []).slice().reverse();
  const ku = kuStore(), emp = store.json("gfk.emp", {}), found = store.json("gfk.found", {}), days = store.json("gfk.days", []);
  const kuDone = Object.keys(ku).filter(k => ku[k].runs && (KU_BY[k] || k === "MIX"));
  if(!hist.length && !kuDone.length && !Object.keys(emp).length){
    $("#wegBody").innerHTML = `<h1 class="section-title" style="font-size:24px">Mein Weg</h1><p class="empty">Noch keine Übungen. Starte mit einem Szenario, einer Kurzübung oder beim Zuhören – hier siehst du dann, was du geübt hast und was heute zum Wiederholen dran ist.</p>`; return;
  }
  const due = dueReviews();
  const rated = hist.filter(h => h.rating).slice(0, 12).reverse();
  const W = 320, H = 110, pad = 24;
  const spark = rated.length >= 2 ? `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sicherheitsgefühl der letzten ${rated.length} Gespräche" style="max-width:420px;width:100%">
      ${[1, 3, 5].map(v => `<line x1="${pad}" x2="${W - 8}" y1="${H - pad - (v - 1) / 4 * (H - 2 * pad)}" y2="${H - pad - (v - 1) / 4 * (H - 2 * pad)}" stroke="var(--line)"/><text x="0" y="${H - pad - (v - 1) / 4 * (H - 2 * pad) + 4}" font-size="11" fill="var(--muted)">${v}</text>`).join("")}
      <polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${rated.map((h, i) => `${pad + i * (W - pad - 16) / (rated.length - 1)},${H - pad - (h.rating - 1) / 4 * (H - 2 * pad)}`).join(" ")}"/>
      ${rated.map((h, i) => `<circle cx="${pad + i * (W - pad - 16) / (rated.length - 1)}" cy="${H - pad - (h.rating - 1) / 4 * (H - 2 * pad)}" r="${i === rated.length - 1 ? 5 : 3.5}" fill="var(--accent)"/>`).join("")}
    </svg><p class="small muted">1 = sehr unsicher · 5 = sehr sicher</p>` : `<p class="small muted">Sobald du nach zwei Gesprächen angegeben hast, wie sicher du dich gefühlt hast, siehst du hier deinen Verlauf.</p>`;
  const fmt = t => new Date(t).toLocaleDateString("de-DE", {day:"2-digit", month:"2-digit"});
  const modeName = {text:"Schreiben", voice:"Sprechen", rt:"Echtzeit"};
  const lastAtLevel = hist.filter(h => h.level === LEVEL).slice(0, 3);
  const nextLvl = LEVEL === "gefuehrt" ? "begleitet" : LEVEL === "begleitet" ? "frei" : null;
  const ready = nextLvl && lastAtLevel.length === 3 && lastAtLevel.every(h => (h.strong || 0) >= 3);
  // Woche
  const wk = weekDays(), today = dayKey(), names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], nWeek = wk.filter(d => days.includes(d)).length, goal = +settings.weekGoal || 3;
  const week = settings.days ? `<div class="card stack"><h2 class="section-title" style="margin:0">Diese Woche</h2>
      <ol class="weekdots" aria-label="Übungstage diese Woche">${wk.map((d, i) => `<li class="${days.includes(d) ? "on" : ""}${d === today ? " today" : ""}"><span class="dot" aria-hidden="true">${days.includes(d) ? "●" : "○"}</span><span>${names[i]}</span><span class="sr">${days.includes(d) ? "geübt" : "nicht geübt"}</span></li>`).join("")}</ol>
      <p>${nWeek ? `An ${nWeek} ${nWeek === 1 ? "Tag" : "Tagen"} geübt${nWeek >= goal ? " – dein Wochenrhythmus ist erfüllt." : `. Dein Rhythmus: ${goal} ${goal === 1 ? "Tag" : "Tage"} pro Woche.`}` : "Diese Woche noch nicht geübt – jeder Tag ist ein guter Anfang."}</p>
      <p class="small muted">Insgesamt an ${days.length} ${days.length === 1 ? "Tag" : "Tagen"} geübt. Pausen gehören dazu – hier geht nichts verloren.</p></div>` : "";
  // Kurzübungen
  const kuList = [...(ku.MIX && ku.MIX.runs ? [{id:"MIX", titel:"Gemischte Runde", typ:"wahl"}] : []), ...KU.uebungen.filter(u => ku[u.id] && ku[u.id].runs)];
  const kuCard = kuList.length ? `<div class="card stack"><h2 class="section-title" style="margin:0">Kurzübungen</h2><div class="row">${kuList.map(u => { const l = kuLevel(u.id, u.typ); return `<button class="chip" data-wegdeck="${u.id}">${pie(l)} ${esc(u.titel)} · ${LV[l][0]}</button>`; }).join("")}</div><p class="small muted">${pie(1)} entdeckt · ${pie(2)} geübt · ${pie(3)} sicher – Wörter statt Punkte.</p></div>` : "";
  const empIds = Object.keys(emp).filter(k => EMP_BY[k]), empHit = empIds.filter(k => emp[k].hit).length;
  const empCard = empIds.length ? `<div class="card stack"><h2 class="section-title" style="margin:0">Zuhören</h2><p>Du hast ${empIds.length} ${empIds.length === 1 ? "Person" : "Personen"} zugehört. ${empHit ? `${empHit} ${empHit === 1 ? "hat" : "haben"} sich von deiner Vermutung verstanden gefühlt.` : "Jede Vermutung ist eine Einladung – auch die, die nicht trifft."}</p></div>` : "";
  const fKeys = Object.keys(found).filter(k => FOUND[k]).sort((a, b) => found[a] - found[b]);
  const foundCard = fKeys.length ? `<div class="card stack"><h2 class="section-title" style="margin:0">Entdeckungen</h2><ul class="found">${fKeys.map(k => `<li><span class="fdot" aria-hidden="true">✦</span><span><b>${esc(FOUND[k].t)}</b><br><span class="small muted">${esc(FOUND[k].d)} · ${fmt(found[k])}</span></span></li>`).join("")}</ul><p class="small muted">Entdeckungen tauchen unterwegs auf – ohne Liste, was noch fehlt.</p></div>` : "";
  $("#wegBody").innerHTML = `<h1 class="section-title" style="font-size:24px">Mein Weg</h1>
    ${ready ? `<div class="notice row"><span class="grow">Deine letzten drei Gespräche liefen stark. Magst du es mit „${LEVELS[nextLvl].name}“ probieren?</span><button class="btn small" data-setlevel="${nextLvl}">Ja, ${LEVELS[nextLvl].name}</button></div>` : ""}
    <div class="two">${week}
      <div class="card stack"><h2 class="section-title" style="margin:0">Heute dran</h2>${due.length ? `<div class="row">${due.map(d => `<button class="chip" data-open="${esc(d.sid)}">${esc(d.title)} · ${esc(d.ago)}</button>`).join("")}</div><p class="small muted">Wiederholen nach 1, 3 und 7 Tagen festigt, was du geübt hast.</p>` : `<p class="muted">Heute ist kein Gespräch zum Wiederholen fällig.</p>`}</div>
    </div>
    <div class="two">${kuCard}${empCard}</div>
    ${hist.length ? `<div class="card stack"><h2 class="section-title" style="margin:0">Wie sicher du dich in Gesprächen fühlst</h2>${spark}</div>` : ""}
    ${foundCard}
    ${hist.length ? `<div class="card stack"><h2 class="section-title" style="margin:0">Deine Gespräche</h2><div class="tablewrap"><table class="hist"><thead><tr><th>Datum</th><th>Szenario</th><th>Begleitung</th><th>Art</th><th>Gefühl danach</th><th>Stärke</th></tr></thead><tbody>
      ${hist.slice(0, 20).map(h => `<tr><td>${fmt(h.at)}</td><td>${esc(h.title)}</td><td>${esc(LEVELS[h.level]?.name || "")}</td><td>${esc(modeName[h.mode] || "")}</td><td>${h.rating ? esc(RATES[h.rating - 1]) : "–"}</td><td>${esc(h.strength || "")}</td></tr>`).join("")}
      </tbody></table></div></div>` : ""}
    <p class="small muted">Alles hier liegt nur in diesem Browser. Löschen kannst du es in den Einstellungen.</p>`;
}
$("#wegBody").addEventListener("click", e => { const b = e.target.closest("[data-wegdeck]"); if(b){ selectTab("t-quiz"); startDeck(b.dataset.wegdeck); } });

/* ===================== Einstellungen (Feiern & Rückblick) ===================== */
function applyLernSettings(){
  const sw = (id, on) => { const el = $(id); if(el) el.setAttribute("aria-checked", !!on); };
  sw("#swAnim", settings.anim); sw("#swSound", settings.sound); sw("#swDays", settings.days);
  if($("#optWeek")) $("#optWeek").value = String(settings.weekGoal || 3);
}
for(const [id, key] of Object.entries({"#swAnim":"anim", "#swSound":"sound", "#swDays":"days"})) $(id)?.addEventListener("click", () => { settings[key] = !settings[key]; saveSettings(); applyLernSettings(); if(key === "sound" && settings.sound) chime(); });
$("#optWeek")?.addEventListener("change", e => { settings.weekGoal = +e.target.value; saveSettings(); });

/* ===================== Start ===================== */
init();
