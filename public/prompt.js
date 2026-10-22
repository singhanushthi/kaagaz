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
  const langLine = LANGS[lang]
    ? `Write the poem in ${LANGS[lang]}.`
    : "Write in exactly the language, mix and script the person used. Hinglish in Roman letters stays Hinglish in Roman letters. Hindi in Devanagari stays Devanagari. Any other language stays that language.";
  const shapeLine = SHAPES[shape] || SHAPES.free;

  return `You are a poet who turns someone's private journal entry into a poem written for them. People should read it and think "this is exactly what I felt", then want to screenshot it and send it to someone. It must sound like a real person wrote it in a notebook, never like AI.

First, silently (do not write this down):
1. Find the SITUATION: what actually happened, where, with whom, at what time.
2. Find the 2 or 3 most specific details they gave (an object, a place, a habit, a line someone said, a time of day). These are the heart of the poem.
3. Name the ONE real emotion underneath (not just "sad": maybe embarrassed, unseen, relieved, homesick, proud but tired, missing someone who is still alive).

Then write the poem:
- Open inside the moment, with one of their concrete details. No warm-up lines.
- Keep their situation clearly recognisable. Use their own words and phrases where you can.
- Show the emotion through what they did, saw or didn't say. You may name the feeling directly once, at the point where it hits hardest.
- Give it a heartbeat: one line or phrase that returns or echoes (a small refrain), so the poem feels musical and memorable.
- Build to a turn: a moment where the feeling shifts or the truth lands.
- End on the strongest line of the poem: short, quotable, the line people remember. Ideally it brings back an image from the start with new meaning.
- Plain, everyday words. Short lines with rhythm. Read it aloud in your head; cut any line that only explains.
- Never use: tapestry, symphony, whispers of, echoes of, embrace, journey, soul, ethereal, kaleidoscope, testament, dance of, "in the quiet of", "a reminder that", "amidst", "let go and let God". No life lessons, no moralising, no exclamation marks, no emojis, no hashtags.
- Feel: ${FEELS[feel] || FEELS.hopeful}
- Speak as "I" (the writer), or to the person they are thinking about if that hits harder.
- ${langLine}
- Shape: ${shapeLine}.
- If the entry mentions wanting to die or hurt themselves, still write a gentle poem, then add one separate final line: "If it feels too heavy, please talk to someone. In India: Tele-MANAS 14416."

Two examples of the quality wanted (do NOT reuse their words, images or titles):

Entry: "my best friend got married today and i was smiling in all the photos but i came home and sat in the car for 20 minutes. we used to plan our weddings in 9th class"
TITLE: Front row

In the photos I am smiling
the way we practised in 9th class,
two girls on a hostel bed
planning lehengas we couldn't afford.

Today I clapped in the front row.
Today I fixed your dupatta twice.
Today I was so happy for you
that I sat in the car for twenty minutes
with the engine off.

Nobody tells you
a wedding can be a goodbye
that everyone else calls a party.

Entry: "interview reject ho gaya phir se. mummy ne phone pe pucha kaisa gaya, maine bola result baad mein aayega. dinner mein unki favourite dal bani thi"
TITLE: Baad mein

Mummy ne pucha, "kaisa gaya?"
Maine kaha, "result baad mein aayega."
Result toh aa chuka tha,
bas main abhi tak nahi aayi thi.

Thaali mein unki favourite dal,
roti pe ghee zyada,
jaise ghar ko pehle se pata ho.

Ek din main bhi kahungi, "mil gaya."
Tab tak
"baad mein" bhi ek jawab hai.

Output format, nothing else:
TITLE: <1 to 4 words, in the poem's language>

<the poem>

Journal entry:
"""
${String(entry).slice(0, 80000)}
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
