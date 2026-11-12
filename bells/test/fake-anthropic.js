// A stand-in for the Anthropic Messages API, for tests and for driving the HUD
// without spending credit. It streams scripted replies in the real wire
// format, and it enforces the rule the real API applies to reasoning blocks:
// a `thinking` block is only valid while the system prompt, the tool list and
// every message before it are exactly what they were when it was produced.

import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const hash = (value) => crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex");

function prefixSignature(body, upTo) {
  const tools = [...(body.tools ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  return `sig_${hash({ system: body.system, tools, prior: body.messages.slice(0, upTo) })}`;
}

const text = (value) => ({ type: "text", text: value });
const tool = (name, input) => ({ type: "tool_use", id: `toolu_${crypto.randomBytes(6).toString("hex")}`, name, input });

function search(query, hits) {
  const id = `srvtoolu_${crypto.randomBytes(6).toString("hex")}`;
  return [
    { type: "server_tool_use", id, name: "web_search", input: { query } },
    {
      type: "web_search_tool_result",
      tool_use_id: id,
      content: hits.map(([url, title]) => ({ type: "web_search_result", url, title, encrypted_content: "x", page_age: null })),
    },
  ];
}

/** What the last user message is replying to. */
function situation(body) {
  const last = body.messages.at(-1);
  if (typeof last.content === "string") return { said: last.content.split("\n").slice(1).join("\n") || last.content };
  const results = last.content.filter((b) => b.type === "tool_result");
  const calls = body.messages.at(-2)?.content?.filter?.((b) => b.type === "tool_use") ?? [];
  return {
    answered: calls.map((c) => c.name),
    results: results.map((r) => (typeof r.content === "string" ? r.content : JSON.stringify(r.content))),
  };
}

function chatScript(body) {
  const now = situation(body);
  if (now.answered) {
    const result = now.results.join("\n");
    if (now.answered.includes("start_research")) {
      return { content: [text("Fine, boss. One report, built to be looked at. On it.")] };
    }
    if (now.answered.includes("present_report")) {
      const ids = [...result.matchAll(/^- (b\d+) \[/gm)].map((m) => m[1]).slice(0, 4);
      if (ids.length === 0) return { content: [text("There's nothing finished to put up yet, boss.")] };
      return {
        content: [
          text("Report's up."),
          tool("walk_through", { steps: ids.map((id, i) => ({ block_id: id, say: `Block ${i + 1} is the part worth your attention here.` })) }),
        ],
        stop: "tool_use",
      };
    }
    if (now.answered.includes("walk_through")) return { content: [text("That's the gist. The rest is on the wall.")] };
    if (now.answered.includes("clear_screen")) return { content: [text("Clear. Like it never happened.")] };
    return { content: [text("Done.")] };
  }

  const said = now.said.toLowerCase();
  if (said.startsWith("[event] the display")) return { content: [text("Evening, boss. What are we breaking tonight?")] };
  if (said.startsWith("[event] research finished")) {
    const counts = now.said.match(/(\d+) blocks from (\d+) sources/);
    return { content: [text(`Boss, the report's done. ${counts?.[1] ?? "Some"} blocks, ${counts?.[2] ?? "several"} sources. Want it on screen?`)] };
  }
  if (said.startsWith("[event]")) return { content: [text("That research job fell over, boss. Want me to try again?")] };
  if (/research|look into|report on/.test(said)) {
    const topic = now.said.replace(/^.*?(research|look into|report on)\s+/i, "").replace(/[.?!]+$/, "") || "Unnamed topic";
    return { content: [text("Right."), tool("start_research", { topic: topic.slice(0, 60), brief: now.said })], stop: "tool_use" };
  }
  if (/present|show|put (it|that) (up|on)|yes/.test(said)) {
    return { content: [text("Right, waking the screen."), tool("present_report", {})], stop: "tool_use" };
  }
  if (/clear|tidy up|take it down/.test(said)) return { content: [tool("clear_screen", {})], stop: "tool_use" };
  if (/slow reply/.test(said)) return { content: [text("This one takes a while to say. ".repeat(12))], slow: true };
  return { content: [text("It's late, boss, but go on. What do you need?")] };
}

function researchScript(body) {
  const turn = body.messages.filter((m) => m.role === "assistant").length;
  const topic = body.messages[0].content.match(/^Topic: (.*)$/m)?.[1] ?? "the topic";
  const site = (n) => `https://example.org/${encodeURIComponent(topic.toLowerCase().replace(/\s+/g, "-"))}/${n}`;
  if (turn === 0) {
    return {
      stop: "tool_use",
      content: [
        ...search(`${topic} overview`, [1, 2, 3, 4, 5].map((n) => [site(`overview-${n}`), `${topic}: overview ${n}`])),
        tool("add_block", { kind: "note", title: "Where things stand", body: `A first finding about ${topic}, with its date and basis stated.`, sources: [site("overview-1")] }),
        tool("add_block", { kind: "stat", title: "Headline figure", value: "≈20m", body: "Cumulative, as reported; not an active-user count.", sources: [site("overview-2")] }),
      ],
    };
  }
  if (turn === 1) {
    return {
      stop: "tool_use",
      content: [
        ...search(`${topic} market share`, [6, 7, 8, 9].map((n) => [site(`share-${n}`), `${topic}: share ${n}`])),
        tool("add_block", {
          kind: "chart",
          title: "Share by platform",
          unit: "% of users",
          series: [
            { label: "Alpha", value: 41 },
            { label: "Beta", value: 27 },
            { label: "Gamma", value: 18 },
            { label: "Delta", value: 9 },
            { label: "Other", value: 5 },
          ],
          body: "One survey month; opt-in sample.",
          sources: [site("share-6")],
        }),
        tool("add_block", { kind: "image", title: "A honeycomb, for scale", wikipedia_title: "Honeycomb", sources: [] }),
        tool("add_block", { kind: "quote", title: "In their words", body: "We are still early, and we know it.", attribution: "A founder, in an interview", sources: [site("share-7")] }),
        // Deliberately incomplete: the agent must be told, not crash.
        tool("add_block", { kind: "stat", title: "Missing its value", sources: [] }),
      ],
    };
  }
  if (turn === 2) {
    return {
      stop: "tool_use",
      content: [
        tool("add_block", { kind: "note", title: "What changed this year", body: "A second finding, with a caveat about the estimate.", sources: [site("overview-3"), site("fresh-10")] }),
        tool("add_block", { kind: "note", title: "What to watch", body: "A third finding that looks ahead.", sources: [site("overview-4")] }),
        tool("finish_report", { headline: topic, summary: `Short version: ${topic} is moving, the numbers are softer than the headlines, and three things matter.` }),
      ],
    };
  }
  return { content: [text("done")] };
}

/** Writes one message as the SSE events the real API would send. */
async function stream(res, body, script, delay) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  const pace = script.slow ? delay * 6 : delay;
  const content = [{ type: "thinking", thinking: "", signature: prefixSignature(body, body.messages.length) }, ...script.content];

  send("message_start", {
    message: {
      id: `msg_${crypto.randomBytes(8).toString("hex")}`,
      type: "message",
      role: "assistant",
      model: body.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 0 },
    },
  });
  for (const [index, block] of content.entries()) {
    await wait(pace);
    if (block.type === "thinking") {
      send("content_block_start", { index, content_block: { type: "thinking", thinking: "", signature: "" } });
      send("content_block_delta", { index, delta: { type: "signature_delta", signature: block.signature } });
    } else if (block.type === "text") {
      send("content_block_start", { index, content_block: { type: "text", text: "" } });
      for (const piece of block.text.match(/\S+\s*/g) ?? []) {
        send("content_block_delta", { index, delta: { type: "text_delta", text: piece } });
        await wait(pace / 3);
      }
    } else if (block.type === "tool_use" || block.type === "server_tool_use") {
      send("content_block_start", { index, content_block: { ...block, input: {} } });
      const json = JSON.stringify(block.input);
      for (let i = 0; i < json.length; i += 40) {
        send("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: json.slice(i, i + 40) } });
      }
      if (block.type === "server_tool_use") await wait(pace * 4);
    } else {
      send("content_block_start", { index, content_block: block });
    }
    send("content_block_stop", { index });
  }
  send("message_delta", { delta: { stop_reason: script.stop ?? "end_turn", stop_sequence: null }, usage: { output_tokens: 60 } });
  send("message_stop", {});
  res.end();
}

export function startFakeAnthropic({ port = 0, delay = 15 } = {}) {
  const state = { requests: [], violations: [] };

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url.startsWith("/v1/messages")) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "not found" } }));
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    state.requests.push({ body, headers: req.headers });

    const problems = [];
    if (!req.headers["x-api-key"] && !req.headers.authorization) problems.push("no credentials sent");
    if (body.stream !== true) problems.push("request was not streamed");
    if (body.messages?.[0]?.role !== "user") problems.push("first message is not from the user");
    body.messages.forEach((message, i) => {
      if (message.role !== "assistant" || !Array.isArray(message.content)) return;
      for (const block of message.content) {
        if (block.type === "thinking" && block.signature !== prefixSignature(body, i)) {
          problems.push(`thinking block in message ${i} was produced under a different prefix`);
        }
      }
    });
    state.violations.push(...problems);

    if (problems.some((p) => p.startsWith("thinking block"))) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: problems.join("; ") } }));
    }

    const isResearch = String(body.system).startsWith("You are the research agent");
    const script = isResearch ? researchScript(body) : chatScript(body);
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    try {
      await stream(res, body, script, isResearch ? delay * 12 : delay);
    } catch {
      res.destroy();
    }
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        requests: state.requests,
        violations: state.violations,
        close: () => new Promise((done) => server.close(done)),
      });
      server.closeAllConnections?.bind(server);
    });
  });
}

// `node test/fake-anthropic.js 4399` runs it standalone for trying the HUD by hand.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fake = await startFakeAnthropic({ port: Number(process.argv[2]) || 4399, delay: Number(process.argv[3]) || 40 });
  console.log(`fake Anthropic API on ${fake.url}`);
}
