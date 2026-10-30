// Pembaca body JSON + helper error. Kompatibel dengan req Vercel (body sudah
// diparse) dan req tiruan di pengujian (body object / stream).
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req === "object" && req !== null && Symbol.asyncIterator in Object(req)) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { return {}; }
  }
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}
export function bad(res, code, msg) {
  return res.status(code).json({ error: msg });
}
export function isDbDown(e) {
  return String((e && e.message) || "").includes("DATABASE_URL");
}
