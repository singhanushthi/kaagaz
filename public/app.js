import { buildPrompt, parsePoem } from "./prompt.js";

const $ = (id) => document.getElementById(id);
const form = $("f"), entry = $("entry"), count = $("count"), dateIn = $("entryDate");
const go = $("go"), goLabel = $("goLabel"), entryErr = $("entryErr"), runErr = $("runErr");
const result = $("result"), stamp = $("stamp"), loading = $("loading"), out = $("out");
const titleEl = $("ptitle"), poemEl = $("poem"), signEl = $("sign");
const thoughtsBox = $("thoughtsBox"), thoughtsText = $("thoughtsText");
const copyBtn = $("copy"), saveBtn = $("save"), againBtn = $("again"), toast = $("toast");
const diarySec = $("diary"), diaryList = $("diaryList"), diaryEmpty = $("diaryEmpty"), diaryCount = $("diaryCount");

const MAX_WORDS = 10000;
const DRAFT = "kaagaz-draft";
const LOCAL = "kaagaz-entries";
const EXAMPLE = {
  thoughts: "Woke up before my alarm again with that heavy feeling in my chest. Didn't want to face anything today. Made tea anyway and opened the window. Work is still a mess, but the report I was scared of is half done. Small win I guess.",
  title: "One more morning",
  poem: `The alarm rang
before I was ready to be anyone.
I made the tea anyway,
opened the window,
and let the day in.

Not everything is fine.
But not everything is broken, either.

What felt like a mountain yesterday
was only a stair today.
One stair is enough
to keep going.

Tomorrow I'll rise again.
Maybe slowly.
But I'll rise.`,
};

// Inside Claude the page writes with the viewer's Claude account; on the web it calls /api/poem.
const inClaude = !!(window.claude && typeof window.claude.use === "function");
let sample = null;
let current = EXAMPLE;      // the poem on screen
let currentEntry = null;    // the diary entry on screen, if any
let busy = false;

