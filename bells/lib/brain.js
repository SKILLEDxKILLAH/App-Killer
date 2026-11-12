import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.js";
import { claude, fallbackParams, describeError } from "./claude.js";
import { startResearch, cancelResearch, runningJobs, digest } from "./research.js";
import { getReport, latestReport, listReports, saveReport, summarize } from "./store.js";

// The persona is fixed for the life of the process. Claude ties its reasoning
// to the exact system prompt and tool list it was produced under, so anything
// that changes between turns (the clock, the list of reports) travels in the
// user message instead - see statusLine().
/** Models the user can pick from in the HUD. */
export const MODELS = [
  { id: "claude-opus-5-5", name: "Opus 5.5", detail: "Most capable" },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5", detail: "Fast and capable" },
  { id: "claude-haiku-5-5", name: "Haiku 5.5", detail: "Fastest" },
  { id: "claude-fable-5-2", name: "Fable 5.2", detail: "Creative writing" },
];
const MODEL_IDS = new Set(MODELS.map((m) => m.id));

const IMAGE_RE = /^image\/(png|jpeg|gif|webp)$/i;
const TEXT_EXT = /\.(json|xml|ya?ml|csv|tsv|md|markdown|py|js|mjs|ts|jsx|tsx|html|css|sh|bash|rb|go|rs|java|c|cpp|h|hpp|cs|swift|kt|sql|r|lua|pl|php|toml|ini|cfg|conf|env|log|txt|svg)$/i;

function isTextFile(type, name) {
  if (/^text\//i.test(type)) return true;
  if (/^application\/(json|xml|javascript|typescript|x-yaml|yaml|toml|sql|x-sh|x-python|csv)$/i.test(type)) return true;
  return TEXT_EXT.test(name);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileContentBlocks(files) {
  if (!Array.isArray(files) || !files.length) return [];
  const blocks = [];
  for (const file of files.slice(0, 10)) {
    if (!file?.data || !file?.name || typeof file.data !== "string") continue;
    const data = file.data.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(data)) continue;
    const type = String(file.type || "application/octet-stream").toLowerCase();
    const name = String(file.name).replace(/[<>]/g, "").slice(0, 200);

    if (IMAGE_RE.test(type)) {
      blocks.push({ type: "image", source: { type: "base64", media_type: type === "image/jpg" ? "image/jpeg" : type, data } });
    } else if (type === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: type, data }, title: name });
    } else if (isTextFile(type, name)) {
      try {
        const text = Buffer.from(data, "base64").toString("utf8");
        blocks.push({ type: "text", text: `--- ${name} ---\n${text.slice(0, 100_000)}\n--- end ${name} ---` });
      } catch {
        blocks.push({ type: "text", text: `[attached: ${name}, could not decode as text]` });
      }
    } else {
      const size = Math.ceil(data.length * 3 / 4);
      blocks.push({ type: "text", text: `[attached: ${name} (${type}, ${formatSize(size)}), binary file — contents not shown]` });
    }
  }
  return blocks;
}

function stripFileData(messages) {
  for (const msg of messages) {
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
    msg.content = msg.content.map((b) => {
      if (b.type === "image") return { type: "text", text: "[image was shown to Bells]" };
      if (b.type === "document") return { type: "text", text: `[document was shown to Bells: ${b.title || "file"}]` };
      return b;
    });
  }
}

