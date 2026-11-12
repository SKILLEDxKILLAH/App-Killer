// What Bells does with no language model behind her: a handful of scripted
// lines and one built-in report, so the HUD can be seen working end to end.
// Every figure in the report is arithmetic or textbook geometry.

const WIKI = "https://en.wikipedia.org/wiki/";
const HALES = "https://arxiv.org/abs/math/9906042";
const CONJECTURE = `${WIKI}Honeycomb_conjecture`;
const TILINGS = `${WIKI}Euclidean_tilings_by_convex_regular_polygons`;
const HONEYCOMB = `${WIKI}Honeycomb`;

export const DEMO_REPORT = {
  headline: "Why bees build hexagons",
  summary:
    "A comb has to hold the most honey behind the least wax. Of the three regular shapes that fit together without gaps, the hexagon needs the shortest wall, and in 1999 that was finally proved to be the best any equal-area division of a plane can do.",
  blocks: [
    {
      kind: "note",
      title: "Most honey, least wax",
      body: "Wax is expensive for a colony to make. Among shapes that fit together with no gaps, the regular hexagon encloses a given area with the shortest wall.",
      sources: [HONEYCOMB, CONJECTURE],
    },
    {
      kind: "chart",
      title: "Wall needed to enclose one unit of area",
      unit: "perimeter",
      series: [
        { label: "Triangle", value: 4.56 },
        { label: "Square", value: 4 },
        { label: "Hexagon", value: 3.72 },
        { label: "Circle", value: 3.54 },
      ],
      body: "Regular shapes of equal area. The circle is the theoretical best, but circles leave gaps; of the three shapes that tile, the hexagon wins.",
      sources: [CONJECTURE],
    },
    {
      kind: "stat",
      title: "Angle at every corner",
      value: "120°",
      body: "Three cells meet at each corner of the comb, and three angles of 120 degrees close the full circle with nothing left over.",
      sources: [TILINGS],
    },
    {
      kind: "note",
      title: "Only three regular shapes tile",
      body: "Equilateral triangles, squares and regular hexagons are the only regular polygons that cover a flat surface by themselves. Pentagons, and everything with more than six sides, leave gaps or overlap.",
      sources: [TILINGS],
    },
    { kind: "image", title: "Comb built by honey bees", wikipedia: "Honeycomb", image: null, sources: [HONEYCOMB] },
    {
      kind: "stat",
      title: "Year the honeycomb conjecture was proved",
      value: "1999",
      body: "Thomas Hales proved that a regular hexagonal grid is the least-perimeter way to divide a plane into regions of equal area. The idea itself goes back to antiquity.",
      sources: [HALES, CONJECTURE],
    },
    {
      kind: "chart",
      title: "Neighbours sharing a wall with each cell",
      unit: "cells",
      series: [
        { label: "Triangle", value: 3 },
        { label: "Square", value: 4 },
        { label: "Hexagon", value: 6 },
      ],
      body: "Counted across shared edges in each regular tiling.",
      sources: [TILINGS],
    },
    {
      kind: "stat",
      title: "Wall saved against a square grid",
      value: "7%",
      body: "For the same cell area a hexagon's perimeter is about 7 percent shorter than a square's, and about 18 percent shorter than a triangle's.",
      sources: [CONJECTURE],
    },
    {
      kind: "note",
      title: "What this wall is",
      body: "A built-in sample, shown because no language model is connected. With an Anthropic API key in place, Bells searches the web and builds a wall like this for any topic you ask about.",
      sources: [],
    },
  ],
  sources: [
    { url: HALES, title: "The Honeycomb Conjecture (T. C. Hales)", cited: true },
    { url: CONJECTURE, title: "Honeycomb conjecture", cited: true },
    { url: TILINGS, title: "Euclidean tilings by convex regular polygons", cited: true },
    { url: HONEYCOMB, title: "Honeycomb", cited: true },
  ],
  walk: [
    [1, "Start with the chart. For one unit of area, a triangle needs the most wall and a circle the least."],
    [3, "The catch is that circles leave gaps. Only three regular shapes tile a flat surface, and the hexagon is the cheapest of them."],
    [2, "Three cells meet at every corner at a hundred and twenty degrees, which is why the comb closes up with nothing wasted."],
    [7, "Against a square grid, that's about seven percent less wax for the same storage."],
    [5, "And it stayed a conjecture until nineteen ninety-nine, when Thomas Hales proved it."],
  ],
};

