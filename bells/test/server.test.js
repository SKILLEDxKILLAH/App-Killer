// End-to-end: the real server and the real Anthropic SDK, talking to the
// scripted API in fake-anthropic.js. Run with `npm test`.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeAnthropic } from "./fake-anthropic.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 4500 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;
const session = "test-session";

let fake;
let studio;
let server;
let dataDir;

/** A stand-in for the ElevenLabs API: a voice list, and "audio" that names what was asked for. */
function startFakeStudio() {
  const seen = [];
  const srv = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen.push({ method: req.method, url: req.url, key: req.headers["xi-api-key"], body: Buffer.concat(chunks).toString("utf8") });
    if (req.headers["xi-api-key"] !== "el-test-key") {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end('{"detail":"bad key"}');
    }
    if (req.method === "GET" && req.url.startsWith("/v2/voices")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({
          voices: [
            { voice_id: "voiceZed00000000001", name: "Zed", category: "premade", labels: {} },
            { voice_id: "voiceAmy00000000002", name: "Amy", category: "premade", labels: { accent: "british", gender: "female", age: "middle_aged" } },
            { voice_id: "../../etc/passwd", name: "Not a voice id", labels: {} },
          ],
          has_more: false,
        }),
      );
    }
    const speak = req.url.match(/^\/v1\/text-to-speech\/([^/?]+)/);
    if (req.method === "POST" && speak) {
      res.writeHead(200, { "content-type": "audio/mpeg" });
      return res.end(`ID3 ${speak[1]} says ${JSON.parse(seen.at(-1).body).text}`);
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${srv.address().port}`, seen, close: () => new Promise((done) => srv.close(done)) })));
}

async function waitFor(check, { timeout = 20_000, every = 100 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, every));
  }
}

/** Sends one turn and collects what Bells said and did. */
async function turn(payload) {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session, tz: "Europe/London", ...payload }),
  });
  assert.equal(res.status, 200);
  const events = (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    events,
    said: events.filter((e) => e.t === "say").map((e) => e.text).join("").trim(),
    actions: events.filter((e) => e.t === "action").map((e) => e.action),
    errors: events.filter((e) => e.t === "error"),
  };
}

before(async () => {
  fake = await startFakeAnthropic({ delay: 2 });
  studio = await startFakeStudio();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bells-test-"));
  server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      HOME: dataDir, // no `ant` profile, no stray .env values
      PORT: String(port),
      ANTHROPIC_BASE_URL: fake.url,
      ANTHROPIC_API_KEY: "test-key",
      BELLS_DATA_DIR: dataDir,
      BELLS_QUICK_SEARCH: "1",
      ELEVENLABS_API_KEY: "el-test-key",
      ELEVENLABS_BASE_URL: studio.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  await waitFor(() => fetch(`${base}/api/status`).then((r) => r.ok, () => false));
});

after(async () => {
  server?.kill();
  await fake?.close();
  await studio?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("reports a Claude brain and serves the HUD", async () => {
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.brain, "claude");
  assert.equal(status.model, "claude-opus-5-5");
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Bells/);
});

test("refuses writes from other sites", async () => {
  const foreign = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ session, text: "research something expensive" }),
  });
  assert.equal(foreign.status, 403);
  const form = await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(form.status, 415);
  const escape = await fetch(`${base}/..%2f..%2fpackage.json`);
  assert.notEqual(escape.status, 200);
});

test("a full conversation: greet, research, announce, present, walk through", async () => {
  const hello = await turn({ event: { type: "boot" } });
  assert.match(hello.said, /boss/i);
  assert.equal(hello.errors.length, 0);

  const ask = await turn({ text: "Hey, can you research the state of VR" });
  assert.equal(ask.actions[0]?.type, "research_started");
  assert.match(ask.said, /^Right\. .*On it\.$/, "speech before and after the tool call, in order, with a space between");
  const sayBefore = ask.events.findIndex((e) => e.t === "say");
  const action = ask.events.findIndex((e) => e.t === "action");
  assert.ok(sayBefore < action, "the line before the tool call streams before the action");
  const id = ask.actions[0].report.id;

  const report = await waitFor(async () => {
    const r = await (await fetch(`${base}/api/reports/${id}`)).json();
    return r.status !== "running" ? r : null;
  });
  assert.equal(report.status, "done");
  assert.deepEqual(
    report.blocks.map((b) => b.kind),
    ["note", "stat", "chart", "image", "quote", "note", "note"],
    "the stat with no value was turned away, everything else was recorded",
  );
  assert.equal(report.blocks[3].wikipedia, "Honeycomb");
  assert.ok(report.sources.length >= 10, `sources from search results and citations (${report.sources.length})`);
  assert.ok(report.sources.some((s) => s.cited) && report.sources.some((s) => !s.cited));
  assert.match(report.summary, /Short version/);
  assert.equal(report.headline, "the state of VR");

  const done = await turn({ event: { type: "research_done", report_id: id } });
  assert.match(done.said, /7 blocks, \d+ sources/);
  const again = await turn({ event: { type: "research_done", report_id: id } });
  assert.equal(again.said, "", "a finished job is only announced once");

  const present = await turn({ text: "Yes please, present the report" });
  assert.deepEqual(present.actions.map((a) => a.type), ["present_report", "walk"]);
  assert.equal(present.actions[0].id, id);
  assert.equal(present.actions[1].steps.length, 4);
  assert.match(present.said, /Report's up\. .*on the wall\.$/);

  const clear = await turn({ text: "clear the screen", screen: id });
  assert.deepEqual(clear.actions.map((a) => a.type), ["clear"]);
});

test("the conversation history stays valid for the API", async () => {
  const chat = fake.requests.filter((r) => String(r.body.system).startsWith("You are Bells"));
  assert.ok(chat.length >= 8, `several chat requests were made (${chat.length})`);
  assert.deepEqual(fake.violations, []);

  const systems = new Set(chat.map((r) => r.body.system));
  assert.equal(systems.size, 1, "the system prompt never changes mid-conversation");
  const tools = new Set(chat.map((r) => JSON.stringify(r.body.tools)));
  assert.equal(tools.size, 1, "the tool list never changes mid-conversation");

  const last = chat.at(-1).body;
  const thinking = last.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === "thinking");
  assert.ok(thinking.length >= 6, "reasoning blocks are sent back with the history");
  assert.deepEqual(
    Object.keys(last).sort(),
    ["fallbacks", "max_tokens", "messages", "model", "output_config", "stream", "system", "tools"],
    "only API fields reach the API; the SDK's own loop settings stay behind",
  );
  assert.equal(last.fallbacks, "default");
  assert.match(chat.at(-1).headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  assert.deepEqual(last.output_config, { effort: "low" });
  assert.ok(last.tools.some((t) => t.type === "web_search_20260209"));
  assert.ok(last.tools.filter((t) => t.input_schema).every((t) => t.eager_input_streaming === true));
});

test("an interrupted reply does not corrupt the history", async () => {
  const controller = new AbortController();
  const slow = fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session, text: "give me the slow reply" }),
    signal: controller.signal,
  });
  const res = await slow;
  const reader = res.body.getReader();
  await reader.read();
  controller.abort();
  await new Promise((r) => setTimeout(r, 150));

  const next = await turn({ text: "hello again" });
  assert.equal(next.errors.length, 0);
  assert.match(next.said, /boss/);
  assert.deepEqual(fake.violations, []);
  const body = fake.requests.at(-1).body;
  const interrupted = body.messages.find((m) => m.role === "assistant" && typeof m.content === "string" && m.content.includes("[interrupted]"));
  assert.ok(interrupted, "the cut-off reply is kept as plain text");
});

test("studio voices: lists them, speaks in the chosen one, keeps the key server-side", async () => {
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.voice, "server", "a key alone turns studio voices on");

  const listing = await fetch(`${base}/api/voices`);
  const { voices } = await listing.json();
  assert.deepEqual(voices, [
    { id: "voiceAmy00000000002", name: "Amy", detail: "british, female, middle aged" },
    { id: "voiceZed00000000001", name: "Zed", detail: "" },
  ]);
  assert.ok(!JSON.stringify(voices).includes("el-test-key"));

  const say = (body) => fetch(`${base}/api/speak`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const chosen = await say({ text: "Evening, boss.", voice: "voiceZed00000000001" });
  assert.equal(chosen.headers.get("content-type"), "audio/mpeg");
  assert.equal(await chosen.text(), "ID3 voiceZed00000000001 says Evening, boss.");

  const fallback = await say({ text: "No voice named." });
  assert.match(await fallback.text(), /^ID3 voiceAmy00000000002 /, "with no voice named, the first listed one speaks");

  const hostile = await say({ text: "Nice try.", voice: "../../v1/user" });
  assert.match(await hostile.text(), /^ID3 voiceAmy00000000002 /, "anything that isn't a voice id is ignored");

  assert.equal((await say({ text: "   " })).status, 400);
  assert.ok(studio.seen.every((r) => r.key === "el-test-key"));
  assert.equal(studio.seen.filter((r) => r.url.startsWith("/v2/voices")).length, 1, "the voice list is fetched once and reused");
  const sent = JSON.parse(studio.seen.at(-1).body);
  assert.deepEqual(Object.keys(sent).sort(), ["model_id", "text"]);
});