/* ---------- helpers ---------- */
const say = (msg) => { toast.textContent = msg; };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const localISO = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in the user's timezone
const asDate = (iso) => new Date(iso + "T00:00:00");
const fmtDay = (iso) => asDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtLong = (iso) => asDate(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const wordCount = (t) => (t.trim().match(/\S+/g) || []).length;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- writing page ---------- */
dateIn.value = localISO();
dateIn.max = localISO();
try { const d = localStorage.getItem(DRAFT); if (d) entry.value = d; } catch {}
function updateCount() {
  const n = wordCount(entry.value);
  count.textContent = `${n.toLocaleString("en-IN")} / 10,000 words`;
  count.classList.toggle("over", n > MAX_WORDS);
}
entry.addEventListener("input", () => {
  updateCount();
  entryErr.hidden = true;
  try { localStorage.setItem(DRAFT, entry.value); } catch {}
});
updateCount();

/* ---------- poem display ---------- */
function render({ title, poem }, animate) {
  titleEl.textContent = title || "Untitled";
  poemEl.replaceChildren(...poem.split("\n").map((t, i) => {
    const s = document.createElement("span");
    s.className = animate ? "l in" : "l";
    s.style.setProperty("--i", i);
    s.textContent = t;
    return s;
  }));
}

function show(e, { label, animate = false } = {}) {
  current = { title: e.title, poem: e.poem };
  currentEntry = e.id ? e : null;
  stamp.textContent = label || (e.date ? fmtLong(e.date) : "An example");
  signEl.textContent = e.date ? `kaagaz · ${fmtDay(e.date)}` : "kaagaz";
  thoughtsBox.hidden = !e.thoughts;
  thoughtsBox.open = false;
  thoughtsText.textContent = e.thoughts || "";
  loading.hidden = true;
  out.hidden = false;
  render(current, animate);
  againBtn.hidden = !currentEntry || !currentEntry.thoughts;
}
show(EXAMPLE);

function setLoading(on) {
  busy = on;
  go.disabled = on;
  againBtn.disabled = on;
  goLabel.textContent = on ? "Writing…" : "Make it a poem";
  loading.hidden = !on;
  out.hidden = on;
}

/* ---------- generate ---------- */
const MESSAGES = {
  too_short: "Write a line or two about your day first.",
  too_long: "That's more than 10,000 words. Shorten it a little and try again.",
  busy: "Lots of people are writing right now. Try again in a minute.",
  rate_limited: "Too many poems in a short time. Wait a minute, then try again.",
  not_configured: "The site isn't connected to an AI yet. Add an API key (OpenAI, Groq, OpenRouter, DeepSeek or Claude) in Netlify settings.",
  bad_key: "The AI key on the server isn't working. Check it in Netlify settings.",
  no_credit: "The AI account behind this site is out of credit. Please try again later.",
  offline: "You seem to be offline. Check your connection and try again.",
  not_granted: "Kaagaz needs your permission to write with Claude. Reload and choose Allow.",
  sampling_disabled: "Claude isn't available on this account.",
  session_expired: "You've been signed out of Claude. Sign in again, then try.",
  refused: "Couldn't write a poem from this page. Try telling it a little differently.",
  prompt_too_large: "That page is too long to send at once. Shorten it a little and try again.",
  unavailable: "This is a preview. Poems are written on the live Kaagaz site.",
};
const messageFor = (code) => MESSAGES[code] || "Something went wrong while writing. Try again in a moment.";

async function generate({ text, lang, shape, feel }) {
  if (inClaude) {
    if (!sample) throw { code: "unavailable" };
    try {
      const { text: raw } = await sample(buildPrompt(text, lang, shape, feel), { cache: false });
      const p = parsePoem(raw);
      if (!p.poem) throw { code: "empty" };
      return p;
    } catch (e) {
      throw { code: (e && e.code) || "upstream_error" };
    }
  }
  let res;
  try {
    res = await fetch("/api/poem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry: text, lang, shape, feel }),
    });
  } catch {
    throw { code: "offline" };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.poem) throw { code: data.error || "upstream_error" };
  return data;
}

