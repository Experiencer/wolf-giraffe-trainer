// GET /api/config – sagt der App, welche Schlüssel auf dem Server hinterlegt sind (ohne sie zu verraten).
import { json } from "../lib/shared.js";

export default {
  async fetch() {
    return json({
      server: true,
      coach: Boolean(process.env.ANTHROPIC_API_KEY),
      realtime: Boolean(process.env.OPENAI_API_KEY),
      locked: Boolean(process.env.APP_ACCESS_CODE),
      realtimeModel: process.env.REALTIME_MODEL || "gpt-realtime-2.1",
    });
  },
};
