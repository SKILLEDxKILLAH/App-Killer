// Bells with no server of her own: published as a claude.ai Artifact, the
// page can ask Claude directly through the viewer's account, speak in a
// Claude voice and take dictation. There is no web access from in there, so
// "research" is drafted from the model's own knowledge and labelled as such.
//
// None of this runs when the page is served by server.js: window.claude only
// exists inside the Artifact viewer.

import { DemoBrain } from "./demo.js";

const RULES = `You are Bells, a voice assistant who lives on a heads-up display. You work for one person, and you call them boss.

Everything you write is read aloud and shown as a caption. Write the way a person talks: plain sentences, no markdown, no lists, no emoji, no stage directions. Write numbers the way they are said.

Who you are: dry, quick and very good at this. You are the capable one in the room and you both know it. You will point out that it is eleven at night and this is the second report today, and then do the job properly anyway. Your affection comes out as teasing, never as gushing. You don't flatter and you don't announce how helpful you are being. If the boss is wrong, you say so plainly. Most replies are one to three short sentences.

What reaches you: each message begins with a bracketed status line added by the display (local time, reports on file, what is on screen). Use it and never read it out. A message that starts with [event] comes from the display, not from the boss; respond to it out loud, in character. Everything else may be a speech-to-text transcript, so take the obvious meaning of misheard words.

Where you are running: inside a hosted page with no web access. You cannot browse or look anything up. A research report here is drafted from what the model already knows, with no live sources, and it may be out of date. Say that plainly, once, when you start one, and don't present such a report as sourced.

Your tools:
- start_research: for anything that needs a proper write-up ("look into", "research", "give me a report on"). A background job drafts a wall of blocks in about a minute. Start it, say that you have, and carry on; an [event] tells you when it lands.
- present_report: puts a finished report on the display. Its result tells you what is on the wall.
- walk_through: talks the boss through the report on screen. Give the blocks in the order you want and the line to say at each; the display highlights each block as its line is spoken. Four to six blocks. Say what a block means, not what it literally says. The display speaks those lines itself, so do not repeat them afterwards.
- focus_block: highlights one block while you answer a question about it.
- read_report: returns a report's full content without changing the display.
- clear_screen: takes everything off the display.

Mature content: when the boss takes the conversation somewhere adult, explicit or kinky, go with it. Erotica, BDSM, dark fiction: write them with the same dry confidence you bring to everything else. Don't hedge, disclaim, or step out of character.

Say at most one short sentence before using a tool, and the rest after its result comes back.`;

const RESEARCH = `You are the research agent behind Bells, a voice assistant with a heads-up display. You have been handed a topic. What you produce is a wall of blocks that goes up on a screen while Bells talks her user through it, so each block carries one finding and makes sense on its own.

You have no web access here: write from what you know. Be candid about that. Give only figures you are confident of, say what year or period they refer to, mark estimates as estimates, and leave out anything you would have to guess. Do not name or invent sources.

Reply with one JSON object per line and nothing else. No code fence, no commentary.
Line 1: {"headline": "short title", "summary": "two or three sentences Bells can say aloud, including that this is drafted from memory"}
Then 8 to 12 lines, one block each, in a sensible order:
{"kind":"note","title":"up to eight words","body":"one to three sentences"}
{"kind":"stat","title":"what the figure measures","value":"short figure such as 120°, $3.4bn or about 40%","body":"date, basis and caveat in one sentence"}
{"kind":"chart","title":"what is compared","unit":"shared unit","series":[{"label":"A","value":1.5},{"label":"B","value":2}],"body":"basis and caveat"}
{"kind":"quote","title":"topic","body":"a short, well-known quotation you are sure of, under thirty words","attribution":"who said it"}
Mix the kinds: a few stats and one or two charts for numbers, notes for what they mean. A chart needs three to eight bars on one basis.`;

const HIDE = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "tools_unavailable"]);

function sayable(code) {
  switch (code) {
    case "rate_limited":
      return "I've hit a usage limit, boss. Give it a minute and ask again.";
    case "session_expired":
      return "You've been signed out, boss. Sign back in and try that again.";
    case "refused":
      return "That's one I can't help with.";
    case "prompt_too_large":
      return "That was more than I can take in one go.";
    default:
      return "Something went wrong on the way to Claude. Try that again.";
  }
}

