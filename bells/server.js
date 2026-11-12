import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { config } from "./lib/config.js";
import { hub } from "./lib/claude.js";
import { chat, resetSession, MODELS } from "./lib/brain.js";
import { getReport, listReports, summarize } from "./lib/store.js";
import { studioVoices, synthesize } from "./lib/voices.js";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(payload);
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body too large."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("Request body is not valid JSON."), { status: 400 });
  }
}

/**
 * This server spends the owner's API credit and has no login, so it only
 * answers pages it served itself. A request carrying another site's Origin is
 * refused, and writes must be JSON, which a cross-site form cannot send.
 */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.resolve(config.publicDir, relative);
  if (file !== config.publicDir && !file.startsWith(config.publicDir + path.sep)) return send(res, 403, "Forbidden");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found");
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(data);
  });
}

function status() {
  return {
    name: "Bells",
    owner: config.owner,
    brain: config.hasBrain ? "claude" : "demo",
    model: config.model,
    voice: config.hasServerVoice ? "server" : "browser",
    reports: listReports().slice(0, 40).map(summarize),
  };
}

/** Long-lived stream of research progress for the HUD. */
function events(req, res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  const push = (name, data) => res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  push("hello", status());
  const onResearch = (summary) => push("research", summary);
  hub.on("research", onResearch);
  const beat = setInterval(() => res.write(": beat\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(beat);
    hub.off("research", onResearch);
  });
}

/** One conversational turn, streamed back as newline-delimited JSON. */
async function chatRoute(req, res) {
  const body = await readJson(req, 25 * 1024 * 1024);
  const sessionId = String(body.session ?? "").slice(0, 64);
  if (!sessionId) return send(res, 400, { error: "Missing session." });
  if (!config.hasBrain) return send(res, 503, { error: "No Anthropic credentials configured." });

  res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
    "x-accel-buffering": "no",
  });
  const emit = (event) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  await chat(
    {
      sessionId,
      text: typeof body.text === "string" ? body.text : "",
      event: body.event && typeof body.event === "object" ? body.event : null,
      tz: typeof body.tz === "string" ? body.tz.slice(0, 64) : "",
      screen: typeof body.screen === "string" ? body.screen.slice(0, 32) : null,
      model: typeof body.model === "string" ? body.model.slice(0, 64) : "",
      files: Array.isArray(body.files) ? body.files.slice(0, 10) : [],
    },
    emit,
    controller.signal,
  );
  emit({ t: "done" });
  res.end();
}

/** Optional studio voice: one sentence of audio, fetched here so the key never reaches the page. */
async function speakRoute(req, res) {
  if (!config.hasServerVoice) return send(res, 404, { error: "No studio voice configured." });
  const body = await readJson(req);
  const text = String(body.text ?? "").trim().slice(0, 1200);
  if (!text) return send(res, 400, { error: "Nothing to say." });
  try {
    const audio = await synthesize(text, typeof body.voice === "string" ? body.voice : "");
    res.writeHead(200, { "content-type": "audio/mpeg", "cache-control": "no-store" });
    res.end(audio);
  } catch (err) {
    console.error(`[bells] ${err.message}`);
    send(res, 502, { error: "The voice service did not return audio." });
  }
}

/** The studio voices on offer, for the picker. */
async function voicesRoute(res) {
  if (!config.hasServerVoice) return send(res, 200, { voices: [] });
  try {
    send(res, 200, { voices: await studioVoices() });
  } catch (err) {
    console.error(`[bells] ${err.message}`);
    send(res, 502, { error: "The voice service did not return its voices." });
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (!pathname.startsWith("/api/")) {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
      return serveStatic(req, res, pathname);
    }
    if (!sameOrigin(req)) return send(res, 403, { error: "Cross-origin requests are not accepted." });

    if (req.method === "GET") {
      if (pathname === "/api/status") return send(res, 200, status());
      if (pathname === "/api/events") return events(req, res);
      if (pathname === "/api/reports") return send(res, 200, listReports().map(summarize));
      if (pathname === "/api/voices") return await voicesRoute(res);
      if (pathname === "/api/models") return send(res, 200, { models: MODELS, current: config.model });
      const match = pathname.match(/^\/api\/reports\/([\w-]{1,40})$/);
      if (match) {
        const report = getReport(match[1]);
        return report ? send(res, 200, report) : send(res, 404, { error: "No such report." });
      }
      return send(res, 404, { error: "Not found." });
    }

    if (req.method === "POST") {
      if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) {
        return send(res, 415, { error: "Send JSON." });
      }
      if (pathname === "/api/chat") return await chatRoute(req, res);
      if (pathname === "/api/speak") return await speakRoute(req, res);
      if (pathname === "/api/reset") {
        const body = await readJson(req);
        resetSession(String(body.session ?? ""));
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "Not found." });
    }
    return send(res, 405, { error: "Method not allowed." });
  } catch (err) {
    if (!err.status) console.error("[bells] request failed:", err);
    if (res.headersSent) return res.end();
    send(res, err.status ?? 500, { error: err.status ? err.message : "Internal error." });
  }
});

server.listen(config.port, config.host, () => {
  const where = `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}`;
  console.log(`\n  BELLS is up: ${where}\n`);
  console.log(`  brain  ${config.hasBrain ? config.model : "none - demo mode (set ANTHROPIC_API_KEY for the real thing)"}`);
  console.log(`  voice  ${config.hasServerVoice ? "ElevenLabs studio voices, plus your browser's" : "your browser's speech synthesis"}`);
  console.log(`  open it in Chrome or Edge, click once, and say "Hey Bells".\n`);
});