const PHASES = [
  "Starting research agent",
  "Searching: why honeycomb is hexagonal",
  "Reading: arxiv.org",
  "Composing block 1",
  "Composing block 2",
  "Searching: regular tilings of the plane",
  "Composing block 3",
  "Composing block 4",
  "Composing block 5",
  "Reading: en.wikipedia.org",
  "Composing block 6",
  "Composing block 7",
  "Composing block 8",
  "Composing block 9",
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "It's the middle of the night, boss. I'm running without a language model, so keep your expectations modest.";
  if (hour < 12) return "Morning, boss. I'm running without a language model today, so keep your expectations modest.";
  if (hour < 18) return "Afternoon, boss. I'm running without a language model, so keep your expectations modest.";
  return "Evening, boss. I'm running without a language model tonight, so keep your expectations modest.";
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DemoBrain extends EventTarget {
  kind = "demo";
  label = "DEMO MODE // NO LANGUAGE MODEL";
  serverVoice = false;
  #reports = new Map();
  #turn = 0;
  /** Milliseconds between research steps; tests shorten it. */
  pace = 1050;

  async connect() {
    return { reports: [] };
  }

  reports() {
    return [...this.#reports.values()].map((r) => this.#summary(r)).sort((a, b) => b.createdAt - a.createdAt);
  }

  async report(id) {
    return this.#reports.get(id) ?? null;
  }

  abort() {
    this.#turn++;
  }

  #summary(r) {
    return {
      id: r.id,
      topic: r.topic,
      headline: r.headline,
      status: r.status,
      phase: r.phase,
      blocks: r.blocks.length,
      sources: r.sources.length,
      createdAt: r.createdAt,
      finishedAt: r.finishedAt,
      announced: r.announced,
      demo: true,
    };
  }

  #latest() {
    return [...this.#reports.values()].filter((r) => r.status === "done").sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  async #research() {
    const report = {
      id: `demo_${(this.#reports.size + 1).toString().padStart(2, "0")}`,
      topic: DEMO_REPORT.headline,
      headline: DEMO_REPORT.headline,
      summary: DEMO_REPORT.summary,
      status: "running",
      phase: "STARTING RESEARCH AGENT",
      blocks: [],
      sources: [],
      createdAt: Date.now(),
      finishedAt: null,
      announced: false,
      demo: true,
    };
    this.#reports.set(report.id, report);
    const tell = () => this.dispatchEvent(new CustomEvent("research", { detail: this.#summary(report) }));
    tell();
    (async () => {
      for (const phase of PHASES) {
        await wait(this.pace);
        report.phase = phase.toUpperCase();
        if (phase.startsWith("Composing")) {
          const block = DEMO_REPORT.blocks[report.blocks.length];
          report.blocks.push({ ...block, id: `b${report.blocks.length + 1}`, addedAt: Date.now() });
        } else if (!phase.startsWith("Starting")) {
          report.sources = DEMO_REPORT.sources.slice(0, Math.min(DEMO_REPORT.sources.length, report.sources.length + 2));
        }
        tell();
      }
      await wait(this.pace);
      report.sources = DEMO_REPORT.sources;
      report.status = "done";
      report.phase = "COMPLETE";
      report.finishedAt = Date.now();
      tell();
    })();
    return report;
  }

  /** Same contract as the server brain: words through on.say, HUD actions through on.action. */
  async send({ text, event }, on) {
    const turn = ++this.#turn;
    const live = () => turn === this.#turn;
    const say = async (line) => {
      for (const word of line.match(/\S+\s*/g) ?? []) {
        if (!live()) return;
        on.say(word);
        await wait(22);
      }
      on.say(" ");
    };
    await wait(260);
    if (!live()) return;

    if (event?.type === "boot") return say(greeting());

    if (event?.type === "research_done") {
      const report = this.#reports.get(event.report_id);
      if (!report || report.announced) return;
      report.announced = true;
      return say(`Boss, the report's done. ${report.blocks.length} blocks, ${report.sources.length} sources. Want me to put it on screen and walk you through it?`);
    }

    const said = String(text ?? "").toLowerCase();
    const running = [...this.#reports.values()].some((r) => r.status === "running");

    if (/\b(research|look into|report on|find out|dig into)\b/.test(said)) {
      if (running) return say("One report at a time, boss. The last one is still cooking.");
      const report = await this.#research();
      on.action({ type: "research_started", report: this.#summary(report) });
      return say("I can't research that for real without a language model, boss. What I can do is show you the one report I know by heart. Give me a few seconds.");
    }

    if (/\b(present|show|put (it|that|the report) (up|on)|walk me|yes|yeah|go on|do it|please)\b/.test(said)) {
      const report = this.#latest();
      if (!report) return say(running ? "It isn't finished yet, boss. Patience." : "There's nothing to show yet. Ask me to research something first.");
      await say("Right. Wake the screen, then the report goes up.");
      if (!live()) return;
      on.action({ type: "present_report", id: report.id });
      await say(`Report's up. ${report.blocks.length} blocks on the HUD, and ${report.sources.length} sources behind them.`);
      if (!live()) return;
      on.action({ type: "walk", id: report.id, steps: DEMO_REPORT.walk.map(([i, line]) => ({ block: `b${i + 1}`, say: line })) });
      return say("That's the short version. Plug in an API key and I'll do this for anything you ask.");
    }

    if (/\b(clear|close|take (it|that) down|dismiss|hide)\b/.test(said)) {
      on.action({ type: "clear" });
      return say("Cleared.");
    }

    if (/\btime\b/.test(said)) {
      const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return say(`It's ${now}, boss.`);
    }

    if (/\b(who are you|what are you|your name|what can you do|help)\b/.test(said)) {
      return say("I'm Bells. I listen for my name, I answer back, and with a language model plugged in I run research and put it on this screen. Without one, I can show you a sample. Ask me to research something.");
    }

    if (/\b(thanks|thank you|cheers)\b/.test(said)) return say("Don't mention it, boss.");
    if (/\b(hello|hi|hey|morning|evening)\b/.test(said)) return say("Still here, boss. Ask me to research something.");

    return say("I heard you, boss, but without a language model that's as far as it goes. Ask me to research something and I'll show you what I do.");
  }
}
