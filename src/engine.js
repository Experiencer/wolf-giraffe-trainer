/* ===================== Grundlagen ===================== */
const SZ = __SZ__;
const QUIZ = __QUIZ__;
const IMG = {wolf:"__WOLF__", giraffe:"__GIRAFFE__"};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
  json(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  setJson(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const INSIDE_CLAUDE = !!(window.claude && window.claude.use);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SETTINGS_DEFAULT = {selfAssess:true, themVoice:true, coachVoice:true, readFeedback:false, hands:false, rate:1, rtVoice:"marin", coachTts:"sage", bvThem:"", bvCoach:"", live:true};
const settings = Object.assign({}, SETTINGS_DEFAULT, store.json("gfk.settings", {}));
const saveSettings = () => store.setJson("gfk.settings", settings);

const LEVELS = {
  gefuehrt: {name:"Geführt", sub:"meldet sich nach jedem Satz", gain:1.3, loss:0.8, auto:2,
    prompt:"Die Figur ist zugänglich: Sie öffnet sich spürbar, sobald echte Empathie oder ein ehrlicher, vorwurfsfreier Satz kommt."},
  begleitet:{name:"Begleitet", sub:"meldet sich kurz", gain:1, loss:1, auto:3,
    prompt:"Die Figur reagiert realistisch und öffnet sich schrittweise."},
  frei:     {name:"Frei", sub:"hört still zu – du rufst ihn", gain:0.7, loss:1.2, auto:0,
    prompt:"Die Figur ist hartnäckig: Sie bleibt länger bei ihrer Haltung und öffnet sich erst nach wiederholter, echter Empathie oder klarem, vorwurfsfreiem Ausdruck."}
};
const STUFE = {1:"Einstieg", 2:"Mittel", 3:"Herausfordernd"};
const moodWord = o => o < 20 ? "macht zu" : o < 40 ? "abwehrend" : o < 60 ? "unsicher" : o < 80 ? "hört zu" : "öffnet sich";

/* ===================== Vokabular & Schnellanalyse ===================== */
const FEEL = ["traurig","enttäuscht","frustriert","wütend","ärgerlich","verärgert","gereizt","genervt","irritiert","ängstlich","besorgt","nervös","unsicher","angespannt","gestresst","erschöpft","müde","überfordert","hilflos","verletzt","einsam","verzweifelt","verwirrt","ratlos","beschämt","verlegen","unruhig","erschrocken","niedergeschlagen","bedrückt","froh","erleichtert","dankbar","berührt","glücklich","zufrieden","ruhig","entspannt","gelassen","zuversichtlich","hoffnungsvoll","neugierig","stolz","sauer","bestürzt","schockiert","zerrissen","sorge","angst","ärger","wut","trauer","freude"];
const PSEUDO = {"übergangen":"verletzt / traurig","ignoriert":"einsam / traurig","abgelehnt":"traurig / verletzt","angegriffen":"erschrocken / wütend","ausgenutzt":"erschöpft / ärgerlich","bevormundet":"gereizt","manipuliert":"misstrauisch / ärgerlich","missverstanden":"frustriert","provoziert":"gereizt / wütend","verraten":"verletzt / enttäuscht","im stich gelassen":"enttäuscht / allein","nicht ernst genommen":"frustriert","nicht gesehen":"traurig / einsam","unter druck gesetzt":"angespannt","beschuldigt":"verletzt / ärgerlich","respektlos behandelt":"gekränkt / ärgerlich"};
const NEEDS = ["verbindung","nähe","aufmerksamkeit","wertschätzung","anerkennung","respekt","rücksicht","ruhe","schlaf","erholung","sicherheit","vertrauen","verlässlichkeit","zuverlässigkeit","klarheit","orientierung","unterstützung","hilfe","verständnis","gehört","gesehen","autonomie","selbstbestimmung","freiheit","wahlfreiheit","fairness","gerechtigkeit","ehrlichkeit","offenheit","gemeinschaft","zugehörigkeit","leichtigkeit","freude","spaß","kompetenz","beitrag","sinn","ordnung","planbarkeit","gegenseitigkeit","harmonie","frieden","austausch","kontakt","einbezogen","mitsprache","entlastung","gesundheit","schutz","würde","fürsorge","zeit für mich","raum"];
const BLOCKERS = [/kopf hoch/,/halb so (wild|schlimm)/,/nicht so schlimm/,/an deiner stelle/,/an ihrer stelle/,/beruhig(e)? dich/,/beruhigen sie sich/,/reg dich (doch )?nicht auf/,/ich verstehe ihren ärger/,/das ist (halt|nun mal) so/,/stell dich nicht so an/];
const WOLF = [
  [/\b(immer|nie|niemals|ständig|dauernd|jedes ?mal|schon wieder)\b/, "„Immer“, „nie“ oder „schon wieder“ verallgemeinern – das klingt nach Urteil statt Beobachtung."],
  [/\b(du bist|sie sind|der ist|die ist|das ist) (so |echt |total |voll |einfach |wirklich )?(egoistisch|faul|unmöglich|rücksichtslos|respektlos|unverschämt|unzuverlässig|kindisch|blöd|dumm|gemein|kalt|pedantisch|peinlich|lächerlich|unfähig|nervig|asozial|frech|ein witz|eine frechheit)/, "Ein Etikett über die Person löst meist Verteidigung aus."],
  [/\b(du musst|du sollst|du solltest|sie müssen|sie sollten|hör auf|lass das|sofort|gefälligst)\b/, "Das klingt nach Forderung – dem anderen bleibt kein freies Ja."],
  [/\bwenn (du|sie) (das )?nicht\b.*\b(dann|sonst)\b|\bsonst\b.*(vermieter|polizei|chef|anwalt|strafe|verbot)/, "Eine Drohung bringt höchstens Gehorsam, keine Verbindung."],
  [/\b(wegen dir|deinetwegen|du machst mich|du hast mich (so )?(wütend|traurig|fertig))\b/, "Hier bekommt der andere die Verantwortung für dein Gefühl."],
  [/\b(dein bruder|deine schwester|andere|alle anderen) (schaffen|kriegen|machen) das/, "Vergleiche blockieren Empathie."]
];
const SELFBLAME = /\b(ich bin (so |echt |einfach |total )?(blöd|dumm|unfähig|schlecht|ein idiot|ein versager|peinlich|wertlos)|meine schuld|ich hab'?s verbockt|ich kann (einfach )?nichts)\b/;
const JUSTIFY = /^(aber|ja aber|das stimmt (doch )?nicht|ich (konnte|hatte) (doch|halt|eben)|ich hab doch nur|das war doch nicht|sorry,? aber)/;
const has = (t, list) => list.find(w => t.includes(w));

function analyze(raw){
  const t = " " + raw.toLowerCase().replace(/[„“"]/g, "") + " ";
  const issues = [];
  let wolf = 0;
  WOLF.forEach(([re, msg]) => { if(re.test(t)){ issues.push(msg); wolf++; } });
  if(BLOCKERS.some(re => re.test(t))){ issues.push("Trösten oder Ratschläge kommen zu früh – erst verstehen, dann lösen."); wolf++; }
  if(JUSTIFY.test(t.trim())){ issues.push("Erst rechtfertigen heißt: Das Gegenüber fühlt sich nicht gehört."); wolf++; }
  const selfblame = SELFBLAME.test(t);
  if(selfblame) issues.push("Da spricht der innere Wolf. Welches Bedürfnis steckt in dem Vorwurf an dich selbst?");
  const empathy = /\b(bist du|sind sie|fühlst du dich|fühlen sie sich|geht es dir|geht es ihnen)\b[^?]*\?|\b(klingt|hört sich an|scheint),? (so,? )?als\b|\b(ist dir|ist ihnen|wäre dir|wäre ihnen)\b[^.?!]*\bwichtig\b|\b(brauchst du|brauchen sie|wünschst du dir|wünschen sie sich)\b/.test(t);

  let O = "n";
  if(WOLF[0][0].test(t) || WOLF[1][0].test(t)) O = "r";
  else if(/\b(gestern|heute|vorhin|eben|letzte[nr]? woche|am (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|als (du|sie|ich)|wenn ich (sehe|höre)|seit \d|um \d|\d+ ?(min|minuten|uhr|mal|tage|wochen|stunden))\b/.test(t)) O = "g";
  else if(!empathy) O = "y";

  let G = "r", pseudo = null;
  const fw = has(t, FEEL);
  for(const k in PSEUDO){ if(t.includes(k)){ pseudo = k; break; } }
  if(/ich (fühle|spüre) (mich )?(wie|als ob)|ich fühle,? dass|ich habe das gefühl,? dass|fühle mich von dir/.test(t)){ G = "r"; issues.push("„Ich fühle, dass …“ leitet einen Gedanken ein, kein Gefühl."); }
  else if(fw) G = "g";
  else if(pseudo){ G = "y"; issues.push(`„${pseudo}“ deutet, was der andere tut. Darunter liegt vielleicht: ${PSEUDO[pseudo]}.`); }
  if(G === "r" && !issues.some(i => i.includes("Gedanken"))) issues.push("Noch kein Gefühl genannt.");

  let B = "r";
  const nw = has(t, NEEDS);
  if(/\b(brauche|will|möchte|wünsche mir),? dass (du|sie)\b/.test(t)){ B = "y"; issues.push("„… dass du …“ ist eine Strategie. Welches Bedürfnis steckt dahinter?"); }
  else if(nw && /(wichtig|brauche|bedürfnis|wünsche mir|sehne mich|weil mir|weil ich)/.test(t)) B = "g";
  else if(nw) B = "y";
  else issues.push("Noch kein Bedürfnis genannt – was ist dir (oder dem anderen) wichtig?");

  let R = "r";
  if(/(wärst du bereit|wären sie bereit|würdest du|würden sie|magst du|möchtest du|könntest du|könnten sie|kannst du|können sie|bist du bereit|wäre es (für dich |für sie )?(ok|in ordnung|möglich)|was hältst du davon|wie wäre es)/.test(t) && t.includes("?")) R = "g";
  else if(WOLF[2][0].test(t) || WOLF[3][0].test(t)) R = "r";
  else if(t.includes("?")) R = "y";
  else if(!empathy) issues.push("Noch keine Bitte – was wünschst du dir konkret?");
  if(empathy) R = t.includes("?") ? "g" : "n";

  const lights = {O, G, B, R};
  const vals = Object.values(lights).map(v => v === "g" ? 2 : v === "y" ? 1 : 0);
  const pts = vals.reduce((a, b) => a + b, 0) + (empathy ? 3 : 0) - wolf * 3;
  let ear = "ausdruck";
  if(selfblame) ear = "wolf-innen";
  else if(wolf > 0 || /\bdu (hast|bist|machst|kommst|hörst)\b.*!/.test(t)) ear = "wolf-aussen";
  else if(empathy) ear = "giraffe-aussen";
  else if(fw && nw) ear = "giraffe-innen";
  let delta = 0;
  if(wolf > 0) delta = -12 * Math.min(wolf, 3);
  else if(empathy && (fw || nw)) delta = 28;
  else if(empathy) delta = 18;
  else { const greens = vals.filter(v => v === 2).length; delta = greens >= 3 ? 22 : greens === 2 ? 12 : greens === 1 ? 4 : -4; }
  return {lights, issues, empathy, wolf, ear, delta, pts, fw, nw, pseudo};
}
function coachSuggestion(a){
  if(a.wolf > 0 && !a.empathy && /Etikett|verallgemeinern/.test(a.issues.join()))
    return {g:"Als ich [konkrete Situation] gesehen habe, war ich [Gefühl], weil mir [Bedürfnis] wichtig ist. Wärst du bereit, [konkrete Handlung]?", a:"Beschreib nur, was passiert ist – ohne Urteil – und sag dann, was dir daran wichtig ist."};
  if(/rechtfertigen|Trösten/.test(a.issues.join()))
    return {g:"Bist du gerade [Gefühl], weil dir [Bedürfnis] wichtig ist?", a:"Zeig erst, dass du gehört hast, was im anderen los ist. Erklären kannst du später."};
  if(a.lights.G !== "g" && !a.empathy) return {g:"… und ich bin [traurig / besorgt / frustriert] …", a:"Sag dazu, wie es dir damit geht – mit einem Wort, das nur dich beschreibt."};
  if(a.lights.B !== "g") return {g:"… weil mir [Verlässlichkeit / Ruhe / Verbindung] wichtig ist.", a:"Sag, was dir wichtig ist – ohne die andere Person darin."};
  if(a.lights.R !== "g" && !a.empathy) return {g:"Wärst du bereit, [konkrete Handlung, Zeitpunkt]?", a:"Mach daraus eine konkrete Bitte, auf die auch ein Nein okay wäre."};
  return {g:"", a:"Bleib neugierig auf das, was hinter der nächsten Antwort steckt."};
}
function goodBetter(a, sug){
  const gut = [];
  if(a.lights.O === "g") gut.push("Du beschreibst konkret, was passiert ist.");
  if(a.lights.G === "g") gut.push(a.empathy ? `Du fragst nach dem Gefühl des anderen („${a.fw}“).` : `Du nennst dein Gefühl („${a.fw}“).`);
  if(a.lights.B === "g") gut.push(a.empathy ? "Du fragst, was dem anderen wichtig ist." : `Du sagst, was dir wichtig ist („${a.nw}“).`);
  if(a.lights.R === "g") gut.push(a.empathy ? "Als Frage formuliert – das lädt zum Antworten ein." : "Eine konkrete Bitte, auf die auch ein Nein möglich ist.");
  if(!gut.length && a.wolf === 0) gut.push("Ohne Vorwurf, Forderung oder Rechtfertigung.");
  if(!gut.length) gut.push("Du zeigst offen, dass dich etwas bewegt – daraus lässt sich ein Giraffensatz machen.");
  return {gut: gut.slice(0, 2), besser: a.issues.length ? a.issues[0] : sug.a};
}
function reactionParts(sz){
  const parts = String(sz.eskalation || "").split(/\.\s+(?=Bei )/);
  const take = s => { if(!s) return null; const q = s.match(/'([^']+)'/); if(q) return {say:q[1]}; const after = s.replace(/^Bei [^:]+:\s*/, "").replace(/\.$/, ""); return {narr:after}; };
  return {neg: take(parts[0]) || {say:"Na toll."}, pos: take(parts[1] || parts[0]) || {say:"Okay … erzähl."}};
}
const NEUTRAL = ["Hm. Und weiter?","Was willst du mir damit sagen?","Okay …","Ja, und?","Na ja. Ich weiß nicht.","Hm, mal sehen."];
const WARM = ["Danke, dass du das so sagst. Was wäre dir denn jetzt wichtig?","Okay. Das kann ich nachvollziehen. Wie machen wir das?","Ja … so hab ich das noch nicht gesehen.","Gut, dass wir darüber reden."];
const EAR_TEXT = {
  "wolf-innen":"Da spricht der innere Wolf: Der Satz richtet sich gegen dich selbst.",
  "wolf-aussen":"Da klingt der Wolf durch: Der Satz wirkt wie ein Vorwurf.",
  "giraffe-innen":"Giraffenohren nach innen: Du hörst auf deine eigenen Gefühle und Bedürfnisse.",
  "giraffe-aussen":"Giraffenohren nach außen: Du hörst auf die Gefühle und Bedürfnisse des anderen.",
  "ausdruck":"Du sagst, was in dir los ist."
};
const earFrom = s => { s = String(s || "").toLowerCase(); return s.includes("innen") && s.includes("wolf") ? "wolf-innen" : s.includes("wolf") ? "wolf-aussen" : s.includes("innen") ? "giraffe-innen" : s.includes("außen") || s.includes("aussen") || s.includes("empathie") ? "giraffe-aussen" : "ausdruck"; };
const FOCUS_TIP = {
  "Empathie":"Hör hinter die Worte: Welches Gefühl, welches Bedürfnis könnte das Gegenüber gerade haben? Frag es als Vermutung.",
  "Ehrlicher":"Starte mit einer Beobachtung, die eine Kamera aufnehmen könnte. Dann dein Gefühl, dein Bedürfnis, eine konkrete Bitte.",
  "Bitte":"Mach die Bitte konkret und machbar – mit Zeit oder Handlung. Und frag dich: Wäre ein Nein für dich okay?",
  "Nein":"Ein Nein ist ein Ja zu etwas anderem. Sag, wozu du Ja sagst – und zeig Verständnis für die Enttäuschung.",
  "Innerer":"Was sagt die innere Stimme – und welches unerfüllte Bedürfnis steckt dahinter? Bedauern statt Schuld.",
  "Bedauern":"Würdige beide Seiten: das Bedürfnis, das du damals schützen wolltest, und das, was dabei zu kurz kam.",
  "Wut":"Stopp. Welche Urteile hast du gerade über den anderen? Übersetze sie in deine Bedürfnisse.",
  "Wertschätzung":"Danke in drei Teilen: was der andere konkret getan hat, welches Bedürfnis das erfüllt hat, wie es dir damit geht.",
  "Konflikt":"Bring den Streit auf die Ebene der Bedürfnisse. Erst wenn beide sich gehört fühlen, nach Lösungen suchen.",
  "Vermitteln":"Lass jede Seite die Bedürfnisse der anderen wiederholen, bevor ihr über Lösungen sprecht.",
  "Feedback":"Konkrete Daten statt Etikett, dann dein Bedürfnis (z. B. Planbarkeit), dann eine Verbindungsfrage.",
  "Schützende":"Schützen ja, strafen nein. Danach: Verständnis für die Enttäuschung, dann dein Schreck und dein Bedürfnis nach Sicherheit.",
  "Entschuldigung":"Zuerst Verständnis für die Verletzung, dann ehrliches Bedauern, dann ein Angebot."
};

/* ===================== Verbindung: Claude (Coach) ===================== */
let SERVER = null, sample = null, accessCode = store.get("gfk.access") || "";
const keys = {anthropic: store.get("gfk.apikey") || "", openai: store.get("gfk.oakey") || ""};
const canLive = () => !!sample || !!(SERVER && SERVER.coach) || (!INSIDE_CLAUDE && !!keys.anthropic);
const liveOn = () => settings.live && canLive();
const canTts = () => !INSIDE_CLAUDE && (!!(SERVER && SERVER.tts) || (!SERVER && !!keys.openai));
const canRealtime = () => !INSIDE_CLAUDE && typeof RTCPeerConnection !== "undefined" && (!!(SERVER && SERVER.realtime) || (!SERVER && !!(keys.openai)) );

function looseJSON(text){
  try{ return JSON.parse(text); }catch(e){}
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/); if(f){ try{ return JSON.parse(f[1]); }catch(e){} }
  const s = text.indexOf("{"), e2 = text.lastIndexOf("}");
  if(s >= 0 && e2 > s){ try{ return JSON.parse(text.slice(s, e2 + 1)); }catch(e){} }
  throw {code:"invalid_json", message:"Antwort war kein JSON", text};
}
async function serverPost(path, body, signal){
  let r;
  try{ r = await fetch(path, {method:"POST", signal, headers:{"content-type":"application/json", "x-access-code":accessCode}, body:JSON.stringify(body)}); }
  catch(e){ throw {code: e && e.name === "AbortError" ? "cancelled" : "upstream_error", message:String(e)}; }
  if(r.headers.get("content-type")?.includes("audio")) return r;
  const d = await r.json().catch(() => ({}));
  if(!r.ok) throw {code: r.status === 401 ? "access" : d.error === "rate_limited" ? "rate_limited" : "upstream_error", message: d.message || ("Server meldet " + r.status)};
  return d;
}
async function llmJSON(input, {tier = "quick", signal} = {}){
  if(sample) return sample.json(input, {modelTier:tier, cache:false, signal});
  if(SERVER && SERVER.coach){ const d = await serverPost("/api/coach", {input, tier}, signal); return looseJSON(d.text || ""); }
  if(INSIDE_CLAUDE || !keys.anthropic) throw {code:"offline"};
  const msgs = typeof input === "string" ? [{role:"user", content:input}] : input;
  const merged = [];
  for(const m of msgs){ const last = merged[merged.length - 1]; if(last && last.role === m.role) last.content += "\n\n" + m.content; else merged.push({role:m.role, content:m.content}); }
  while(merged.length && merged[0].role !== "user") merged.shift();
  let r;
  try{
    r = await fetch("https://api.anthropic.com/v1/messages", {method:"POST", signal, headers:{"content-type":"application/json", "x-api-key":keys.anthropic, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model: tier === "quick" ? "claude-haiku-4-5-20251001" : "claude-sonnet-5-5", max_tokens:1500, messages:merged})});
  }catch(e){ throw {code: e && e.name === "AbortError" ? "cancelled" : "upstream_error", message:String(e)}; }
  if(!r.ok) throw {code: r.status === 401 || r.status === 403 ? "auth" : r.status === 429 ? "rate_limited" : "upstream_error", message: await r.text()};
  const d = await r.json();
  return looseJSON((d.content || []).filter(b => b.type === "text").map(b => b.text).join(""));
}

/* ===================== Stimme: Ausgabe ===================== */
const player = new Audio();
let audioUnlocked = false, browserVoices = [];
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
function unlockAudio(){
  if(audioUnlocked) return; audioUnlocked = true;
  try{ player.src = SILENT; player.play().catch(() => {}); }catch(e){}
  try{ if("speechSynthesis" in window){ const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } }catch(e){}
}
document.addEventListener("pointerdown", unlockAudio, {once:true, capture:true});
document.addEventListener("keydown", unlockAudio, {once:true, capture:true});
function loadBrowserVoices(){
  if(!("speechSynthesis" in window)) return;
  browserVoices = speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang));
}
if("speechSynthesis" in window){ loadBrowserVoices(); speechSynthesis.onvoiceschanged = () => { loadBrowserVoices(); if(typeof renderBrowserVoiceSelects === "function") renderBrowserVoiceSelects(); }; }
let speakGen = 0;   // zählt hoch, sobald etwas Neues gesprochen oder abgebrochen wird – laufende Ausgaben hören dann auf
function hushAll(){
  speakGen++;
  try{ player.pause(); player.removeAttribute("src"); player.load(); }catch(e){}
  try{ document.getElementById("avThem")?.classList.remove("talking"); }catch(e){}
  try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){}
}
async function fetchTts(text, who){
  const body = {text: text.slice(0, 1400), voice: who === "coach" ? settings.coachTts : settings.rtVoice, style: who, mood: who === "them" ? moodWord(SESSION.open) : ""};
  if(SERVER && SERVER.tts){
    const r = await serverPost("/api/tts", body);
    if(!(r instanceof Response)) throw {code:"upstream_error"};
    return r.blob();
  }
  const instr = who === "coach" ? "Sprich Deutsch als warmer, ruhiger Coach. Freundlich, klar, nicht zu schnell." : `Sprich Deutsch, natürlich und alltagsnah wie eine echte Person im Gespräch. Stimmung: ${body.mood}.`;
  const r = await fetch("https://api.openai.com/v1/audio/speech", {method:"POST", headers:{"Authorization":"Bearer " + keys.openai, "content-type":"application/json"}, body:JSON.stringify({model:"gpt-4o-mini-tts", voice:body.voice, input:body.text, instructions:instr, response_format:"mp3"})});
  if(!r.ok) throw {code:"upstream_error"};
  return r.blob();
}
function speakBrowser(text, who){
  return new Promise(res => {
    if(!("speechSynthesis" in window) || !text) return res();
    speechSynthesis.cancel();
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text.replace(/[\[\]„“"]/g, ""));
      u.lang = "de-DE";
      const name = who === "coach" ? settings.bvCoach : settings.bvThem;
      const v = browserVoices.find(x => x.name === name) || browserVoices[who === "coach" ? Math.min(1, browserVoices.length - 1) : 0];
      if(v) u.voice = v;
      u.rate = settings.rate; u.pitch = who === "coach" ? 1.05 : 0.95;
      let done = false; const fin = () => { if(!done){ done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
      setTimeout(() => { if(!speechSynthesis.speaking && !speechSynthesis.pending) fin(); }, 1500);
      setTimeout(fin, 2000 + text.length * 110);
    }, 80);
  });
}
/* v6: Text in Sprech-Stücke teilen. Der erste Satz kommt allein, damit die Stimme schnell startet;
   der Rest wird zu Stücken bis ca. 240 Zeichen zusammengefasst (höchstens 4 Stücke). */
function speechChunks(text){
  const parts = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+(?=[„"A-ZÄÖÜ0-9])/).filter(Boolean);
  const out = [];
  for(const p of parts){
    const i = out.length - 1;
    if(out.length >= 2 && (out[i].length + p.length < 240 || out.length >= 4)) out[i] += " " + p;
    else out.push(p);
  }
  return out;
}
/* Spielt eine Audiodatei ab. true = zu Ende gespielt oder bewusst angehalten, false = Abspielen nicht möglich. */
async function playBlob(blob){
  const url = URL.createObjectURL(blob);
  try{
    player.src = url; player.playbackRate = settings.rate;
    return await new Promise((res) => {
      player.onended = () => res(true); player.onerror = () => res(false);
      player.onpause = () => { if(!player.ended) res(true); };
      player.play().catch(() => res(false));
    });
  } finally { URL.revokeObjectURL(url); }
}
/* Spricht Text als Gegenüber ("them") oder Coach ("coach"). Natürliche Stimme über OpenAI, sonst Browser.
   v6: Alle Stücke werden gleichzeitig angefragt; das erste wird abgespielt, sobald es da ist. */
async function speak(text, who){
  if(!text) return;
  hushAll(); const gen = speakGen;
  speakingUI(who, true);
  try{
    if(canTts()){
      const chunks = speechChunks(text);
      const jobs = chunks.map(c => fetchTts(c, who).catch(e => { if(e && e.code === "access") askAccess(); return null; }));
      for(let i = 0; i < chunks.length; i++){
        const blob = await jobs[i];
        if(gen !== speakGen) return;
        const ok = blob ? await playBlob(blob) : false;
        if(gen !== speakGen) return;
        if(!ok){ await speakBrowser(chunks.slice(i).join(" "), who); return; }
      }
      return;
    }
    await speakBrowser(text, who);
  } finally { if(gen === speakGen) speakingUI(who, false); }
}