async function write(input, existing) {
  if (busy) return;
  runErr.hidden = true;
  say("");
  setLoading(true);
  stamp.textContent = fmtLong(input.date);
  result.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  try {
    const p = await generate(input);
    const now = new Date().toISOString();
    const e = {
      id: existing?.id || uuid(),
      date: input.date,
      thoughts: input.text,
      title: p.title || "Untitled",
      poem: p.poem,
      lang: input.lang, shape: input.shape, feel: input.feel,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    setLoading(false);
    show(e, { animate: !reduceMotion() });
    if (!existing) {
      entry.value = "";
      try { localStorage.removeItem(DRAFT); } catch {}
      updateCount();
    }
    await saveEntry(e);
    say(`Saved in your diary for ${fmtDay(e.date)}.`);
  } catch (err) {
    setLoading(false);
    render(current, false);
    runErr.textContent = messageFor(err && err.code);
    runErr.hidden = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = entry.value.trim();
  if (text.length < 8) { entryErr.textContent = MESSAGES.too_short; entryErr.hidden = false; entry.focus(); return; }
  if (wordCount(text) > MAX_WORDS) { entryErr.textContent = MESSAGES.too_long; entryErr.hidden = false; entry.focus(); return; }
  let date = dateIn.value || localISO();
  if (date > localISO()) date = localISO();
  write({ text, date, lang: form.lang.value, shape: form.shape.value, feel: form.feel.value });
});
againBtn.addEventListener("click", () => {
  if (!currentEntry) return;
  write({ text: currentEntry.thoughts, date: currentEntry.date, lang: form.lang.value, shape: form.shape.value, feel: form.feel.value }, currentEntry);
});

/* ---------- copy ---------- */
copyBtn.addEventListener("click", async () => {
  const txt = `${current.title}\n\n${current.poem}`;
  try {
    await navigator.clipboard.writeText(txt);
    say("Copied");
  } catch {
    const r = document.createRange();
    r.selectNodeContents(poemEl);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    say("Selected. Copy it from your keyboard.");
  }
});

/* ---------- save as image (1080×1350, Instagram portrait) ---------- */
function wrap(ctx, text, max) {
  if (!text) return [""];
  const words = text.split(" "); const lines = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  return lines;
}

async function drawCard({ title, poem }, dateISO) {
  const W = 1080, H = 1350, CX = W / 2;
  const serif = '"Cormorant Garamond", "Tiro Devanagari Hindi", Georgia, serif';
  try {
    await Promise.all([
      document.fonts.load(`italic 500 80px ${serif}`, title),
      document.fonts.load(`500 46px ${serif}`, poem.slice(0, 200)),
      document.fonts.load(`40px "Tiro Devanagari Hindi"`, "कागज़"),
    ]);
  } catch {}
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#E4EBE3"; ctx.fillRect(0, 0, W, H);

  const arch = (inset) => {
    const l = 60 + inset, r = W - 60 - inset, b = H - 60 - inset, spring = 430;
    ctx.beginPath();
    ctx.moveTo(l, b); ctx.lineTo(l, spring);
    ctx.ellipse(CX, spring, (r - l) / 2, spring - 60 - inset, 0, Math.PI, 2 * Math.PI);
    ctx.lineTo(r, b); ctx.closePath();
  };
  arch(0); ctx.fillStyle = "#FBF6EA"; ctx.fill();
  ctx.strokeStyle = "rgba(168,130,47,.75)"; ctx.lineWidth = 2; arch(16); ctx.stroke();
  ctx.strokeStyle = "rgba(168,130,47,.35)"; ctx.lineWidth = 1.5; arch(26); ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#4B5958"; ctx.font = `500 24px Hind, sans-serif`;
  ctx.fillText("K A A G A Z", CX, 250);

  const maxW = 720, top = 400, bottom = H - 210;
  let size = 48, lines, lh;
  for (; size >= 22; size -= 2) {
    ctx.font = `500 ${size}px ${serif}`;
    lh = size * 1.6;
    lines = poem.split("\n").flatMap((l) => wrap(ctx, l, maxW));
    if (lines.length * lh <= bottom - top - size * 2.6) break;
  }
  ctx.fillStyle = "#7A2140";
  ctx.font = `italic 500 ${Math.round(size * 1.6)}px ${serif}`;
  ctx.fillText(title || "Untitled", CX, top);

  ctx.strokeStyle = "#A8822F"; ctx.lineWidth = 2; ctx.beginPath();
  const fy = top + size * 0.9;
  ctx.moveTo(CX - 90, fy); ctx.bezierCurveTo(CX - 45, fy, CX - 30, fy - 10, CX - 12, fy - 2);
  ctx.bezierCurveTo(CX - 4, fy + 4, CX + 4, fy + 4, CX + 12, fy - 2);
  ctx.bezierCurveTo(CX + 30, fy - 10, CX + 45, fy, CX + 90, fy); ctx.stroke();

  ctx.font = `500 ${size}px ${serif}`;
  const blockW = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)));
  ctx.textAlign = "left"; ctx.fillStyle = "#1E2A2B";
  let y = top + size * 2.6;
  for (const l of lines) { ctx.fillText(l, CX - blockW / 2, y); y += lh; }

  ctx.textAlign = "center";
  ctx.fillStyle = "#7A2140"; ctx.font = `34px "Tiro Devanagari Hindi", serif`;
  ctx.fillText("कागज़", CX, H - 130);
  ctx.fillStyle = "#4B5958"; ctx.font = `22px Hind, sans-serif`;
  ctx.fillText(fmtDay(dateISO || localISO()), CX, H - 92);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  say("Making your image…");
  try {
    const blob = await drawCard(current, currentEntry?.date);
    const file = new File([blob], "kaagaz-poem.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ files: [file], title: current.title });
      say("");
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kaagaz-poem.png";
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      say("Saved");
    }
  } catch (e) {
    say(e && e.name === "AbortError" ? "" : "Couldn't make the image. Try again.");
  } finally {
    saveBtn.disabled = false;
  }
});

