# Kaagaz

Write your day. Get back a poem, in your own words. English, हिंदी or Hinglish.

## What's inside

```
kaagaz/
├── netlify.toml                    Netlify settings (publishes /public)
├── package.json                    Server packages (Netlify installs them automatically)
├── netlify/edge-functions/poem.js  POST /api/poem: turns a page into a poem (OpenAI, Groq, OpenRouter, DeepSeek or Claude)
├── netlify/functions/diary.mjs     /api/diary: saves each signed-in person's diary (Netlify Blobs)
└── public/
    ├── index.html                  The page
    ├── styles.css                  Design (light + dark)
    ├── app.js                      Page logic, copy, "Save as image"
    ├── prompt.js                   The poet's instructions (shared)
    ├── manifest.webmanifest        Makes it installable as an app
    ├── sw.js                       Offline support (opens instantly, works without internet)
    ├── vendor/identity.js          Google sign-in library (Netlify Identity)
    ├── icons/                      App icons (Android, iPhone, maskable)
    └── favicon.svg
```

Your API key stays on Netlify's server. Visitors never see it. Diary pages are saved on the person's device,
and to their Google account on Kaagaz once they tap **Continue with Google**. Everything runs on Netlify.

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

## Accounts: "Continue with Google"

Without this, every page and poem is still saved in the diary, but only on that phone.
With it, people tap **Continue with Google** and their diary opens on any phone or computer.

1. In Netlify open your site → **Project configuration → Identity** → **Enable Identity**.
2. Under **Registration → External providers**, click **Add provider → Google**, keep
   **Use default configuration**, and save.
3. Under **Registration preferences**, keep **Open** so anyone can sign up.
4. Redeploy (Deploys → Trigger deploy). The Google button appears in **My diary**.

Nothing else to set up: the diary is stored in **Netlify Blobs** on your site, one record per page,
under each person's own account ID.

Notes
- Google's sign-in screen will say "Netlify" while you use the default configuration. To show "Kaagaz"
  instead, create your own OAuth client in Google Cloud Console and paste its ID and secret in the same
  Google provider settings (optional).
- Sign-in only works on the live site or a Deploy Preview, not with `netlify dev` on your computer.

### How the data is protected
- The diary function checks who is signed in on every request and only reads or writes that person's pages.
- Requests from other websites are refused.
- As the site owner you could technically see stored pages in Netlify's Blobs browser. Add a short
  privacy note before launching publicly, and don't open people's entries.
