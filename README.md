# Kaagaz

Write your day. Get back a poem, in your own words. English, हिंदी or Hinglish.

## What's inside

```
kaagaz/
├── netlify.toml                    Netlify settings (publishes /public)
├── supabase.sql                    Database setup for accounts + diary (run once)
├── netlify/edge-functions/poem.js  POST /api/poem: turns a page into a poem (OpenAI, Groq, OpenRouter, DeepSeek or Claude)
├── netlify/edge-functions/config.js GET /api/config: tells the app where the diary database is
└── public/
    ├── index.html                  The page
    ├── styles.css                  Design (light + dark)
    ├── app.js                      Page logic, copy, "Save as image"
    ├── prompt.js                   The poet's instructions (shared)
    ├── manifest.webmanifest        Makes it installable as an app
    ├── sw.js                       Offline support (opens instantly, works without internet)
    ├── icons/                      App icons (Android, iPhone, maskable)
    └── favicon.svg
```

Your API key stays on Netlify's server. Visitors never see it. Diary pages are saved on the person's device,
and in their own account (Supabase) once they sign in with email or phone.

## Put it live on Netlify (free)

Netlify Drop (drag-and-drop) only hosts plain files and will not run the poem function,
so use one of these two ways.

### Option A: GitHub (recommended)
1. Create a new GitHub repository and upload everything inside the `kaagaz` folder.
2. In Netlify: **Add new site → Import an existing project → GitHub**, pick the repo.
   Leave the build command empty. Publish directory is read from `netlify.toml`.
3. **Site configuration → Environment variables → Add a variable**
   - Add **one** AI key (see "Choose the AI that writes the poems" below), for example
     Key: `GROQ_API_KEY`, Value: your key
4. **Deploys → Trigger deploy → Deploy site.**
5. Optional: **Site configuration → Change site name** to get `kaagaz.netlify.app` (or any free name).

### Option B: Netlify CLI
```bash
npm install -g netlify-cli
cd kaagaz
netlify login
netlify init            # create the site
netlify env:set GROQ_API_KEY gsk_...   # or any provider key from the table below
netlify deploy --prod
```

## Choose the AI that writes the poems

Visitors never need an account with any AI company. The poem is written by **your** key on the server.
Add **one** of these in Netlify → Site configuration → Environment variables, then redeploy:

| Provider | Variable | Cost | Get a key | Default model |
|---|---|---|---|---|
| Groq | `GROQ_API_KEY` | Free tier (about 1,000 poems a day) | https://console.groq.com/keys | `openai/gpt-oss-120b` |
| OpenRouter | `OPENROUTER_API_KEY` | Free models (50 a day; 1,000 a day after a one-time $10 top-up) | https://openrouter.ai/keys | `google/gemma-4-31b-it:free` |
| OpenAI | `OPENAI_API_KEY` | Pay per use, prepaid credit | https://platform.openai.com/api-keys | `gpt-6-luna` |
| DeepSeek | `DEEPSEEK_API_KEY` | Pay per use, very cheap | https://platform.deepseek.com/api_keys | `deepseek-chat` |
| Claude | `ANTHROPIC_API_KEY` | Pay per use, best Hindi/Hinglish poems | https://console.anthropic.com | `claude-sonnet-5-5` |
| Anything else OpenAI-compatible (Together, Mistral, Fireworks…) | `AI_API_KEY` + `AI_BASE_URL` + `AI_MODEL` | Depends | Their dashboard | You choose |

Optional settings:

| Variable | What it does |
|---|---|
| `AI_MODEL` | Use a different model from that provider (copy the exact model name from their docs) |
| `AI_PROVIDER` | If you added several keys, pick one: `groq`, `openrouter`, `openai`, `deepseek`, `claude` or `custom` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Turn on accounts and the synced diary (see below) |

**Tips**
- Free models change often. If OpenRouter says a model is unavailable, pick another one ending in `:free`
  from https://openrouter.ai/models and set it as `AI_MODEL`.
- Free tiers (Groq, OpenRouter) may use prompts to improve their services or have limits. Check their terms,
  and mention in your privacy note which AI writes the poems.
- Start free with Groq. If you want more beautiful Hindi/Hinglish poems later, switch to Claude or OpenAI
  by adding that key and setting `AI_PROVIDER`.

## Keep costs safe
For paid providers, set a **monthly spend limit** in their dashboard before you share the link widely.

## Run it on your computer
```bash
npm install -g netlify-cli
cd kaagaz
echo "GROQ_API_KEY=gsk_..." > .env
netlify dev
```
Then open http://localhost:8888

## Kaagaz as an app

Kaagaz is a PWA (installable web app). Once it's live on Netlify:

- **Android (Chrome):** open the site, tap **Install app** at the top (or menu ⋮ → Install app).
- **iPhone (Safari):** tap **Share → Add to Home Screen**. The site shows this hint on iPhones.
- **Desktop (Chrome/Edge):** click **Install app**, or the install icon in the address bar.

It opens full screen with its own icon, keeps a **My diary** of saved poems on the device,
and opens even without internet (writing a new poem needs internet).

### Put it on the Google Play Store (optional)
1. Deploy to Netlify first and make sure the site works.
2. Go to https://www.pwabuilder.com, paste your Netlify URL, click **Package for stores → Android**.
3. Download the package. It contains an `.aab` file and an `assetlinks.json` file.
4. Put `assetlinks.json` at `public/.well-known/assetlinks.json`, redeploy.
5. Create a Google Play Console account (one-time $25 fee), create an app, upload the `.aab`.

The iPhone App Store also works through PWABuilder, but needs a Mac and an Apple Developer
account ($99/year). Add to Home Screen is free and gives almost the same experience.

## Accounts: save the diary with email or phone (Supabase)

Without this, every page and poem is still saved in the diary, but only on that phone.
With it, people sign in with a 6-digit code (no password) and their diary opens on any device.

1. Create a free project at https://supabase.com (pick the **Mumbai** region for India).
2. **SQL Editor → New query**: paste everything from `supabase.sql`, click **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
   In Netlify add them as `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then redeploy.
4. **Authentication → URL Configuration**: set **Site URL** to your Netlify address
   (for example `https://kaagaz.netlify.app`).
5. **Email codes** (works on the free plan):
   **Authentication → Email Templates → Magic Link**, make the message include the code, for example:
   ```html
   <h2>Your Kaagaz code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>Or tap to sign in: <a href="{{ .ConfirmationURL }}">Open Kaagaz</a></p>
   ```
   Supabase's built-in email sender is limited to a few emails per hour. Before sharing widely, connect
   a free email sender under **Project Settings → Authentication → SMTP Settings** (Resend or Brevo both have free plans).
6. **Phone codes (SMS)** cost money per message, so they are off until you choose to turn them on:
   **Authentication → Sign In / Providers → Phone**, enable it and connect an SMS provider
   (Twilio, MessageBird, Vonage or Textlocal). Until then, the app tells people to use email.

### How the data is protected
- Each diary page is one row in the `entries` table: date, what they wrote, the poem.
- Row Level Security means a signed-in person can only read, add, change or delete **their own** rows.
- The anon key in the app is meant to be public; it can't read anyone's diary without that person's sign-in.
- As the project owner, you can see rows in the Supabase dashboard. Say so in a short privacy note
  before you launch publicly, and don't browse people's entries.
