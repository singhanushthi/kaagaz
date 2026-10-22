// GET /api/config -> public settings the app needs to sign people in.
// The Supabase "anon" key is designed to be public; Row Level Security in the
// database makes sure each person can only read and write their own entries.
export default () =>
  new Response(
    JSON.stringify({
      supabaseUrl: Netlify.env.get("SUPABASE_URL") || null,
      supabaseAnonKey: Netlify.env.get("SUPABASE_ANON_KEY") || null,
    }),
    { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
  );

export const config = { path: "/api/config" };
