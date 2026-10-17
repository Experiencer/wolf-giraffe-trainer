// Test-Server: emuliert Vercel lokal (statische Seite + /api/*). Anthropic und OpenAI werden NICHT aufgerufen,
// sondern mit festen Antworten nachgebildet – Tests kosten also kein Guthaben.
// Start:  node tests/devserver.mjs        (Port 8766, Zugangscode "geheim")
// Ohne Schlüssel testen:  NO_KEYS=1 node tests/devserver.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8766);
process.env.ANTHROPIC_API_KEY = "test-anthropic"; process.env.OPENAI_API_KEY = "test-openai"; process.env.APP_ACCESS_CODE = "geheim";
if (process.env.NO_KEYS) { delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.APP_ACCESS_CODE; }
globalThis.__calls = [];
function wav(ms = 300) { const n = Math.round(8000 * ms / 1000); const b = Buffer.alloc(44 + n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return b; }
globalThis.fetch = async (url, opts = {}) => {
  url = String(url); globalThis.__calls.push({ url, body: String(opts.body || "").slice(0, 3000) });
  if (url.includes("api.anthropic.com")) {
    const b = JSON.parse(opts.body); const all = b.messages.map(m => m.content).join("\n");
    let p;
    if (all.includes("TESTKRISE")) p = { antwort: "…", krise: true };   // A-24: KI meldet eine Krise
    else if (all.includes('"spiegel"')) p = all.includes("PERSON: Ja, genau")   // Klären – „Erzähl mal“
      ? { spiegel: "Verlässlichkeit ist dir wichtig – und du bist enttäuscht.", vermutung: { gefuehle: [], beduerfnisse: [] }, frage: "Ist etwas angekommen? Magst du weitergehen oder es hier stehen lassen?", genug_signal: true }
      : { spiegel: "Dein Bruder hat wieder kurzfristig abgesagt – und du bist richtig sauer.", vermutung: { gefuehle: ["enttäuscht"], beduerfnisse: ["Verlässlichkeit"] }, frage: "Bist du enttäuscht, weil du dich auf ihn verlassen können möchtest?", genug_signal: false };
    else if (all.includes('"schritt"')) p = { gut: "Du hast die Verallgemeinerung weggelassen.", schritt: "Ergänze noch einen Zeitpunkt." };
    else if (all.includes('"art"')) p = { art: "treffer", antwort: "Ja … genau das. Danke, dass du fragst.", coach: "Du hast Gefühl und Bedürfnis als Frage vermutet." };
    else if (all.includes('"einschaetzung"')) p = { einschaetzung: "Vermutlich ist sie gerade erschöpft und fühlt sich allein gelassen.", warum: "Wenn sie sich verstanden fühlt, kann sie dir auch zuhören.", vorschlag: "Klingt, als wärst du gerade echt am Limit – brauchst du mehr Unterstützung?" };
    else if (all.includes('"verlauf"')) p = { verlauf: "Ihr seid angespannt gestartet. Mit deiner Empathie-Vermutung wurde es ruhiger.", staerken: ["Du hast konkret beschrieben, was passiert ist.", "Du hast nach ihrem Bedürfnis gefragt."], lernfokus: "Formuliere am Ende eine kleine, machbare Bitte." };
    else if (all.includes('"probleme"')) p = { probleme: ["„Immer“ verallgemeinert – das löst Verteidigung aus."], o: "Als ich heute um 9:20 Uhr …", g: "war ich angespannt", b: "weil mir Verlässlichkeit wichtig ist", r: "Wärst du bereit, mir Bescheid zu geben, wenn es später wird?", alltag: "Ich war heute angespannt, als du später kamst – mir ist Verlässlichkeit wichtig. Magst du mir schreiben, wenn es später wird?" };
    else if (all.includes("Übungsszenario")) p = { titel: "Nachbar und die laute Musik", fokus: "Bitte statt Forderung", kontext: "Dein Nachbar hört nachts laute Musik. Du willst ihn freundlich ansprechen.", rolle: "Jonas, Nachbar, Mitte 30, fühlt sich schnell kritisiert", eroeffnung: "Ja? Was gibt’s denn?", verborgen: { gefuehle: ["unsicher", "gestresst"], beduerfnisse: ["Freiheit", "Anerkennung"] }, lernziel: "Eine konkrete, verhandelbare Bitte formulieren.", eskalation: "Bei Vorwurf: wird laut ('Ich darf ja wohl Musik hören!'). Bei Empathie: wird weicher ('Ehrlich gesagt hatte ich einen harten Tag.')." };
    else if (all.includes("Bewerte NUR die letzte Nutzer-Aussage")) p = { offenheit: 52, coach: { O: "g", G: "y", B: "r", R: "n", empathie: false, ohr: "ausdruck", gut: ["Du hast ruhig beschrieben, was passiert ist."], besser: "Sag noch, was dir wichtig ist.", lernform: "Als …, war ich …, weil mir … wichtig ist.", alltag: "Mir ist wichtig, dass wir das zusammen hinkriegen." } };
    else p = { antwort: "Okay… ja, ich bin gerade echt erschöpft.", offenheit: 55, coach: { O: "g", G: "g", B: "y", R: "r", empathie: false, ohr: "giraffe-innen", gut: ["Konkrete Beobachtung ohne Bewertung."], besser: "Nenne noch, was dir wichtig ist.", lernform: "Als ich …, war ich …, weil mir … wichtig ist. Wärst du bereit …?", alltag: "Mir ist wichtig, dass wir uns aufeinander verlassen können." } };
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(p) }] }), { status: 200 });
  }
  if (url.includes("/v1/realtime/client_secrets")) return new Response(JSON.stringify({ value: "ek_server123", expires_at: 1 }), { status: 200 });
  if (url.includes("/v1/audio/speech")) {
    // Beispielsätze der Stimmen-Vorschau („KI-Stimme“) dauern länger, damit der Zustand „Stopp“ im Test sichtbar bleibt
    let ms = 300; try { if (/KI-Stimme/.test(JSON.parse(opts.body).input || "")) ms = 2500; } catch (e) {}
    return new Response(wav(ms), { status: 200, headers: { "content-type": "audio/mpeg" } });
  }
  return new Response("blocked in test", { status: 599 });
};
const names = ["config", "coach", "realtime-session", "tts"]; const handlers = {};
for (const n of names) handlers[n] = (await import("file://" + ROOT + "/api/" + n + ".js?" + Date.now())).default;
createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname.startsWith("/api/")) {
    const h = handlers[u.pathname.slice(5)]; if (!h) { res.writeHead(404); return res.end(); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(u, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const r = await h.fetch(request);
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (u.pathname === "/__calls") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(globalThis.__calls)); }
  if (u.pathname === "/__reset") { globalThis.__calls = []; res.writeHead(200); return res.end("ok"); }
  if (u.pathname.startsWith("/pdf/") && /^[\w-]+\.pdf$/.test(u.pathname.slice(5))) {
    try { const pdf = await readFile(ROOT + u.pathname); res.writeHead(200, { "content-type": "application/pdf" }); return res.end(pdf); }
    catch (e) { res.writeHead(404); return res.end(); }
  }
  const html = await readFile(ROOT + "/index.html");
  res.writeHead(200, { "content-type": "text/html" }); res.end(html);
}).listen(PORT, () => console.log("listening " + PORT));