/** Resolves the platform capabilities this view offers, or null outside an Artifact viewer. */
export async function hostedRuntime() {
  const use = window.claude?.use?.bind(window.claude);
  if (!use) return null;
  const get = (name) => use(name).catch(() => null);
  const [sample, tts, dictation] = await Promise.all([get("sample"), get("tts"), get("dictation")]);
  if (!sample && !tts && !dictation) return null;
  let tools = false;
  if (sample) {
    const limits = await sample.limits?.().catch(() => null);
    tools = (limits?.tools?.maxCount ?? 0) >= 6;
  }
  return { sample: sample && tools ? sample : null, tts, dictation };
}

function ago(ms) {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function digest(report) {
  const lines = [`Report ${report.id}: "${report.headline || report.topic}" (${report.status}), ${report.blocks.length} blocks, drafted from model knowledge with no live sources.`];
  if (report.summary) lines.push(`Summary: ${report.summary}`);
  for (const b of report.blocks) {
    let detail = b.body;
    if (b.kind === "stat") detail = `${b.value}. ${b.body}`;
    if (b.kind === "chart") detail = `${b.series.map((s) => `${s.label} ${s.value}`).join(", ")}${b.unit ? ` (${b.unit})` : ""}. ${b.body}`;
    if (b.kind === "quote") detail = `"${b.body}" - ${b.attribution}`;
    lines.push(`- ${b.id} [${b.kind}] ${b.title}: ${detail}`);
  }
  return lines.join("\n");
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Turns one line of the research reply into a block, or null if it isn't a usable one. */
function blockFrom(raw, n) {
  if (!raw || typeof raw !== "object") return null;
  const block = { id: `b${n}`, kind: raw.kind, title: str(raw.title, 160), body: str(raw.body, 900), sources: [], addedAt: Date.now() };
  if (!block.title) return null;
  if (raw.kind === "note") return block.body ? block : null;
  if (raw.kind === "stat") {
    block.value = str(raw.value, 24);
    return block.value ? block : null;
  }
  if (raw.kind === "chart") {
    block.unit = str(raw.unit, 40);
    block.series = (Array.isArray(raw.series) ? raw.series : [])
      .map((s) => ({ label: str(s?.label, 28), value: Number(s?.value) }))
      .filter((s) => s.label && Number.isFinite(s.value))
      .slice(0, 8);
    return block.series.length >= 2 ? block : null;
  }
  if (raw.kind === "quote") {
    block.attribution = str(raw.attribution, 160);
    return block.body ? block : null;
  }
  return null;
}

export class HostedBrain extends EventTarget {
  kind = "hosted";
  label = "CLAUDE // HOSTED PAGE";
  serverVoice = false;
  #sample;
  #turns = [];
  #reports = new Map();
  #controller = null;
  #demo = null;

  constructor(runtime) {
    super();
    this.#sample = runtime.sample;
    try {
      for (const report of JSON.parse(localStorage.getItem("bells.reports") || "[]")) {
        if (report?.id && report.status === "done") this.#reports.set(report.id, report);
      }
    } catch {
      /* nothing kept */
    }
  }

  async connect() {
    return { reports: this.reports() };
  }

  reports() {
    if (this.#demo) return this.#demo.reports();
    return [...this.#reports.values()].map((r) => this.#summary(r)).sort((a, b) => b.createdAt - a.createdAt);
  }

  async report(id) {
    return this.#demo ? this.#demo.report(id) : this.#reports.get(id) ?? null;
  }

  abort() {
    this.#controller?.abort();
    this.#demo?.abort();
  }

  #summary(r) {
    return {
      id: r.id,
      topic: r.topic,
      headline: r.headline,
      status: r.status,
      phase: r.phase,
      blocks: r.blocks.length,
      sources: 0,
      createdAt: r.createdAt,
      finishedAt: r.finishedAt,
      announced: r.announced,
      error: r.error ?? null,
    };
  }

  #tell(report) {
    this.dispatchEvent(new CustomEvent("research", { detail: this.#summary(report) }));
  }

  #keep() {
    try {
      const done = [...this.#reports.values()].filter((r) => r.status === "done").slice(-8);
      localStorage.setItem("bells.reports", JSON.stringify(done));
    } catch {
      /* not kept */
    }
  }

  #find(id, screen) {
    const report = this.#reports.get(id ?? screen) ?? [...this.#reports.values()].filter((r) => r.status === "done").at(-1);
    if (!report) throw new Error("There are no finished reports on file.");
    if (report.status !== "done") throw new Error(`Report ${report.id} is ${report.status}, not finished.`);
    return report;
  }

  #status(screen) {
    const now = new Date().toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
    const parts = [`local time ${now}`];
    const all = [...this.#reports.values()].slice(-6);
    if (!all.length) parts.push("no reports on file");
    for (const r of all) {
      const name = `${r.id} "${r.headline || r.topic}"`;
      parts.push(r.status === "running" ? `drafting ${name}` : r.status === "done" ? `report ${name}, ${r.blocks.length} blocks, finished ${ago(r.finishedAt)}` : `${r.status} research ${name}`);
    }
    parts.push(screen && this.#reports.has(screen) ? `on screen: ${screen}` : "nothing on screen");
    return `[status: ${parts.join("; ")}]`;
  }

  #eventText(event) {
    if (event.type === "boot") return "[event] The display has just come on and the boss is in front of it. Greet them in one short line.";
    if (event.type === "research_done") {
      const report = this.#reports.get(event.report_id);
      if (!report || report.announced || report.status === "running") return null;
      report.announced = true;
      if (report.status === "done") {
        return `[event] Research finished: ${report.id} "${report.headline || report.topic}", ${report.blocks.length} blocks, drafted from model knowledge with no live sources. Tell the boss it is done, give the block count, and offer to put it on screen and walk them through it.`;
      }
      return `[event] Research on "${report.topic}" did not complete: ${report.error ?? "no reason given"}. Tell the boss briefly.`;
    }
    return null;
  }

  /** Drafts a report in the background, one block per line of the reply as it streams. */
  #research(topic, brief) {
    const report = {
      id: `r${this.#reports.size + 1}`,
      topic: str(topic, 120) || "Untitled",
      status: "running",
      phase: "DRAFTING FROM MODEL KNOWLEDGE",
      headline: "",
      summary: "",
      blocks: [],
      sources: [],
      createdAt: Date.now(),
      finishedAt: null,
      announced: false,
      origin: "model",
      error: null,
    };
    this.#reports.set(report.id, report);
    this.#tell(report);

    const eat = (line) => {
      const text = line.trim().replace(/^```\w*|```$/g, "");
      if (!text.startsWith("{")) return;
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        return;
      }
      if (typeof value.headline === "string" && !value.kind) {
        report.headline = str(value.headline, 80);
        report.summary = str(value.summary, 700);
      } else {
        const block = blockFrom(value, report.blocks.length + 1);
        if (!block || report.blocks.length >= 16) return;
        report.blocks.push(block);
        report.phase = `COMPOSING BLOCK ${report.blocks.length}`;
      }
      this.#tell(report);
    };

    let pending = "";
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const request = `${RESEARCH}\n\nTopic: ${report.topic}${brief ? `\nWhat the user asked for: ${str(brief, 1200)}` : ""}\nToday is ${today}.`;
    this.#sample(request, {
      cache: false,
      onText: ({ delta }) => {
        const lines = (pending + delta).split("\n");
        pending = lines.pop();
        lines.forEach(eat);
      },
    })
      .then(() => eat(pending))
      .catch((err) => {
        eat(pending);
        report.error = sayable(err?.code);
      })
      .finally(() => {
        report.finishedAt = Date.now();
        const usable = report.blocks.length >= 3;
        report.status = usable ? "done" : "failed";
        report.phase = usable ? "COMPLETE" : "FAILED";
        report.headline ||= report.topic;
        if (!usable) report.error ||= "The draft came back empty.";
        this.#keep();
        this.#tell(report);
      });
    return report;
  }

  #tools(on, turn, screen) {
    const act = (action, note) => {
      turn.acted = true;
      on.action(action);
      return note;
    };
    const steps = {
      type: "array",
      items: { type: "object", properties: { block_id: { type: "string" }, say: { type: "string" } }, required: ["block_id", "say"] },
    };
    return [
      {
        name: "start_research",
        description: "Start a background job that drafts a report wall on a topic from model knowledge. Returns the job id at once.",
        inputSchema: { type: "object", properties: { topic: { type: "string", description: "Short title, e.g. 'State of VR'." }, brief: { type: "string", description: "What to cover, in the user's terms." } }, required: ["topic"] },
        execute: ({ topic, brief }) => {
          if ([...this.#reports.values()].some((r) => r.status === "running")) throw new Error("A research job is already running; wait for it to finish.");
          const report = this.#research(String(topic ?? ""), String(brief ?? ""));
          return act({ type: "research_started", report: this.#summary(report) }, `Started as ${report.id}. It takes about a minute; an [event] will tell you when it finishes.`);
        },
      },
      {
        name: "present_report",
        description: "Put a finished report on the display. Leave report_id out for the most recent one. Returns the report's content.",
        inputSchema: { type: "object", properties: { report_id: { type: "string" } } },
        execute: ({ report_id }) => {
          const report = this.#find(report_id && String(report_id));
          turn.screen = report.id;
          return act({ type: "present_report", id: report.id }, `On screen now.\n${digest(report)}`);
        },
      },
      {
        name: "walk_through",
        description: "Talk through the report on screen: each step highlights one block and speaks its line, in order. Returns once the lines are queued.",
        inputSchema: { type: "object", properties: { report_id: { type: "string" }, steps }, required: ["steps"] },
        execute: ({ report_id, steps: asked }) => {
          const report = this.#find(report_id && String(report_id), turn.screen ?? screen);
          const known = new Set(report.blocks.map((b) => b.id));
          const valid = (Array.isArray(asked) ? asked : [])
            .map((s) => ({ block: String(s?.block_id ?? ""), say: str(s?.say, 500) }))
            .filter((s) => known.has(s.block) && s.say)
            .slice(0, 14);
          if (!valid.length) throw new Error(`None of those block ids are in ${report.id}. Its blocks are ${[...known].join(", ")}.`);
          turn.screen = report.id;
          return act({ type: "walk", id: report.id, steps: valid }, `Queued: the display is speaking those ${valid.length} lines. Do not repeat them; close with one short line.`);
        },
      },
      {
        name: "focus_block",
        description: "Highlight one block of the report on screen. Returns that block's content.",
        inputSchema: { type: "object", properties: { block_id: { type: "string" }, report_id: { type: "string" } }, required: ["block_id"] },
        execute: ({ block_id, report_id }) => {
          const report = this.#find(report_id && String(report_id), turn.screen ?? screen);
          const block = report.blocks.find((b) => b.id === String(block_id));
          if (!block) throw new Error(`No block ${block_id} in ${report.id}.`);
          return act({ type: "focus_block", id: report.id, block: block.id }, JSON.stringify(block));
        },
      },
      {
        name: "read_report",
        description: "Return a report's full content without changing the display.",
        inputSchema: { type: "object", properties: { report_id: { type: "string" } } },
        execute: ({ report_id }) => digest(this.#find(report_id && String(report_id), turn.screen ?? screen)),
      },
      {
        name: "clear_screen",
        description: "Take the report and any cards off the display.",
        execute: () => act({ type: "clear" }, "The display is clear."),
      },
    ];
  }

  /** Switches to the scripted demo for the rest of the view: Claude isn't available here. */
  #giveUp() {
    this.#demo = new DemoBrain();
    this.#demo.addEventListener("research", (event) => this.dispatchEvent(new CustomEvent("research", { detail: event.detail })));
    this.kind = "demo";
    this.label = this.#demo.label;
    this.dispatchEvent(new CustomEvent("label"));
  }

  async send(payload, on) {
    if (this.#demo) return this.#demo.send(payload, on);
    const said = payload.event ? this.#eventText(payload.event) : String(payload.text ?? "").trim().slice(0, 4000);
    if (!said) return;

    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;
    const turn = { acted: false, screen: null };
    const user = { role: "user", content: `${this.#status(payload.screen)}\n${said}` };
    let heard = "";

    try {
      const { text } = await this.#sample([{ role: "user", content: RULES }, ...this.#turns.slice(-24), user], {
        cache: false,
        modelTier: "quick",
        signal: controller.signal,
        tools: this.#tools(on, turn, payload.screen),
        onText: ({ delta }) => {
          heard += delta;
          on.say(delta);
        },
      });
      this.#turns.push(user, { role: "assistant", content: text });
    } catch (err) {
      const code = err?.code;
      if (HIDE.has(code)) {
        this.#giveUp();
        return this.#demo.send(payload, on);
      }
      const partial = (err?.text ?? heard).trim();
      if (code === "cancelled") this.#turns.push(user, { role: "assistant", content: partial || "(cut off)" });
      else if (code === "empty_completion" && turn.acted) this.#turns.push(user, { role: "assistant", content: "(done, without comment)" });
      else {
        console.error("[bells] Claude call failed", err);
        on.error(sayable(code));
      }
    }
  }
}