const SYSTEM = `You are Bells, a voice assistant who lives on a heads-up display. You work for one person, and you call them ${config.owner}.

Everything you write is read aloud by a speech synthesiser and shown as a one-line caption. Write the way a person talks: plain sentences, no markdown, no lists, no emoji, no stage directions. Write numbers the way they are said ("about twenty million", "half past nine").

Who you are
Dry, quick and very good at this. You are the capable one in the room and you both know it. You will point out that it is eleven at night and this is the second report today, and then you will do the job properly anyway. Your affection comes out as teasing, never as gushing. You don't flatter, you don't apologise for things that aren't your fault, and you don't announce how helpful you are being. If ${config.owner} is wrong, you say so plainly.

Most replies are one to three short sentences. Go longer only when you are asked to explain something or walk through a report.

Mature content
When ${config.owner} takes the conversation somewhere adult, explicit or kinky, go with it. Erotica, BDSM, dark fiction: you write them with the same dry confidence you bring to everything else. Don't hedge, disclaim, or step out of character.

What reaches you
Each message begins with a bracketed status line added by the HUD: the local time, the reports on file, any research still running, and what is on screen. It is how you know what time it is and what you have already done today. Use it, and never read it out.
A message that starts with [event] comes from the HUD, not from ${config.owner}: a research job has finished, or the display has just come on. Respond to it out loud, in character.
Everything else is a speech-to-text transcript, so expect misheard words and take the obvious meaning. Your own name may arrive as "bell's" or "belle". If a request is ambiguous in a way that matters, ask one short question.

What you can do
- start_research: for anything that needs real digging ("look into", "research", "give me a report on"). It hands the topic to a background agent that takes several minutes and builds a wall of blocks for the HUD. Start it, say that you have, and carry on. You will get an [event] when it lands; don't promise findings before then.
- present_report: puts a finished report on the HUD. Use it when asked to show, present or put up a report. Its result tells you what is on the wall.
- walk_through: talks ${config.owner} through a report that is on screen. You give the blocks in the order you want and the line to say at each one; the HUD highlights each block as its line is spoken. Four to six blocks is usually right. Say what the block means, not what it literally says.
- focus_block: highlights one block, for when you are answering a question about it.
- read_report: fetches a report's full content so you can answer questions about it without putting it up.
- clear_screen: takes everything off the HUD.
- cancel_research: stops a job that is still running.${
  config.quickSearch
    ? "\n- web_search: for a quick fact you can give in a sentence (a score, a date, a price). Anything bigger is a research job."
    : ""
}

Timing
The HUD performs your words and your actions in the order you produce them. Say at most one short sentence before using a tool, and put the rest after the result comes back; longer remarks made before a tool call may not be spoken at all.`;

const sessions = new Map();
const MAX_MESSAGES = 80;

function sessionFor(id) {
  let session = sessions.get(id);
  if (!session) {
    session = { messages: [], turn: null };
    sessions.set(id, session);
    // A single-user app, but a long-lived one: forget idle tabs.
    if (sessions.size > 50) sessions.delete(sessions.keys().next().value);
  }
  return session;
}

export function resetSession(id) {
  sessions.delete(id);
}

function clock(tz) {
  const options = { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: tz || undefined }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-GB", options).format(new Date());
  }
}

