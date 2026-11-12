// Bells, assembled: listen for the wake word, send what was said to the
// brain, and perform the reply - speech and HUD actions - in the order it
// was written.

import { Honeycomb } from "./avatar.js";
import { MicMeter, Ears, Mouth } from "./voice.js";
import { Cards, Wall, Panel, Readout } from "./hud.js";
import { connectBrain } from "./brain.js";

const $ = (id) => document.getElementById(id);

// Recognisers rarely spell "Bells" the same way twice. After "hey" a loose
// match is safe; without it, only her actual name at the start of a sentence.
const WAKE_LOOSE = /\b(?:hey|hi|hay|okay|ok|yo)[\s,]+(?:bell(?:['\u2019]s|es|e|a|s)?|bels|bills|bales|balls|vels)\b[\s,.!?]*/i;
const WAKE_STRICT = /^\s*(?:bell['\u2019]s|belles|bells)\b[\s,.!?]*/i;
const ATTEND_MS = 8000;
const FOLLOW_UP_MS = 12000;

function wakeMatch(text) {
  const match = WAKE_LOOSE.exec(text) ?? WAKE_STRICT.exec(text);
  return match ? { rest: text.slice(match.index + match[0].length).trim() } : null;
}

/** Cuts a stream of text into sentences as they complete. */
class Sentences {
  buffer = "";
  /** @param {boolean} whole  keep everything until flush(), for voices that take a paragraph at a time */
  constructor(whole = false) {
    this.whole = whole;
  }
  push(delta) {
    this.buffer += delta;
    const out = [];
    if (this.whole) return out;
    for (;;) {
      const match = /[.!?…]+["')\]]*\s+/.exec(this.buffer);
      if (!match) break;
      const end = match.index + match[0].length;
      const sentence = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end);
      if (sentence) out.push(sentence);
    }
    return out;
  }
  flush() {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest;
  }
}

/** Speech and actions, strictly in order. */
class Stage {
  items = [];
  running = false;
  epoch = 0;

  constructor(mouth, readout, hooks) {
    this.mouth = mouth;
    this.readout = readout;
    this.hooks = hooks;
  }

  get active() {
    return this.running || this.items.length > 0;
  }

  say(text) {
    this.mouth.prepare(text);
    this.items.push({ say: text });
    this.#run();
  }

  act(fn) {
    this.items.push({ act: fn });
    this.#run();
  }

  /** Speaks a line right now, from inside an action. False if she was stopped. */
  async line(text, epoch = this.epoch) {
    if (epoch !== this.epoch) return false;
    this.readout.say(text);
    this.hooks.spoke(text);
    await this.mouth.say(text);
    return epoch === this.epoch;
  }

  /** Speaks several lines back to back, calling onStep as each one starts. */
  async recite(steps, onStep, epoch = this.epoch) {
    if (epoch !== this.epoch) return false;
    await this.mouth.recite(
      steps.map((step) => step.say),
      (i) => {
        if (epoch !== this.epoch) return;
        this.readout.say(steps[i].say);
        this.hooks.spoke(steps[i].say);
        onStep(i);
      },
      () => epoch === this.epoch,
    );
    return epoch === this.epoch;
  }

  stop() {
    this.epoch++;
    this.items = [];
    this.mouth.stop();
    this.readout.hush(200);
  }

  async #run() {
    if (this.running) return;
    this.running = true;
    this.hooks.started();
    const epoch = this.epoch;
    while (this.items.length && epoch === this.epoch) {
      const item = this.items.shift();
      try {
        if (item.say) await this.line(item.say, epoch);
        else await item.act(epoch);
      } catch (err) {
        console.error("[bells] performance step failed", err);
      }
    }
    this.running = false;
    if (this.items.length) return this.#run();
    this.readout.hush();
    this.hooks.drained();
  }
}

/* ----------------------------------------------------------------- set-up */

const prefs = { wake: true, followUp: true, voice: "", hostedVoice: "", rate: 0.98, pitch: 0.9, premium: true, captionsOnly: false };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem("bells.prefs") || "{}"));
} catch {
  /* private window: defaults */
}
function savePrefs() {
  try {
    localStorage.setItem("bells.prefs", JSON.stringify(prefs));
  } catch {
    /* not persisted */
  }
}

document.body.dataset.phase ??= "boot";
document.body.dataset.avatar ??= "idle";

const avatar = new Honeycomb($("comb"));
const meter = new MicMeter();
const mouth = new Mouth();
const readout = new Readout();
const wall = new Wall();
const panel = new Panel();
const cards = new Cards((id) => present(id));

Object.assign(mouth.settings, { voice: prefs.voice, hostedVoice: prefs.hostedVoice, rate: prefs.rate, pitch: prefs.pitch, premium: prefs.premium, captionsOnly: prefs.captionsOnly });

const app = {
  phase: "boot",
  attention: "asleep", // asleep | attending | followup
  busy: false, // a reply is still streaming in
  muted: false,
  micBlocked: false,
  talkKey: false,
  lines: [],
  pending: [], // finished research she hasn't mentioned yet
};

let brain = null;
let hosted = null; // platform voice and dictation, when published as a claude.ai Artifact
let attentionTimer = 0;
let speakingUntil = 0;

const stage = new Stage(mouth, readout, {
  started() {
    ears.pause();
  },
  /** The conversation log follows what was actually said, in the order it was said. */
  spoke(text) {
    const last = app.lines.at(-1);
    if (last?.who === "bells" && last.open) last.text += ` ${text}`;
    else app.lines.push({ who: "bells", text, open: true });
  },
  drained() {
    // Let the last word clear the speakers before listening again.
    setTimeout(() => {
      if (!stage.active) {
        ears.resume();
        syncEars();
      }
    }, 280);
    tryAnnounce();
  },
});

const ears = new Ears({
  interim(text) {
    if (stage.active || app.phase !== "live") return;
    if (app.attention === "asleep") {
      if (!prefs.wake || !wakeMatch(text)) return;
      attend();
    }
    const shown = wakeMatch(text)?.rest ?? text;
    if (shown) readout.hear(shown);
    keepAttending();
  },
  final(text) {
    if (stage.active || app.phase !== "live") return;
    let command = text;
    const woke = wakeMatch(text);
    if (app.attention === "asleep") {
      if (!prefs.wake || !woke) return;
      attend();
      command = woke.rest;
    } else if (woke) command = woke.rest;
    // Just her name: she is listening, say the rest.
    if (!command) return keepAttending();
    submit(command);
  },
  trouble(reason) {
    app.micBlocked = reason !== "network";
    app.earTrouble = reason;
    sleep();
  },
});

/* ------------------------------------------------------------- attention */

function attend() {
  if (app.attention === "asleep") mouth.chime();
  app.attention = "attending";
  keepAttending();
  syncEars();
}

function keepAttending(ms = ATTEND_MS) {
  clearTimeout(attentionTimer);
  if (app.talkKey) return;
  attentionTimer = setTimeout(sleep, ms);
}

function sleep() {
  clearTimeout(attentionTimer);
  app.attention = "asleep";
  if (talk.active) endDictation(false);
  syncEars();
}

/** Recognition only runs when it has a reason to: it streams audio off the machine. */
function syncEars() {
  const want = !hosted && Ears.supported && !app.muted && !app.micBlocked && app.phase === "live" && (prefs.wake || app.attention !== "asleep" || app.talkKey);
  if (want) ears.start();
  else ears.stop();
}

/* ------------------------------------------------- dictation (hosted page) */

// Inside a claude.ai Artifact the platform holds the microphone and hands the
// page words. It has to be started by a tap or key press, so there is no wake
// word there: tap Bells (or hold space), speak, and a pause sends it.
const talk = { active: false, text: "", timer: 0, pulse: 0 };
const PAUSE_MS = 1500;

function startDictation() {
  const dictation = hosted?.dictation;
  if (!dictation || talk.off || talk.active) return;
  // Straight from the tap: the platform refuses a start that comes any later.
  const starting = dictation.start();
  talk.active = true;
  talk.text = "";
  if (stage.active || app.busy) interrupt();
  app.attention = "attending";
  keepAttending();
  starting.catch((err) => {
    talk.active = false;
    if (err?.code === "not_granted" || err?.code === "unavailable") talk.off = true;
    app.attention = "asleep";
  });
}

/** Stops listening and, if asked, sends what was heard. */
async function endDictation(send = true) {
  if (!talk.active) return;
  talk.active = false;
  clearTimeout(talk.timer);
  clearTimeout(attentionTimer);
  await Promise.resolve(hosted.dictation.stop()).catch(() => {});
  const said = talk.text.trim();
  talk.text = "";
  app.attention = "asleep";
  if (send && said) submit(said);
}

function wireDictation(dictation) {
  dictation.onPartial(({ text }) => {
    if (!talk.active || !text) return;
    talk.pulse = performance.now();
    readout.hear(`${talk.text} ${text}`.trim());
    clearTimeout(talk.timer);
    keepAttending();
  });
  dictation.onFinal(({ text }) => {
    if (!talk.active) return;
    talk.pulse = performance.now();
    talk.text += text;
    readout.hear(talk.text.trim());
    keepAttending();
    clearTimeout(talk.timer);
    if (!app.talkKey) talk.timer = setTimeout(() => endDictation(true), PAUSE_MS);
  });
  dictation.onState(({ state }) => {
    // The platform's own Stop button, or the tab going out of view.
    if (state === "idle" && talk.active) endDictation(true);
  });
}

/* ------------------------------------------------------------------ turns */

function submit(text) {
  const said = text.trim();
  if (!said || !brain) return;
  readout.hear(said, { final: true });
  closeLine();
  app.lines.push({ who: "you", text: said });
  clearTimeout(attentionTimer);
  app.attention = "asleep";
  turn({ text: said });
}

/** Ends her current entry in the conversation log. */
function closeLine() {
  const last = app.lines.at(-1);
  if (last) last.open = false;
}

async function turn(payload) {
  closeLine();
  // Anything she was saying is cut off: the newest request wins.
  stage.stop();
  brain.abort();
  const mine = (turn.count = (turn.count ?? 0) + 1);
  app.busy = true;
  const sentences = new Sentences(mouth.paragraphs);
  let spoken = "";
  const flush = () => {
    const rest = sentences.flush();
    if (rest) stage.say(rest);
  };

  await brain.send(
    { ...payload, screen: wall.showing },
    {
      say(delta) {
        if (mine !== turn.count) return;
        spoken += delta;
        for (const sentence of sentences.push(delta)) stage.say(sentence);
      },
      action(action) {
        if (mine !== turn.count) return;
        flush();
        stage.act((epoch) => perform(action, epoch));
      },
      error(line) {
        if (mine !== turn.count) return;
        spoken += ` ${line}`;
        stage.say(line);
      },
    },
  );
  if (mine !== turn.count) return;
  flush();
  app.busy = false;

  // Once she has finished saying it, leave the mic open for an answer.
  const asked = /\?\s*$/.test(spoken.trim());
  stage.act(() => {
    if (hosted || !prefs.followUp || !Ears.supported || app.muted || payload.event?.type === "boot") return;
    app.attention = "followup";
    keepAttending(asked ? FOLLOW_UP_MS * 1.6 : FOLLOW_UP_MS);
    syncEars();
  });
}

/** Carries out one HUD action from the brain. */
async function perform(action, epoch) {
  switch (action.type) {
    case "research_started":
      cards.update(action.report);
      break;
    case "present_report":
      await present(action.id);
      break;
    case "focus_block":
      if (wall.showing !== action.id) await present(action.id);
      wall.focus(action.block);
      break;
    case "walk": {
      if (wall.showing !== action.id) await present(action.id);
      await stage.recite(action.steps, (i) => wall.focus(action.steps[i].block), epoch);
      wall.focus(null);
      break;
    }
    case "clear":
      clearView();
      break;
    default:
      console.warn("[bells] unknown action", action);
  }
}

async function present(id) {
  const report = await brain.report(id);
  if (!report) return;
  panel.close();
  cards.remove(id);
  wall.show(report);
  avatar.docked = true;
}

function clearView() {
  wall.hide();
  wall.focus(null);
  cards.clear();
  panel.close();
  avatar.docked = false;
}

/** Tells her about research that finished, once she is free to mention it. */
function tryAnnounce() {
  if (!brain || app.phase !== "live" || app.busy || stage.active || app.attention === "attending" || !app.pending.length) return;
  turn({ event: { type: "research_done", report_id: app.pending.shift() } });
}

function onResearch(summary) {
  // Jobs get a card while they run, and keep it until the report is opened.
  if (summary.status === "running" || cards.items.has(summary.id)) cards.update(summary);
  if (summary.status !== "running" && !summary.announced && !app.pending.includes(summary.id) && cards.items.has(summary.id)) {
    app.pending.push(summary.id);
    tryAnnounce();
  }
}

/* -------------------------------------------------------------- the frame */

function avatarState() {
  const now = performance.now();
  if (mouth.speaking) speakingUntil = now + 380; // bridges the gap between sentences
  if (now < speakingUntil && stage.active) return "speaking";
  if (mouth.speaking) return "speaking";
  if (app.busy || stage.active) return "thinking";
  if (app.phase === "live" && app.attention !== "asleep" && !app.muted) return "listening";
  return "idle";
}

function statusText(state) {
  if (state === "speaking") return "SPEAKING";
  if (state === "thinking") return "THINKING";
  if (hosted) {
    if (state === "listening") return "LISTENING // PAUSE OR TAP TO SEND";
    return hosted.dictation && !talk.off ? "STANDBY // TAP BELLS OR HOLD SPACE TO TALK" : "STANDBY // TYPE TO HER";
  }
  if (state === "listening") return app.attention === "followup" ? "LISTENING // GO ON" : "LISTENING";
  if (app.muted) return "MIC MUTED // TYPE TO HER";
  if (!Ears.supported) return "NO SPEECH RECOGNITION IN THIS BROWSER // TYPE TO HER";
  if (app.earTrouble === "network") return "SPEECH RECOGNITION OFFLINE // TYPE TO HER";
  if (app.micBlocked) return "MICROPHONE BLOCKED // TYPE TO HER";
  return prefs.wake ? 'STANDBY // SAY "HEY BELLS"' : "STANDBY // HOLD SPACE TO TALK";
}

function frame() {
  meter.read();
  readout.meter(meter);
  const state = avatarState();
  if (document.body.dataset.avatar !== state) document.body.dataset.avatar = state;
  avatar.set(state);
  if (app.phase === "live") readout.setStatus(statusText(state));
  requestAnimationFrame(frame);
}

avatar.source = () => {
  if (avatar.state === "speaking") return mouth.level;
  if (!hosted) return meter.level;
  // No microphone level reaches a hosted page; the comb answers to words arriving instead.
  return 0.18 + 0.7 * Math.max(0, 1 - (performance.now() - talk.pulse) / 450);
};
avatar.start();
requestAnimationFrame(frame);

/* ------------------------------------------------------------------- boot */

async function connect() {
  const link = await connectBrain();
  brain = link.brain;
  hosted = link.hosted;
  const label = $("brain-label");
  const showLabel = () => {
    label.textContent = brain.label;
    label.dataset.demo = String(brain.kind === "demo");
  };
  showLabel();
  brain.addEventListener("label", showLabel);
  mouth.serverVoice = brain.serverVoice;
  brain.addEventListener("research", (event) => onResearch(event.detail));
  const { reports } = await brain.connect();
  for (const summary of reports) {
    if (summary.status === "running") cards.update(summary);
    else if (!summary.announced && summary.finishedAt && Date.now() - summary.finishedAt < 3600_000) {
      cards.update(summary);
      app.pending.push(summary.id);
    }
  }

  const note = $("boot-note");
  if (hosted) {
    if (hosted.tts) mouth.attach(hosted.tts);
    mouth.onViewerStop = interrupt;
    if (hosted.dictation) wireDictation(hosted.dictation);
    $("chip-mute").hidden = true;
    document.querySelector(".meter").hidden = true;
    note.textContent =
      brain.kind === "hosted"
        ? `She runs on Claude through this page, using your account. ${hosted.dictation ? "Tap her to talk, or type." : "Type to her in the bar at the bottom."} She has no web access here, so her reports are written from memory.`
        : "Claude isn't available to this page here, so she is running a built-in demo.";
  } else if (brain.kind === "demo") {
    note.textContent = "No language model is connected, so she is running a built-in demo. Start the server with an ANTHROPIC_API_KEY for the real thing.";
  }
}
const connected = connect();

async function wake() {
  if (app.phase !== "boot") return;
  mouth.unlock();
  app.phase = "live";
  document.body.dataset.phase = "live";
  await connected;
  if (!hosted) app.micBlocked = !(await meter.start());
  syncEars();

  let greeted = 0;
  try {
    greeted = Number(sessionStorage.getItem("bells.greeted")) || 0;
    sessionStorage.setItem("bells.greeted", String(Date.now()));
  } catch {
    /* fine */
  }
  if (Date.now() - greeted > 5 * 60_000) turn({ event: { type: "boot" } });
  else tryAnnounce();
}

$("boot-go").addEventListener("click", wake);

/* --------------------------------------------------------------- controls */

function interrupt() {
  stage.stop();
  brain?.abort();
  app.busy = false;
  turn.count = (turn.count ?? 0) + 1;
}

$("bells").addEventListener("click", () => {
  if (app.phase === "boot") return wake();
  if (hosted) {
    if (talk.active) return endDictation(true);
    if (hosted.dictation && !talk.off) return startDictation();
    if (stage.active || app.busy) return interrupt();
    return $("say-input").focus();
  }
  if (stage.active || app.busy) return interrupt();
  if (app.attention === "asleep") attend();
  else sleep();
});
$("bells").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("bells").click();
});

