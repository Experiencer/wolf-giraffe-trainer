// POST /api/realtime-session – erzeugt einen kurzlebigen OpenAI-Sitzungsschlüssel (10 Min.) für das Echtzeit-Gespräch.
// Der eigentliche OpenAI-Schlüssel verlässt den Server nie.
import { json, accessDenied, readJson } from "../lib/shared.js";

const VOICES = ["marin", "cedar", "coral", "sage", "ash", "verse"];

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const denied = accessDenied(request);
    if (denied) return denied;
    const key = process.env.OPENAI_API_KEY;
    if (!key) return json({ error: "config", message: "OPENAI_API_KEY ist auf dem Server nicht gesetzt." }, 503);

    let body;
    try { body = await readJson(request, 50_000); } catch (e) { return json({ error: "bad_request", message: e.message }, e.status || 400); }

    const instructions = String(body.instructions || "").slice(0, 8000);
    const voice = VOICES.includes(body.voice) ? body.voice : "marin";
    const session = {
      type: "realtime",
      model: process.env.REALTIME_MODEL || "gpt-realtime-2.1",
      instructions,
      output_modalities: ["audio"],
      audio: {
        input: {
          noise_reduction: { type: "near_field" },
          transcription: { model: process.env.REALTIME_TRANSCRIBE_MODEL || "gpt-live-transcribe", language: "de" },
          turn_detection: { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true },
        },
        output: { voice },
      },
    };

    let r;
    try {
      r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 600 }, session }),
      });
    } catch (e) {
      return json({ error: "upstream_error", message: "OpenAI nicht erreichbar." }, 502);
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: r.status === 429 ? "rate_limited" : "upstream_error", message: data?.error?.message || `OpenAI meldet ${r.status}` }, r.status === 429 ? 429 : 502);
    const value = data.value || data?.client_secret?.value;
    if (!value) return json({ error: "upstream_error", message: "OpenAI lieferte keinen Sitzungsschlüssel." }, 502);
    return json({ value, expires_at: data.expires_at ?? null, model: session.model });
  },
};
