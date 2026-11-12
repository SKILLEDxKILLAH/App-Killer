import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.js";
import { claude, fallbackParams, describeError, hub } from "./claude.js";
import { findWikipediaImage } from "./images.js";
import { newId, saveReport, listReports, summarize } from "./store.js";

const MAX_BLOCKS = 24;
const MAX_SOURCES = 250;

const SYSTEM = `You are the research agent behind Bells, a voice assistant with a heads-up display. Bells has handed you a topic. What you produce is not an essay: it is a wall of blocks that goes up on a screen while Bells talks her user through it. Each block gets a few seconds of someone's attention, so each one carries a single finding and has to make sense on its own.

How to work
Search the web, open the pages that matter, and record each finding with add_block as soon as you have established it. Do not save the blocks for the end: the display counts them as they land, and a job that is cut short keeps whatever you have recorded. Aim for 8 to 14 blocks. If the topic only supports six solid ones, deliver six.

Standards
Every block lists the URLs it rests on. Give figures as the sources give them, and put the date and the basis in the body (shipments or active users, a full year or one quarter, a company's own claim or an analyst's estimate). When sources disagree, or a number is an estimate, say so in the block. Prefer primary sources and recent data; today's date is in the request. Never fill a gap with a figure you could not source.

Block kinds
- note: one finding. A title of up to eight words and a body of one to three sentences.
- stat: one headline figure. "value" is the figure as it should be displayed, kept short ("≈20m", "$3.4bn", "41%"). The title says what it measures; the body gives the date, basis and caveat in one sentence.
- chart: a bar chart of three to eight numbers that share one basis and one unit. Give the unit, and use the body for the basis and any caveat.
- image: a picture of a subject, taken from the lead image of its English Wikipedia article. Put the exact article title in "wikipedia_title" and a caption in "title". Use one to three where a picture helps.
- quote: a short verbatim quotation, under thirty words, with who said it and where in "attribution".

A good wall mixes kinds: a few stats and charts for the numbers, notes for what they mean, a picture or two.

When you are done, call finish_report with a headline and a summary of two or three sentences that Bells can say aloud. Your own text replies are shown to nobody, so keep them to a few words.`;

const BlockInput = z.object({
  kind: z.enum(["note", "stat", "chart", "image", "quote"]),
  title: z.string().min(1).max(160).describe("Short headline for the block, or the caption of an image."),
  body: z.string().max(900).optional().describe("The finding, or the basis and caveat for a stat or chart. For a quote, the quotation itself."),
  value: z.string().max(24).optional().describe("stat only: the figure as displayed, e.g. '≈20m'."),
  unit: z.string().max(40).optional().describe("chart only: the unit the values share, e.g. 'million units'."),
  series: z
    .array(z.object({ label: z.string().min(1).max(28), value: z.number() }))
    .max(8)
    .optional()
    .describe("chart only: three to eight bars."),
  wikipedia_title: z.string().max(120).optional().describe("image only: exact English Wikipedia article title."),
  attribution: z.string().max(160).optional().describe("quote only: who said it, and where."),
  sources: z.array(z.string()).max(8).describe("URLs this block is based on."),
});

const FinishInput = z.object({
  headline: z.string().min(1).max(80).describe("A short title for the whole report."),
  summary: z.string().min(1).max(700).describe("Two or three sentences Bells can say aloud."),
});

const jobs = new Map(); // report id -> AbortController

export function runningJobs() {
  return listReports().filter((r) => r.status === "running");
}

export function cancelResearch(id) {
  const controller = jobs.get(id);
  if (!controller) return false;
  controller.abort(new Error("cancelled"));
  return true;
}

/** Starts a background job and returns its report record straight away. */
export function startResearch({ topic, brief = "" }) {
  if (runningJobs().length >= config.maxResearchJobs) {
    throw new Error(`Already running ${config.maxResearchJobs} research jobs; wait for one to finish or cancel one.`);
  }
  const report = saveReport({
    id: newId("r"),
    topic: String(topic).trim().slice(0, 120),
    brief: String(brief).trim().slice(0, 1200),
    status: "running",
    phase: "STARTING RESEARCH AGENT",
    headline: "",
    summary: "",
    blocks: [],
    sources: [],
    createdAt: Date.now(),
    finishedAt: null,
    announced: false,
    error: null,
  });
  const controller = new AbortController();
  jobs.set(report.id, controller);
  announce(report);

  run(report, controller)
    .catch((err) => fail(report, err, controller))
    .finally(() => {
      jobs.delete(report.id);
      saveReport(report);
      announce(report);
    });

  return report;
}

function announce(report) {
  hub.emit("research", summarize(report));
}

function setPhase(report, phase) {
  const text = phase.toUpperCase().slice(0, 64);
  if (report.phase === text) return;
  report.phase = text;
  announce(report);
}

