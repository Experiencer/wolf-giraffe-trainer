// POST /api/coach – leitet Coach- und Rollenspiel-Anfragen an Claude weiter. Der Schlüssel bleibt auf dem Server.
import { json, accessDenied, readJson } from "../lib/shared.js";

const MODELS = {
  quick: process.env.COACH_MODEL_QUICK || "claude-haiku-4-5-20251001",
  default: process.env.COACH_MODEL || "claude-sonnet-5-5",
  complex: process.env.COACH_MODEL || "claude-sonnet-5-5",
};

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const denied = accessDenied(request);
    if (denied) return denied;
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return json({ error: "config", message: "ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt." }, 503);

    let body;
    try { body = await readJson(request); } catch (e) { return json({ error: "bad_request", message: e.message }, e.status || 400); }

    const model = MODELS[body.tier] || MODELS.quick;
    const raw = typeof body.input === "string" ? [{ role: "user", content: body.input }] : Array.isArray(body.input) ? body.input : [];
    // Nur user/assistant, aufeinanderfolgende gleiche Rollen zusammenführen, mit user beginnen und enden.
    const messages = [];
    for (const m of raw) {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim()) continue;
      const last = messages.at(-1);
      if (last && last.role === m.role) last.content += "\n\n" + m.content;
      else messages.push({ role: m.role, content: m.content });
    }
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length || messages.at(-1).role !== "user") return json({ error: "bad_request", message: "Eingabe muss mit einer Nutzer-Nachricht enden." }, 400);

    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 1500, messages }),
      });
    } catch (e) {
      return json({ error: "upstream_error", message: "Claude nicht erreichbar." }, 502);
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const status = r.status === 429 ? 429 : r.status === 401 || r.status === 403 ? 502 : 502;
      return json({ error: r.status === 429 ? "rate_limited" : "upstream_error", message: data?.error?.message || `Claude meldet ${r.status}` }, status);
    }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return json({ text, model });
  },
};
