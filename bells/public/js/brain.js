// The HUD's link to whatever is doing the thinking: the local server (Claude),
// or the scripted stand-in from demo.js when there is no server or no key.

import { DemoBrain } from "./demo.js";
import { HostedBrain, hostedRuntime } from "./hosted.js";

class ServerBrain extends EventTarget {
  kind = "claude";
  #reports = new Map();
  #controller = null;

  constructor(status) {
    super();
    this.session = sessionId();
    this.#apply(status);
  }

  #apply(status) {
    this.model = status.model;
    // "claude-opus-5-5" reads better on the HUD as "CLAUDE OPUS 5.5".
    this.label = String(status.model ?? "claude")
      .replace(/(\d)-(?=\d)/g, "$1.")
      .replace(/-/g, " ")
      .toUpperCase();
    this.serverVoice = status.voice === "server";
    for (const summary of status.reports ?? []) this.#reports.set(summary.id, summary);
  }

  async connect() {
    const source = new EventSource("api/events");
    source.addEventListener("hello", (event) => this.#apply(JSON.parse(event.data)));
    source.addEventListener("research", (event) => {
      const summary = JSON.parse(event.data);
      this.#reports.set(summary.id, summary);
      this.dispatchEvent(new CustomEvent("research", { detail: summary }));
    });
    source.onerror = () => this.dispatchEvent(new CustomEvent("link", { detail: { up: false } }));
    source.onopen = () => this.dispatchEvent(new CustomEvent("link", { detail: { up: true } }));
    return { reports: this.reports() };
  }

  reports() {
    return [...this.#reports.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async report(id) {
    const res = await fetch(`api/reports/${encodeURIComponent(id)}`);
    return res.ok ? res.json() : null;
  }

  abort() {
    this.#controller?.abort();
  }

  async send(payload, on) {
    this.abort();
    const controller = new AbortController();
    this.#controller = controller;
    let res;
    try {
      res = await fetch("api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session: this.session,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...payload,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name !== "AbortError") on.error("I can't reach my own server. Is it still running?");
      return;
    }
    if (!res.ok || !res.body) {
      on.error("My server turned that request down. Check its log.");
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.t === "say") on.say(event.text);
          else if (event.t === "action") on.action(event.action);
          else if (event.t === "error") on.error(event.say);
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") on.error("I lost the connection halfway through that.");
    }
  }
}

function sessionId() {
  const make = () => `hud-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  try {
    let id = sessionStorage.getItem("bells.session");
    if (!id) sessionStorage.setItem("bells.session", (id = make()));
    return id;
  } catch {
    return make();
  }
}

/**
 * Picks the brain: Claude through the Artifact viewer when the page is hosted
 * there, the local server's when it has a key, and the scripted demo otherwise.
 * `hosted` carries the platform's voice and dictation, when there are any.
 */
export async function connectBrain() {
  if (new URLSearchParams(location.search).has("demo")) return { brain: new DemoBrain(), hosted: null };

  if (window.claude?.use) {
    const hosted = await hostedRuntime();
    return { brain: hosted?.sample ? new HostedBrain(hosted) : new DemoBrain(), hosted };
  }

  try {
    const res = await fetch("api/status", { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const status = await res.json();
      if (status.brain === "claude") return { brain: new ServerBrain(status), hosted: null };
    }
  } catch {
    // No server behind this page (opened as a file, or hosted statically).
  }
  return { brain: new DemoBrain(), hosted: null };
}