function fail(report, err, controller) {
  const cancelled = controller.signal.aborted && controller.signal.reason?.message === "cancelled";
  const timedOut = controller.signal.aborted && !cancelled;
  if (!cancelled && !timedOut) console.error(`[bells] research ${report.id} failed:`, err);

  report.finishedAt = Date.now();
  // Whatever was recorded before the job stopped is still a usable report.
  if (report.blocks.length >= 3 && !cancelled) {
    report.status = "done";
    report.phase = "COMPLETE (CUT SHORT)";
    report.summary ||= `The job stopped early, but ${report.blocks.length} blocks were recorded before it did.`;
    report.error = timedOut ? "Stopped at the time limit." : describeError(err);
    return;
  }
  report.status = cancelled ? "cancelled" : "failed";
  report.phase = cancelled ? "CANCELLED" : "FAILED";
  report.error = cancelled ? "Cancelled." : timedOut ? "Ran out of time before finding enough." : describeError(err);
}

async function run(report, controller) {
  const timer = setTimeout(
    () => controller.abort(new Error("time limit")),
    config.researchMinutes * 60_000,
  );
  let finished = false;
  let recording = Promise.resolve();

  const addBlock = betaZodTool({
    name: "add_block",
    description:
      "Record one finding as a block on the report wall. Call it as soon as a finding is established, once per finding.",
    inputSchema: BlockInput,
    eager_input_streaming: true,
    // The model often records several blocks in one turn and the SDK runs
    // those calls concurrently. An image block waits on a lookup, so the
    // calls are queued to keep the model's order and give each block its own id.
    run: (input) => (recording = recording.then(() => record(input))),
  });

  async function record(input) {
    if (report.blocks.length >= MAX_BLOCKS) return "The wall is full. Call finish_report now.";
    const problem = checkBlock(input);
    if (problem) return [{ type: "text", text: `Not recorded: ${problem}` }];

    const block = {
      id: `b${report.blocks.length + 1}`,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body?.trim() ?? "",
      sources: cleanUrls(input.sources),
      addedAt: Date.now(),
    };
    if (input.kind === "stat") block.value = input.value.trim();
    if (input.kind === "chart") {
      block.unit = input.unit?.trim() ?? "";
      block.series = input.series.map((s) => ({ label: s.label.trim(), value: s.value }));
    }
    if (input.kind === "quote") block.attribution = input.attribution?.trim() ?? "";
    if (input.kind === "image") {
      const wanted = input.wikipedia_title.trim();
      const found = await findWikipediaImage(wanted);
      if (found.status === "none") {
        return `Not recorded: the Wikipedia article "${wanted}" does not exist or has no lead image. Try another article title or leave this picture out.`;
      }
      // "unknown" means the lookup was refused here; the HUD resolves it instead.
      block.image = found.status === "found" ? found.image : null;
      block.wikipedia = found.status === "found" ? found.image.title : wanted;
      const page = block.image?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(wanted.replace(/ /g, "_"))}`;
      block.sources = cleanUrls([page, ...block.sources]);
    }

    report.blocks.push(block);
    for (const url of block.sources) noteSource(report, url, null, true);
    saveReport(report);
    setPhase(report, `Composing block ${report.blocks.length}`);
    announce(report);
    return `Recorded as ${block.id} (${report.blocks.length} so far).`;
  }

  const finishReport = betaZodTool({
    name: "finish_report",
    description: "Close the report once the wall is complete.",
    inputSchema: FinishInput,
    eager_input_streaming: true,
    // Queued behind any blocks recorded in the same turn.
    run: (input) =>
      (recording = recording.then(() => {
        if (report.blocks.length === 0) return "Nothing has been recorded yet. Add blocks with add_block first.";
        report.headline = input.headline.trim();
        report.summary = input.summary.trim();
        finished = true;
        return "Report closed.";
      })),
  });

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const request = [`Topic: ${report.topic}`, report.brief && `What the user asked for: ${report.brief}`, `Today is ${today}.`]
    .filter(Boolean)
    .join("\n");

  try {
    const runner = claude().beta.messages.toolRunner(
      {
        model: config.researchModel,
        max_tokens: 64000,
        output_config: { effort: config.researchEffort },
        system: SYSTEM,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 14 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
          addBlock,
          finishReport,
        ],
        messages: [{ role: "user", content: request }],
        stream: true,
        thread: false,
        max_iterations: 60,
        ...fallbackParams(),
      },
      { signal: controller.signal },
    );

    for await (const stream of runner) {
      for await (const event of stream) {
        if (event.type === "content_block_start") onBlockStart(report, event.content_block);
      }
      const message = await stream.finalMessage();
      for (const block of message.content) harvest(report, block);
      announce(report);

      if (message.stop_reason === "refusal") {
        throw new Error("The model declined this topic.");
      }
      if (message.stop_reason === "max_tokens" && message.content.some((b) => b.type === "tool_use")) {
        throw new Error("A block was cut off at the output limit.");
      }
      // Run this turn's tools now, so a finish_report call ends the job here
      // instead of costing one more round trip for the model to say "done".
      await runner.generateToolResponse();
      if (finished) break;
    }
  } finally {
    clearTimeout(timer);
  }

  if (report.blocks.length === 0) throw new Error("The agent finished without recording anything.");
  report.status = "done";
  report.phase = "COMPLETE";
  report.finishedAt = Date.now();
  report.headline ||= report.topic;
  report.summary ||= `${report.blocks.length} blocks from ${report.sources.length} sources.`;
}

function checkBlock(input) {
  switch (input.kind) {
    case "note":
      return input.body?.trim() ? null : "a note needs a body.";
    case "stat":
      return input.value?.trim() ? null : 'a stat needs "value", the figure as displayed.';
    case "chart":
      if (!input.series || input.series.length < 2) return 'a chart needs "series" with at least two bars.';
      if (input.series.some((s) => !Number.isFinite(s.value))) return "every bar needs a finite number.";
      return null;
    case "image":
      return input.wikipedia_title?.trim() ? null : 'an image needs "wikipedia_title".';
    case "quote":
      return input.body?.trim() ? null : "a quote needs the quotation in body.";
    default:
      return "unknown kind.";
  }
}

/** Keeps http(s) URLs only: these end up as links on the wall. */
function cleanUrls(list) {
  const out = [];
  for (const raw of list ?? []) {
    try {
      const u = new URL(String(raw).trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (!out.includes(u.href)) out.push(u.href);
    } catch {
      // Not a URL; the model sometimes writes a publication name here.
    }
  }
  return out;
}

function noteSource(report, url, title, cited = false) {
  const [clean] = cleanUrls([url]);
  if (!clean) return;
  const existing = report.sources.find((s) => s.url === clean);
  if (existing) {
    if (title && !existing.title) existing.title = String(title).slice(0, 200);
    if (cited) existing.cited = true;
    return;
  }
  if (report.sources.length >= MAX_SOURCES) return;
  report.sources.push({ url: clean, title: title ? String(title).slice(0, 200) : "", cited });
}

/** Shows what the agent is doing the moment it starts doing it. */
function onBlockStart(report, block) {
  if (block.type !== "server_tool_use") return;
  if (block.name === "web_search") setPhase(report, "Searching the web");
  else if (block.name === "web_fetch") setPhase(report, "Reading a source");
  else setPhase(report, "Sifting results");
}

/** Pulls sources and a more specific phase out of a finished content block. */
function harvest(report, block) {
  if (block.type === "server_tool_use") {
    const query = typeof block.input?.query === "string" ? block.input.query : "";
    const url = typeof block.input?.url === "string" ? block.input.url : "";
    if (query) setPhase(report, `Searched: ${query}`);
    else if (url) setPhase(report, `Read: ${hostOf(url)}`);
    return;
  }
  if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
    for (const hit of block.content) {
      if (hit?.type === "web_search_result" && hit.url) noteSource(report, hit.url, hit.title);
    }
    return;
  }
  if (block.type === "web_fetch_tool_result" && block.content?.type === "web_fetch_result") {
    noteSource(report, block.content.url, block.content.content?.title);
    return;
  }
  if (block.type === "text" && Array.isArray(block.citations)) {
    for (const cite of block.citations) {
      if (cite?.url) noteSource(report, cite.url, cite.title);
    }
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "a page";
  }
}

/** What Bells is told about a report so she can talk about it. */
export function digest(report, { full = false } = {}) {
  const lines = [
    `Report ${report.id}: "${report.headline || report.topic}" (${report.status}).`,
    `${report.blocks.length} blocks, ${report.sources.length} sources.`,
  ];
  if (report.summary) lines.push(`Summary: ${report.summary}`);
  if (report.error) lines.push(`Note: ${report.error}`);
  lines.push("Blocks:");
  for (const b of report.blocks) {
    let detail = b.body;
    if (b.kind === "stat") detail = `${b.value}. ${b.body}`;
    if (b.kind === "chart") {
      detail = `${b.series.map((s) => `${s.label} ${s.value}`).join(", ")}${b.unit ? ` (${b.unit})` : ""}. ${b.body}`;
    }
    if (b.kind === "quote") detail = `"${b.body}" - ${b.attribution}`;
    if (b.kind === "image") detail = `picture of ${b.wikipedia ?? ""}`;
    lines.push(full ? `- ${b.id} [${b.kind}] ${b.title}: ${detail}` : `- ${b.id} [${b.kind}] ${b.title}`);
  }
  return lines.join("\n");
}
