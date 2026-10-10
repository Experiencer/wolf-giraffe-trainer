// POST /api/tts – liest einen kurzen Text mit einer natürlichen OpenAI-Stimme vor (Coach oder Gegenüber).
// Der OpenAI-Schlüssel bleibt auf dem Server. Antwort: MP3-Audio.
import { json, accessDenied, readJson } from "../lib/shared.js";

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"];
const MOODS = ["macht zu", "abwehrend", "unsicher", "hört zu", "öffnet sich"];

function instructionsFor(style, mood) {
  if (style === "coach") {
    return "Sprich Deutsch als warmer, ruhiger Coach für Gewaltfreie Kommunikation. Freundlich, klar, ermutigend, nicht zu schnell. Kurze Pausen zwischen den Sätzen.";
  }
  const m = MOODS.includes(mood) ? mood : "unsicher";
  return `Sprich Deutsch, natürlich und alltagsnah wie eine echte Person in einem schwierigen Gespräch. Grundstimmung gerade: ${m}. Nicht übertreiben, kein Theater.`;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const denied = accessDenied(request);
    if (denied) return denied;
    const key = process.env.OPENAI_API_KEY;
    if (!key) return json({ error: "config", message: "OPENAI_API_KEY ist auf dem Server nicht gesetzt." }, 503);

    let body;
    try { body = await readJson(request, 20_000); } catch (e) { return json({ error: "bad_request", message: e.message }, e.status || 400); }

    const text = String(body.text || "").trim().slice(0, 1400);
    if (!text) return json({ error: "bad_request", message: "Kein Text." }, 400);
    const voice = VOICES.includes(body.voice) ? body.voice : (body.style === "coach" ? "sage" : "marin");

    let r;
    try {
      r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.TTS_MODEL || "gpt-4o-mini-tts",
          voice,
          input: text,
          instructions: instructionsFor(body.style, body.mood),
          response_format: "mp3",
        }),
      });
    } catch (e) {
      return json({ error: "upstream_error", message: "OpenAI nicht erreichbar." }, 502);
    }
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return json({ error: r.status === 429 ? "rate_limited" : "upstream_error", message: data?.error?.message || `OpenAI meldet ${r.status}` }, r.status === 429 ? 429 : 502);
    }
    // v6: Audio direkt durchreichen, statt erst die ganze Datei auf dem Server zu sammeln.
    return new Response(r.body, { status: 200, headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  },
};
