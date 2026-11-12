# Bells

A voice assistant that lives on a heads-up display. Say **"Hey Bells"**, ask her to look into something, and she hands the job to a research agent, tells you when it lands, puts the report on screen as a wall of blocks and talks you through it.

![Bells starting a research job](docs/research.jpg)
![A report on the wall, mid walkthrough](docs/report.jpg)

Her face is an animated honeycomb: it breathes when idle, ripples with your voice while she listens, lifts apart into a turning gyroscope while she thinks, and pulses with her own voice when she speaks.

Bells is an independent build inspired by the teaser of Huw Prosser's assistant "rose" ([video](https://www.tiktok.com/@huwprosser/video/7702239095396764950)). It shares the idea, not any code or artwork.

## Run it

You need Node 20.12 or newer, and Chrome or Edge for the voice parts.

```bash
cd bells
npm install
cp .env.example .env      # then put your Anthropic API key in it
npm start
```

Open <http://127.0.0.1:4317>, click **Wake her up**, allow the microphone, and say "Hey Bells".

With no API key she still starts, in a clearly labelled demo mode: scripted replies and one built-in sample report, so you can see the whole display work before spending anything.

## Talking to her

| You do | What happens |
|---|---|
| Say "Hey Bells, ..." | She wakes and takes the rest of the sentence as the request. "Hey Bells" alone works too; she chimes and waits. |
| Answer after she speaks | For about twelve seconds after she finishes, she listens without the wake word, so "yes, put it up" just works. |
| Hold the space bar | Talk without the wake word. Release to send. |
| Type in the bar at the bottom (or press `/`) | Same as speaking. |
| Press Esc, or click her | Stops her mid-sentence. Clicking her when she is quiet toggles listening. |

Things to try:

- "Hey Bells, research the state of VR headsets."
- "Yes, put it on screen and walk me through it."
- "What did the report say about market share?"
- "Clear the screen."

**History** lists past reports and the conversation. **Tidy** stacks the notes and shrinks the grid so more of a wall fits. **Clear view** takes everything down. **Voice** picks her voice and how she listens.

## Her voice

By default she speaks with your browser's own speech synthesis and picks the closest match to how she is written: a dry, lowish British woman's voice. Edge's "Sonia" and Chrome's "Google UK English Female" are both good; the Voice panel lists everything your machine has, with rate and pitch.

For a studio-quality voice, set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`. The server then proxies each sentence to ElevenLabs, so the key never reaches the browser, and the comb moves to the real audio level.

## Settings

All in `.env` (see `.env.example`).

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Her brain. Without it she runs the demo. |
| `BELLS_OWNER` | `boss` | What she calls you. |
| `BELLS_MODEL` | `claude-opus-5-5` | Model for conversation. |
| `BELLS_RESEARCH_MODEL` | same as above | Model for the research agent. |
| `BELLS_EFFORT` / `BELLS_RESEARCH_EFFORT` | `low` / `high` | How hard each one thinks. Lower is faster and cheaper. |
| `BELLS_QUICK_SEARCH` | on | Lets her run a quick web search inside a normal reply. |
| `BELLS_FALLBACKS` | on | If a safety filter declines a request, the API retries it on a fallback model instead of leaving her silent. |
| `BELLS_RESEARCH_MINUTES` | `15` | Time limit for one research job. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | none | Premium voice. |
| `BELLS_CONTACT` | none | An email or URL sent to Wikipedia with picture lookups, as its API policy asks. Without it your browser does the lookups instead. |
| `HOST`, `PORT` | `127.0.0.1`, `4317` | Where the server listens. |

## What it costs, and who can use it

Bells runs on your Anthropic key. Conversation turns are small. A research job is the expensive part: it is a multi-minute agent run with web search, so expect it to cost far more than a chat reply. Use a smaller `BELLS_RESEARCH_MODEL` or lower `BELLS_RESEARCH_EFFORT` to bring that down.

The server has no login. It listens on your own machine only, refuses requests that come from other websites, and should stay that way: anyone who can reach the port can spend your credit.

Speech recognition is the browser's. In Chrome and Edge that means audio is sent to the browser vendor's recognition service while she is listening for her name; the Voice panel can turn the wake word off, and Mute stops listening altogether. Firefox has no speech recognition, so there you type.

## How it fits together

```
server.js            HTTP: static files, /api/chat (streamed), /api/events (research progress), /api/speak
lib/brain.js         conversation with Claude: persona, tools, history
lib/research.js      the research agent: web search in, blocks out
lib/store.js         reports on disk under data/
lib/images.js        Wikipedia lead images for picture blocks
public/js/app.js     wake word, attention, and performing replies in order
public/js/avatar.js  the honeycomb
public/js/voice.js   ears (speech recognition), mouth (speech), mic meter
public/js/hud.js     research cards, report wall, charts, panels
public/js/demo.js    the no-key demo brain and its sample report
public/js/hosted.js  Claude, voice and dictation from the page itself, when published as a claude.ai Artifact
```

Bells' reply streams back as speech and actions in the order she wrote them, and the display performs them in that order: a line, then the report going up, then the next line.

## Hosted, with no server

The same `public/` folder also runs as a claude.ai Artifact. There it has no server and no API key: it asks Claude through the viewer's own account, speaks in a Claude voice and takes dictation where the viewer's app offers them, and falls back to typing and captions where it doesn't. Two things differ from the local version. There is no wake word, because the platform only starts listening from a tap or key press: tap her, or hold space. And there is no web access, so a report is drafted from the model's own knowledge and labelled "from memory, no live sources".

## Tests

```bash
npm test
```

This runs the real server and the real Anthropic SDK against `test/fake-anthropic.js`, a scripted stand-in for the API that also enforces the API's rule that conversation history must be sent back unedited. It covers a full conversation: greeting, starting research, the agent recording blocks, the announcement, presenting and walking through.

`node test/fake-anthropic.js 4399` runs that stand-in by itself; start the server with `ANTHROPIC_BASE_URL=http://127.0.0.1:4399 ANTHROPIC_API_KEY=test` to drive the display without spending credit.