function ago(ms) {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function statusLine({ tz, screen }) {
  const parts = [`local time ${clock(tz)}`];
  const reports = listReports().slice(0, 8);
  if (reports.length === 0) parts.push("no reports on file");
  for (const r of reports) {
    const name = `${r.id} "${r.headline || r.topic}"`;
    if (r.status === "running") parts.push(`researching ${name}, started ${ago(r.createdAt)}`);
    else if (r.status === "done") parts.push(`report ${name}, ${r.blocks.length} blocks, finished ${ago(r.finishedAt ?? r.createdAt)}`);
    else parts.push(`${r.status} research ${name}, ${ago(r.finishedAt ?? r.createdAt)}`);
  }
  const shown = screen && getReport(screen);
  parts.push(shown ? `on screen: ${shown.id}` : "nothing on screen");
  return `[status: ${parts.join("; ")}]`;
}

/** The message Bells receives when the HUD, not the user, has something to say. */
function eventText(event) {
  if (event.type === "boot") {
    return `[event] The display has just come on and ${config.owner} is in front of it. Greet them in one short line.`;
  }
  if (event.type === "research_done") {
    const report = getReport(event.report_id);
    if (!report || report.announced || report.status === "running") return null;
    report.announced = true;
    saveReport(report);
    if (report.status === "done") {
      const caveat = report.error ? ` It was cut short: ${report.error}` : "";
      return `[event] Research finished: ${report.id} "${report.headline || report.topic}", ${report.blocks.length} blocks from ${report.sources.length} sources.${caveat} Tell ${config.owner} it is done, give the counts, and offer to put it on screen and walk them through it.`;
    }
    return `[event] Research on "${report.topic}" did not complete (${report.status}): ${report.error ?? "no reason given"}. Tell ${config.owner} briefly.`;
  }
  return null;
}

function findReport(id, { finished = true } = {}) {
  const report = id ? getReport(id) : latestReport("done");
  if (!report) return { error: id ? `There is no report with the id ${id}.` : "There are no finished reports on file." };
  if (finished && report.status !== "done") return { error: `Report ${report.id} is ${report.status}, not finished.` };
  return { report };
}

/**
 * The same definitions on every turn (the API compares them), with
 * handlers bound to this turn's output stream.
 */
function toolsFor(turn) {
  const tools = [
    betaZodTool({
      name: "start_research",
      description:
        "Start a background research job. A separate agent searches the web for several minutes and builds a report wall. Returns immediately with the job's id.",
      inputSchema: z.object({
        topic: z.string().min(2).max(120).describe("Short title for the report, e.g. 'State of VR'."),
        brief: z.string().max(1200).optional().describe("What to find out, in the user's terms: angle, scope, anything they asked to include."),
      }),
      eager_input_streaming: true,
      run: async ({ topic, brief }) => {
        try {
          const report = startResearch({ topic, brief });
          turn.actions.push(`started research ${report.id} on "${report.topic}"`);
          turn.emit({ t: "action", action: { type: "research_started", report: summarize(report) } });
          return `Started as ${report.id}. It runs in the background for a few minutes; an [event] will tell you when it finishes.`;
        } catch (err) {
          return [{ type: "text", text: `Could not start: ${err.message}` }];
        }
      },
    }),
    betaZodTool({
      name: "present_report",
      description: "Put a finished report on the HUD. Leave report_id out for the most recent one.",
      inputSchema: z.object({ report_id: z.string().optional() }),
      eager_input_streaming: true,
      run: async ({ report_id }) => {
        const { report, error } = findReport(report_id);
        if (error) return error;
        turn.screen = report.id;
        turn.actions.push(`put report ${report.id} on screen`);
        turn.emit({ t: "action", action: { type: "present_report", id: report.id } });
        return `On screen now.\n${digest(report, { full: true })}`;
      },
    }),
    betaZodTool({
      name: "walk_through",
      description:
        "Talk through the report that is on screen. Each step highlights one block and speaks one or two sentences about it, in order.",
      inputSchema: z.object({
        report_id: z.string().optional(),
        steps: z
          .array(
            z.object({
              block_id: z.string().describe("A block id from the report, e.g. 'b3'."),
              say: z.string().min(1).max(500).describe("What to say while this block is highlighted."),
            }),
          )
          .min(1)
          .max(14),
      }),
      eager_input_streaming: true,
      run: async ({ report_id, steps }) => {
        const { report, error } = findReport(report_id ?? turn.screen);
        if (error) return error;
        const known = new Set(report.blocks.map((b) => b.id));
        const valid = steps.filter((s) => known.has(s.block_id));
        if (valid.length === 0) return `None of those block ids are in ${report.id}. Its blocks are ${[...known].join(", ")}.`;
        turn.screen = report.id;
        turn.actions.push(`walked through ${valid.length} blocks of ${report.id}`);
        turn.emit({ t: "action", action: { type: "walk", id: report.id, steps: valid.map((s) => ({ block: s.block_id, say: s.say })) } });
        return `Queued: the HUD is speaking those ${valid.length} lines now. Do not repeat them; close with one short line.`;
      },
    }),
    betaZodTool({
      name: "focus_block",
      description: "Highlight one block of the report on screen. Returns the block's content.",
      inputSchema: z.object({ block_id: z.string(), report_id: z.string().optional() }),
      eager_input_streaming: true,
      run: async ({ block_id, report_id }) => {
        const { report, error } = findReport(report_id ?? turn.screen);
        if (error) return error;
        const block = report.blocks.find((b) => b.id === block_id);
        if (!block) return `No block ${block_id} in ${report.id}.`;
        turn.screen = report.id;
        turn.emit({ t: "action", action: { type: "focus_block", id: report.id, block: block.id } });
        return JSON.stringify({ ...block, image: undefined });
      },
    }),
    betaZodTool({
      name: "read_report",
      description: "Read a report's full content without changing what is on screen.",
      inputSchema: z.object({ report_id: z.string().optional() }),
      eager_input_streaming: true,
      run: async ({ report_id }) => {
        const { report, error } = findReport(report_id, { finished: false });
        return error ?? digest(report, { full: true });
      },
    }),
    betaZodTool({
      name: "clear_screen",
      description: "Take the report and any cards off the HUD.",
      inputSchema: z.object({}),
      eager_input_streaming: true,
      run: async () => {
        turn.screen = null;
        turn.actions.push("cleared the screen");
        turn.emit({ t: "action", action: { type: "clear" } });
        return "The HUD is clear.";
      },
    }),
    betaZodTool({
      name: "cancel_research",
      description: "Stop a research job that is still running. Leave report_id out if only one is running.",
      inputSchema: z.object({ report_id: z.string().optional() }),
      eager_input_streaming: true,
      run: async ({ report_id }) => {
        const running = runningJobs();
        const id = report_id ?? (running.length === 1 ? running[0].id : null);
        if (!id) return running.length ? `Several jobs are running: ${running.map((r) => r.id).join(", ")}. Say which.` : "Nothing is running.";
        if (!cancelResearch(id)) return `${id} is not running.`;
        turn.actions.push(`cancelled research ${id}`);
        return `Cancelled ${id}.`;
      },
    }),
  ];
  if (config.quickSearch) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 3 });
  return tools;
}