/* =========================================================
   Diary: entries saved by date (thoughts + poem).
   Always kept on the device; synced to the account when signed in.
   ========================================================= */
let entries = [];
const sortEntries = () => entries.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
function persistLocal() {
  try { localStorage.setItem(LOCAL, JSON.stringify(entries)); }
  catch { say("This device is out of space for the diary. Sign in to keep it in your account."); }
}
function loadLocal() {
  try { entries = JSON.parse(localStorage.getItem(LOCAL) || "[]"); if (!Array.isArray(entries)) entries = []; } catch { entries = []; }
  // bring over poems kept in the earlier version of the app
  try {
    const old = JSON.parse(localStorage.getItem("kaagaz-diary") || "[]");
    if (Array.isArray(old) && old.length) {
      for (const o of old) entries.push({ id: uuid(), date: localISO(new Date(o.date)), thoughts: "", title: o.title, poem: o.poem, createdAt: o.date, updatedAt: o.date, synced: false });
      localStorage.removeItem("kaagaz-diary");
      persistLocal();
    }
  } catch {}
  sortEntries();
}

const cloud = { id: null, user: null, ready: false, google: false };
const strip = ({ synced, ...rest }) => rest;

// Talks to /api/diary (Netlify Function). The sign-in cookie is sent automatically.
async function api(method, body, query = "") {
  try { await cloud.id?.refreshSession(); } catch {}
  const res = await fetch("/api/diary" + query, {
    method,
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { setTimeout(() => setUser(null), 0); throw new Error("signed_out"); }
  if (!res.ok) throw new Error("http_" + res.status);
  return res.json();
}

async function saveEntry(e) {
  const rec = { ...e, synced: false };
  const i = entries.findIndex((x) => x.id === e.id);
  if (i >= 0) entries[i] = rec; else entries.push(rec);
  sortEntries(); persistLocal(); renderDiary();
  await pushPending();
}

async function pushPending() {
  if (!cloud.user) return;
  const pending = entries.filter((e) => !e.synced);
  if (!pending.length) { setSync("Saved to your Google account"); return; }
  setSync("Saving…");
  try {
    await api("POST", { entries: pending.map(strip) });
    pending.forEach((e) => { e.synced = true; });
    persistLocal(); renderDiary(); setSync("Saved to your Google account");
  } catch {
    setSync("Not saved online yet. Will try again.");
  }
}

async function pullDown() {
  if (!cloud.user) return;
  try {
    const { entries: remote } = await api("GET");
    const pending = entries.filter((e) => !e.synced);
    const ids = new Set(pending.map((e) => e.id));
    entries = [...pending, ...remote.filter((e) => !ids.has(e.id)).map((e) => ({ ...e, synced: true }))];
    sortEntries(); persistLocal(); renderDiary();
  } catch {
    setSync("Couldn't load your diary. Check your connection.");
  }
}

async function removeEntry(id) {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const [gone] = entries.splice(idx, 1);
  persistLocal(); renderDiary();
  if (currentEntry?.id === id) show(EXAMPLE);
  if (cloud.user && gone.synced) { try { await api("DELETE", null, "?id=" + encodeURIComponent(id)); } catch {} }
  say(`Removed ${fmtDay(gone.date)} from your diary.`);
  const undo = document.createElement("button");
  undo.type = "button"; undo.className = "undo"; undo.textContent = "Undo";
  undo.addEventListener("click", async () => { say("Restored."); await saveEntry(gone); });
  toast.append(undo);
}

/* ---------- diary list, grouped by month ---------- */
const ICON_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';

function entryRow(e) {
  const li = document.createElement("li");
  li.className = "entry-row";
  const open = document.createElement("button");
  open.type = "button"; open.className = "entry-open";
  open.setAttribute("aria-label", `${fmtLong(e.date)}: ${e.title || "Untitled"}`);
  const d = asDate(e.date);
  const day = document.createElement("span"); day.className = "day"; day.setAttribute("aria-hidden", "true");
  const dn = document.createElement("span"); dn.className = "day-n"; dn.textContent = d.getDate();
  const dw = document.createElement("span"); dw.className = "day-w"; dw.textContent = d.toLocaleDateString("en-IN", { weekday: "short" });
  day.append(dn, dw);
  const text = document.createElement("span"); text.className = "entry-text";
  const t = document.createElement("span"); t.className = "entry-title"; t.textContent = e.title || "Untitled";
  const f = document.createElement("span"); f.className = "entry-first"; f.textContent = e.poem.split("\n").find((l) => l.trim()) || "";
  text.append(t, f);
  if (e.thoughts) {
    const w = document.createElement("span"); w.className = "entry-wrote";
    w.textContent = "You wrote: " + e.thoughts.replace(/\s+/g, " ").slice(0, 90);
    text.append(w);
  }
  if (!e.synced && cloud.user) {
    const s = document.createElement("span"); s.className = "entry-pending"; s.textContent = "Waiting to sync";
    text.append(s);
  }
  open.append(day, text);
  open.addEventListener("click", () => {
    show(e);
    result.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  });
  const del = document.createElement("button");
  del.type = "button"; del.className = "entry-del"; del.innerHTML = ICON_DEL;
  del.setAttribute("aria-label", `Delete the entry for ${fmtLong(e.date)}`);
  del.addEventListener("click", () => removeEntry(e.id));
  li.append(open, del);
  return li;
}

function renderDiary() {
  const groups = new Map();
  for (const e of entries) {
    const k = asDate(e.date).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  diaryList.replaceChildren(...[...groups].map(([month, list]) => {
    const li = document.createElement("li"); li.className = "month";
    const h = document.createElement("h3"); h.className = "month-name"; h.textContent = month;
    const ul = document.createElement("ul"); ul.className = "month-list";
    ul.append(...list.map(entryRow));
    li.append(h, ul);
    return li;
  }));
  diaryEmpty.hidden = entries.length > 0;
  diaryCount.textContent = entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}` : "";
}

/* =========================================================
   Account: Continue with Google (Netlify Identity)
   ========================================================= */
const accLocal = $("accLocal"), accForm = $("accForm"), accIn = $("accIn"), accErr = $("accErr");
const accWho = $("accWho"), accSync = $("accSync"), accPic = $("accPic"), accCloud = $("accCloud");
const googleBtn = $("googleBtn");

function setSync(msg) { accSync.textContent = msg; }

function renderAccount() {
  const canSignIn = cloud.ready && cloud.google;
  accLocal.hidden = !!(cloud.user || canSignIn);
  accForm.hidden = !canSignIn || !!cloud.user;
  accIn.hidden = !cloud.user;
  if (!cloud.user) {
    accLocal.textContent = inClaude
      ? "Your diary is saved in this browser. Google sign-in works on the live app."
      : "Your diary is saved on this device.";
    return;
  }
  const u = cloud.user;
  accWho.textContent = u.name ? `${u.name} (${u.email})` : (u.email || "your Google account");
  if (u.pictureUrl) { accPic.src = u.pictureUrl; accPic.hidden = false; accCloud.hidden = true; }
  else { accPic.hidden = true; accCloud.hidden = false; }
}

googleBtn.addEventListener("click", () => {
  if (!cloud.id) return;
  accErr.hidden = true;
  googleBtn.disabled = true;
  googleBtn.querySelector("span").textContent = "Opening Google…";
  try { cloud.id.oauthLogin("google"); } // leaves the page and comes back signed in
  catch {
    googleBtn.disabled = false;
    googleBtn.querySelector("span").textContent = "Continue with Google";
    accErr.textContent = "Couldn't open Google sign-in. Please try again.";
    accErr.hidden = false;
  }
});

$("signOut").addEventListener("click", async () => {
  if (!cloud.id) return;
  try { await cloud.id.logout(); } catch {}
  cloud.user = null;
  // Saved pages live in the Google account; remove them from this device. Unsaved ones stay.
  entries = entries.filter((e) => !e.synced);
  persistLocal(); renderDiary(); renderAccount();
  if (currentEntry && !entries.some((e) => e.id === currentEntry.id)) show(EXAMPLE);
  say("Signed out. Your diary is safe in your Google account.");
});

async function setUser(u) {
  cloud.user = u || null;
  renderAccount();
  if (cloud.user) { await pushPending(); await pullDown(); }
}

async function initCloud() {
  renderAccount();
  if (inClaude) return;
  try { cloud.id = await import("./vendor/identity.js"); } catch { return; }
  try {
    const settings = await cloud.id.getSettings();
    cloud.google = !!settings?.providers?.google;
  } catch { return; } // Identity isn't switched on for this site yet
  cloud.ready = true;
  try {
    const back = await cloud.id.handleAuthCallback();
    if (back?.user) say("Signed in. Your diary now saves to your Google account.");
  } catch {
    accErr.textContent = "Google sign-in didn't finish. Please try again.";
    accErr.hidden = false;
  }
  await setUser(await cloud.id.getUser());
  cloud.id.onAuthChange((_event, user) => {
    if ((user?.id || null) !== (cloud.user?.id || null)) setTimeout(() => setUser(user), 0);
  });
  addEventListener("online", () => pushPending());
}

loadLocal();
renderDiary();
initCloud();

/* ---------- App: install + offline ---------- */
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const installBtn = $("install"), installHelp = $("installHelp"), installSteps = $("installSteps");
if (!inClaude) {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
  let deferred = null;
  installBtn.hidden = standalone;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });

  function stepsForThisDevice() {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) return [
      "Open this page in <strong>Safari</strong>.",
      "Tap the <strong>Share</strong> button (the square with an arrow).",
      "Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.",
    ];
    if (/android/i.test(ua)) return [
      "Open this page in <strong>Chrome</strong>.",
      "Tap the menu <strong>⋮</strong> at the top right.",
      "Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>, then <strong>Install</strong>.",
    ];
    return [
      "Use <strong>Chrome</strong> or <strong>Edge</strong>.",
      "Click the <strong>install icon</strong> at the right end of the address bar.",
      "Or open the browser menu and choose <strong>Install Kaagaz</strong> (in Chrome: Cast, save and share → Install page as app).",
    ];
  }

  installBtn.addEventListener("click", async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice.catch(() => ({}));
      deferred = null;
      if (outcome === "accepted") { installBtn.hidden = true; say("Kaagaz is on your home screen."); }
      return;
    }
    installSteps.innerHTML = stepsForThisDevice().map((t) => `<li>${t}</li>`).join("");
    installHelp.hidden = false;
    installHelp.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
    $("installClose").focus();
  });
  $("installClose").addEventListener("click", () => { installHelp.hidden = true; installBtn.focus(); });
  addEventListener("appinstalled", () => { installBtn.hidden = true; installHelp.hidden = true; });
}
if (location.hash === "#diary") diarySec.focus();
if (location.hash === "#entry") entry.focus();

/* ---------- inside Claude ---------- */
if (inClaude) {
  saveBtn.hidden = true; // downloads are blocked in the Claude viewer
  $("privacy").hidden = true;
}
