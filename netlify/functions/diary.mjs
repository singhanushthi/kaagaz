// /api/diary — each signed-in person's diary (Google sign-in via Netlify Identity).
//   GET            -> { entries: [...] }   all of this person's pages
//   POST {entries} -> { saved: n }         add or update pages
//   DELETE ?id=…   -> { ok: true }         remove one page
// Pages are stored in Netlify Blobs under "<user id>/<entry id>", so nobody can read anyone else's diary.
import { getUser, refreshSession } from "@netlify/identity";
import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

function clean(e) {
  if (!e || !ID.test(e.id) || !DATE.test(e.date) || typeof e.poem !== "string" || !e.poem.trim()) return null;
  return {
    id: e.id.toLowerCase(),
    date: e.date,
    thoughts: str(e.thoughts, 80000),
    title: str(e.title, 200),
    poem: str(e.poem, 20000),
    lang: str(e.lang, 20),
    shape: str(e.shape, 20),
    feel: str(e.feel, 20),
    createdAt: str(e.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(e.updatedAt, 40) || new Date().toISOString(),
  };
}

export default async (req) => {
  // Writes must come from this site's own pages.
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    try {
      if (origin && new URL(origin).host !== new URL(req.url).host) return json({ error: "forbidden" }, 403);
    } catch {
      return json({ error: "forbidden" }, 403);
    }
  }

  try { await refreshSession(); } catch {}
  const user = await getUser();
  if (!user?.id) return json({ error: "signed_out" }, 401);

  const store = getStore({ name: "kaagaz-diary", consistency: "strong" });
  const prefix = `${user.id}/`;

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix });
    const entries = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
    entries.sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
    return json({ entries });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
    const list = Array.isArray(body?.entries) ? body.entries.slice(0, 500) : [];
    const good = list.map(clean).filter(Boolean);
    await Promise.all(good.map((e) => store.setJSON(prefix + e.id, e)));
    return json({ saved: good.length });
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!ID.test(id)) return json({ error: "bad_request" }, 400);
    await store.delete(prefix + id.toLowerCase());
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/diary" };
