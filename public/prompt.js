// The poet's instructions. Shared by the browser (inside Claude) and the Netlify edge function.

export const LANGS = {
  auto: null,
  en: "English",
  hi: "Hindi, written in Devanagari script",
  hing: "Hinglish: Hindi and English mixed the way people text, written in Roman letters",
};

export const SHAPES = {
  free: "free verse, 10 to 18 short lines in 2 to 4 stanzas, no forced rhyme",
  nazm: "a nazm in the Hindi-Urdu tradition: flowing and conversational, 12 to 18 lines, a musical rhythm, rhyme only where it falls naturally",
  short: "very short, 4 to 6 lines only, like something scribbled on the back of a ticket, every line earning its place",
  rhyme: "12 to 16 lines in quatrains with soft, natural end rhymes that feel like a song lyric, never sing-song",
};

export const FEELS = {
  hopeful: "Let the poem sit honestly in the pain first, then turn. End on a small, believable note of strength or hope that comes from THEIR situation, the way a close friend would say it at 2 a.m. Never preachy. No slogans, no 'you got this', no 'everything happens for a reason'.",
  true: "Stay true to their mood all the way through. If the entry is sad, let the poem ache; it can end unresolved. Do not add hope they didn't feel.",
};

export function buildPrompt(entry, lang = "auto", shape = "free", feel = "hopeful") {
  const text = String(entry).slice(0, 80000);
  const words = (text.trim().match(/\S+/g) || []).length;
  const langLine = LANGS[lang]
    ? `Write the poem in ${LANGS[lang]}.`
    : "Write in exactly the same language, mix and script as the entry. Hinglish in Roman letters stays Hinglish in Roman letters. Hindi in Devanagari stays Devanagari. English stays English.";
  // A one-line entry gets a short poem; a long page can get a fuller one.
  const lengthLine = words < 25
    ? "The entry is short, so write a SHORT poem: 4 to 8 lines. Do not stretch it."
    : `Shape: ${SHAPES[shape] || SHAPES.free}.`;

  return `Turn this person's journal entry into a poem about THEIR day and THEIR feeling.

MOST IMPORTANT RULE: use only what they actually wrote.
- Do not invent people, places, events, objects or backstory that are not in the entry.
- Do not change what happened. If they wrote about work, the poem is about work. If they wrote about a breakup, it is about the breakup.
- Keep their key words and phrases. The person must instantly recognise their own day in it.
- Getting their situation exactly right matters more than sounding poetic.

How to write it:
- Simple, everyday words, the way a real person writes in a notebook. Short lines.
- Show the feeling through what they described. Name the feeling directly at most once.
- Make the last line the strongest: short, honest, memorable.
- A line may repeat once for rhythm if it fits naturally.
- No clichés: no tapestry, symphony, whispers, echoes, embrace, journey, soul, "in the quiet of", "a reminder that". No lessons, no preaching, no exclamation marks, no emojis.
- Feel: ${FEELS[feel] || FEELS.hopeful}
- Speak as "I" (the writer).
- ${langLine}
- ${lengthLine}
- If the entry mentions wanting to die or hurt themselves, still write a gentle poem, then add one separate final line: "If it feels too heavy, please talk to someone. In India: Tele-MANAS 14416."

Reply in exactly this format and nothing else:
TITLE: <1 to 4 words from their own situation>

<the poem>

Journal entry:
"""
${text}
"""`;
}

export function parsePoem(raw) {
  let text = String(raw || "").replace(/\r/g, "").trim();
  text = text.replace(/^```[a-z]*\n?|\n?```$/gi, "").trim();
  const m = text.match(/^[#*\s]*TITLE\s*:\s*(.+?)\s*\**\s*\n+/i);
  let title = "", poem = text;
  if (m) {
    title = m[1].replace(/^["'*_#]+|["'*_#]+$/g, "").trim();
    poem = text.slice(m[0].length);
  }
  poem = poem.replace(/^\s*\**\s*POEM\s*:\s*\**\s*\n?/i, "").replace(/^\*+|\*+$/g, "").trim();
  return { title, poem };
}