$("say").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("say-input");
  const text = input.value;
  input.value = "";
  if (app.phase === "boot") await wake();
  if (text.trim()) submit(text);
});

$("chip-history").addEventListener("click", () => panel.history({ reports: brain?.reports() ?? [], lines: app.lines, onOpen: present }));

$("chip-voice").addEventListener("click", () =>
  panel.voice({
    mouth,
    prefs,
    hosted: Boolean(hosted),
    earsSupported: Ears.supported,
    onChange(change) {
      Object.assign(prefs, change);
      for (const key of ["voice", "rate", "pitch", "premium", "captionsOnly", "hostedVoice"]) if (key in change) mouth.settings[key] = change[key];
      if ("premium" in change) mouth.premiumFailures = 0;
      savePrefs();
      syncEars();
    },
    onTest() {
      stage.stop();
      stage.say("This is what I sound like, boss. Take it or leave it.");
    },
  }),
);

$("chip-tidy").addEventListener("click", (event) => {
  const on = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(on));
  wall.setTidy(on);
});

$("chip-clear").addEventListener("click", clearView);

$("chip-full").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

$("chip-mute").addEventListener("click", async (event) => {
  app.muted = !app.muted;
  event.currentTarget.setAttribute("aria-pressed", String(app.muted));
  if (app.muted) {
    meter.stop();
    sleep();
  } else if (app.phase === "live") {
    app.micBlocked = !(await meter.start());
    syncEars();
  }
});

const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");

document.addEventListener("keydown", (event) => {
  if (app.phase !== "live") {
    if (event.key === "Enter" && !typing()) wake();
    return;
  }
  if (event.key === "Escape") return interrupt();
  if (typing() || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "/") {
    event.preventDefault();
    $("say-input").focus();
  } else if (event.code === "Space" && !event.repeat && document.activeElement?.tagName !== "BUTTON") {
    // Hold to talk, no wake word needed.
    event.preventDefault();
    if (hosted) {
      app.talkKey = true;
      return startDictation();
    }
    if (!Ears.supported || app.muted || app.micBlocked) return;
    if (stage.active) interrupt();
    app.talkKey = true;
    clearTimeout(attentionTimer);
    attend();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code !== "Space" || !app.talkKey) return;
  app.talkKey = false;
  if (hosted) return endDictation(true);
  ears.finish();
  keepAttending(2500);
});

// For tests and for poking at her from the console.
window.bells = { app, stage, wall, cards, mouth, ears, avatar, submit, present, clearView, get brain() { return brain; } };