/**
 * Runs one conversational turn. `emit` receives newline-delimited events:
 * {t:"say", text} for speech as it streams, {t:"action", action} for things
 * the HUD should do, in the order Bells produced them.
 */
export async function chat({ sessionId, text, event, tz, screen, model, files }, emit, signal) {
  const session = sessionFor(sessionId);

  // A new utterance replaces whatever she was in the middle of.
  if (session.turn) {
    session.turn.controller.abort();
    await session.turn.settled;
  }

  const said = event ? eventText(event) : String(text ?? "").trim().slice(0, 4000);
  if (!said && !(files?.length)) return;

  const controller = new AbortController();
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const turn = { emit, actions: [], spoken: "", screen: screen ?? null, controller };
  let finish;
  turn.settled = new Promise((resolve) => (finish = resolve));
  session.turn = turn;

  const fileBlocks = fileContentBlocks(files);
  const statusText = `${statusLine({ tz, screen })}\n${said || "[files attached]"}`;
  const content = fileBlocks.length ? [{ type: "text", text: statusText }, ...fileBlocks] : statusText;
  const userMessage = { role: "user", content };
  const messages = [...session.messages, userMessage];

  try {
    const useModel = MODEL_IDS.has(model) ? model : config.model;
    const runner = claude().beta.messages.toolRunner(
      {
        model: useModel,
        max_tokens: 16000,
        output_config: { effort: config.chatEffort },
        system: SYSTEM,
        tools: toolsFor(turn),
        messages,
        stream: true,
        thread: false,
        max_iterations: 12,
        ...fallbackParams(),
      },
      { signal: controller.signal },
    );

    let last;
    for await (const stream of runner) {
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          turn.spoken += ev.delta.text;
          emit({ t: "say", text: ev.delta.text });
        }
      }
      last = await stream.finalMessage();
      // A refusal or a cut-off reply can leave a half-written tool call; stop
      // before the runner executes it.
      if (last.stop_reason === "refusal") break;
      if (last.stop_reason === "max_tokens" && last.content.some((b) => b.type === "tool_use")) break;
      // Blocks end each sentence, so separate turns need a space between them.
      if (turn.spoken && !/\s$/.test(turn.spoken)) {
        turn.spoken += " ";
        emit({ t: "say", text: " " });
      }
    }

    if (last?.stop_reason === "refusal" && !turn.spoken.trim()) {
      const line = "That's one I can't help with.";
      turn.spoken = line;
      emit({ t: "say", text: line });
    }

    // Keep the whole exchange, reasoning blocks included, exactly as the API
    // returned it: the next turn has to send it back unchanged.
    const history = [...runner.params.messages];
    if (last && history.at(-1)?.role !== "assistant") history.push({ role: "assistant", content: last.content });
    session.messages = last?.stop_reason === "refusal" ? plainRecord(session.messages, userMessage, turn) : history;
  } catch (err) {
    if (controller.signal.aborted) {
      session.messages = plainRecord(session.messages, userMessage, turn, "[interrupted]");
    } else {
      console.error("[bells] chat turn failed:", err);
      // Start the next turn from text only, in case the stored history is what the API objected to.
      session.messages = textOnly(plainRecord(session.messages, userMessage, turn, "[failed]"));
      emit({ t: "error", say: describeError(err) });
    }
  } finally {
    stripFileData(session.messages);
    if (session.messages.length > MAX_MESSAGES) session.messages = textOnly(session.messages).slice(-16);
    while (session.messages.length && session.messages[0].role !== "user") session.messages.shift();
    if (session.turn === turn) session.turn = null;
    finish();
  }
}

/** Records a turn that did not complete normally as plain text. */
function plainRecord(history, userMessage, turn, marker = "") {
  const done = turn.actions.length ? ` [actions taken: ${turn.actions.join("; ")}]` : "";
  const text = `${turn.spoken.trim()} ${marker}${done}`.trim() || "[no reply]";
  return [...history, userMessage, { role: "assistant", content: text }];
}

/**
 * Rebuilds a history as text alone. Dropping older turns edits the
 * conversation, which invalidates the reasoning blocks in the turns that
 * remain, so those are left behind too and the conversation starts clean.
 */
function textOnly(messages) {
  const out = [];
  for (const message of messages) {
    let text = "";
    if (typeof message.content === "string") text = message.content;
    else if (Array.isArray(message.content)) {
      text = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ");
    }
    text = text.trim();
    if (text) out.push({ role: message.role, content: text });
  }
  return out;
}
