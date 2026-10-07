// Gemeinsame Hilfsfunktionen für die Server-Funktionen (kein eigener Endpunkt).
import { timingSafeEqual } from "node:crypto";

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Optionaler Zugangscode: Ist APP_ACCESS_CODE gesetzt, muss jede Anfrage ihn im Header "x-access-code" mitschicken.
export function accessDenied(request) {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return null;
  const sent = request.headers.get("x-access-code") || "";
  const a = Buffer.from(sent), b = Buffer.from(code);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  return ok ? null : json({ error: "access", message: "Zugangscode fehlt oder ist falsch." }, 401);
}

export async function readJson(request, maxBytes = 200_000) {
  const text = await request.text();
  if (text.length > maxBytes) throw Object.assign(new Error("Anfrage zu groß"), { status: 413 });
  try { return JSON.parse(text || "{}"); }
  catch { throw Object.assign(new Error("Ungültiges JSON"), { status: 400 }); }
}
