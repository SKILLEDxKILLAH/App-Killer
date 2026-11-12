// The parts of the display that aren't Bells herself: research cards, the
// report wall, the side panel, captions and the status bar.
//
// Report content comes from the web by way of a language model, so nothing
// here is ever inserted as HTML. Text goes in as text; links are checked.

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "style") node.style.cssText = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function hostOf(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function link(url, text) {
  const href = safeUrl(url);
  return href ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text }) : el("span", { text });
}

export function ago(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const figure = (v) => (Math.abs(v) >= 10000 ? compact.format(v) : number.format(v));

/* --------------------------------------------------------- research cards */

export class Cards {
  /** @param {(id: string) => void} onOpen  called when a finished card is chosen */
  constructor(onOpen) {
    this.root = $("cards");
    this.onOpen = onOpen;
    this.items = new Map();
    setInterval(() => this.#tick(), 1000);
  }

  update(summary) {
    let item = this.items.get(summary.id);
    if (!item) {
      const node = el("button", { class: "card", type: "button" });
      node.addEventListener("click", () => {
        if (this.items.get(summary.id)?.summary.status === "done") this.onOpen(summary.id);
      });
      const parts = {
        state: el("span", { class: "card-state" }),
        time: el("span", { class: "card-time" }),
        title: el("div", { class: "card-title" }),
        phase: el("div", { class: "card-phase" }),
        blocks: el("span"),
        sources: el("span"),
        added: el("span"),
      };
      node.append(
        el("div", { class: "card-head" }, el("span", {}, "RESEARCH ", el("span", { class: "slashes", text: "// " }), parts.state), parts.time),
        parts.title,
        parts.phase,
        el("div", { class: "card-bar", "aria-hidden": "true" }, Array.from({ length: 28 }, (_, n) => el("i", { style: `--n:${n}` }))),
        el("div", { class: "card-stats" }, parts.blocks, parts.sources),
        el("div", { class: "card-foot" }, parts.added, el("span", { text: summary.id.toUpperCase() })),
      );
      this.root.prepend(node);
      item = { node, parts, summary };
      this.items.set(summary.id, item);
    }
    item.summary = summary;
    const { node, parts } = item;
    const state = { running: "ACTIVE", done: "COMPLETE", failed: "FAILED", cancelled: "CANCELLED" }[summary.status] ?? summary.status;
    node.dataset.status = summary.status;
    node.disabled = summary.status !== "done";
    node.setAttribute("aria-label", `Research on ${summary.headline || summary.topic}: ${state.toLowerCase()}`);
    parts.state.textContent = state;
    parts.title.textContent = summary.headline || summary.topic;
    parts.phase.textContent = summary.status === "done" ? "Ready - select to put on screen" : summary.error && summary.status !== "running" ? summary.error : summary.phase;
    parts.blocks.textContent = `${summary.blocks} BLOCK${summary.blocks === 1 ? "" : "S"}`;
    parts.sources.textContent = `${summary.sources} SOURCE${summary.sources === 1 ? "" : "S"}`;
    this.#tick();
    this.#sync();
  }

  #tick() {
    for (const { parts, summary } of this.items.values()) {
      const end = summary.status === "running" ? Date.now() : summary.finishedAt ?? Date.now();
      parts.time.textContent = clock(end - summary.createdAt);
      parts.added.textContent = `STARTED ${ago(summary.createdAt).toUpperCase()}`;
    }
  }

  #sync() {
    document.body.dataset.cards = String(this.items.size > 0);
  }

  remove(id) {
    this.items.get(id)?.node.remove();
    this.items.delete(id);
    this.#sync();
  }

  /** Clears finished cards; jobs still running stay where they are. */
  clear() {
    for (const [id, item] of this.items) if (item.summary.status !== "running") this.remove(id);
  }
}

/* ------------------------------------------------------------ report wall */

const KIND_LABEL = { note: "NOTE", stat: "FIGURE", chart: "CHART", image: "IMAGE", quote: "QUOTE" };
const imageCache = new Map();

/** Looks up a Wikipedia article's lead image from the browser (see lib/images.js). */
function wikipediaImage(title) {
  if (!imageCache.has(title)) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "pageimages|info",
      piprop: "thumbnail",
      pithumbsize: "960",
      inprop: "url",
      redirects: "1",
      origin: "*",
      titles: title,
    });
    imageCache.set(
      title,
      fetch(`https://en.wikipedia.org/w/api.php?${params}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          const page = body?.query?.pages?.[0];
          const src = page?.thumbnail?.source;
          if (!src || page.missing || !/^https:\/\/[\w.-]*wikimedia\.org\//.test(src)) return null;
          return { src, page: page.fullurl, title: page.title };
        })
        .catch(() => null),
    );
  }
  return imageCache.get(title);
}

export class Wall {
  constructor() {
    this.root = $("wall");
    this.grid = $("wall-grid");
    this.tip = $("tip");
    this.report = null;
    this.tidy = false;
    this.observer = new ResizeObserver((entries) => {
      for (const entry of entries) this.#span(entry.target);
    });
    new ResizeObserver(() => this.#spanAll()).observe(this.grid);
  }

  get showing() {
    return this.report?.id ?? null;
  }

  show(report) {
    this.report = report;
    this.root.hidden = false;
    this.root.scrollTop = 0;
    document.body.dataset.docked = "true";
    this.#render();
  }

  hide() {
    this.report = null;
    this.root.hidden = true;
    this.grid.replaceChildren();
    this.#hideTip();
    delete document.body.dataset.docked;
  }

  setTidy(on) {
    this.tidy = on;
    this.grid.classList.toggle("is-tidy", on);
    if (this.report) this.#render();
  }

  /** Highlights one block (and turns its stack to it); null clears. */
  focus(blockId) {
    for (const node of this.grid.querySelectorAll(".is-focus")) node.classList.remove("is-focus");
    this.grid.classList.toggle("has-focus", Boolean(blockId));
    if (!blockId) return;
    const node = [...this.grid.children].find((child) => child.dataset.blocks?.split(" ").includes(blockId));
    if (!node) return;
    node.turnTo?.(blockId);
    node.classList.add("is-focus");
    // On a phone the caption covers the lower half, so bring the block to the top.
    node.scrollIntoView({ block: window.innerWidth < 760 ? "start" : "nearest", behavior: "smooth" });
  }

  #render() {
    const report = this.report;
    this.unsourced = report.origin === "model" ? "MODEL KNOWLEDGE" : "NO SOURCE";
    this.observer.disconnect();
    $("wall-title").textContent = report.headline || report.topic;
    $("wall-summary").textContent = report.summary ?? "";
    const counts = $("wall-counts");
    counts.replaceChildren(`${report.blocks.length} BLOCKS · ${report.sources?.length ?? 0} SOURCES · ${ago(report.finishedAt ?? report.createdAt).toUpperCase()}`);
    if (report.demo) counts.append(el("span", { class: "demo-flag", text: "SAMPLE" }));
    if (report.origin === "model") counts.append(el("span", { class: "demo-flag", text: "FROM MEMORY // NO LIVE SOURCES" }));

    // A long report keeps its notes in stacks so the figures stay in view.
    const perStack = this.tidy ? 3 : report.blocks.length > 10 ? 2 : 1;
    const notes = report.blocks.filter((b) => b.kind === "note");
    const stackOf = new Map();
    if (perStack > 1 && notes.length > (this.tidy ? 1 : perStack)) {
      for (let i = 0; i < notes.length; i += perStack) {
        const group = notes.slice(i, i + perStack);
        if (group.length > 1) group.forEach((b) => stackOf.set(b.id, group));
      }
    }

    const nodes = [];
    const placed = new Set();
    report.blocks.forEach((block, index) => {
      if (placed.has(block.id)) return;
      const group = stackOf.get(block.id);
      const node = group ? this.#stack(group, report) : this.#block(block, index);
      (group ?? [block]).forEach((b) => placed.add(b.id));
      node.dataset.blocks = (group ?? [block]).map((b) => b.id).join(" ");
      node.style.setProperty("--i", nodes.length);
      nodes.push(node);
    });
    if (report.sources?.length) {
      const sources = this.#sources(report);
      sources.style.setProperty("--i", nodes.length);
      nodes.push(sources);
    }
    this.grid.replaceChildren(...nodes);
    this.grid.classList.remove("has-focus");
    for (const node of nodes) this.observer.observe(node);
    this.#spanAll();
  }

  /** Masonry: each card spans as many 2px rows as its own height needs. */
  #span(node) {
    node.style.gridRowEnd = "auto";
    const gap = Number.parseFloat(getComputedStyle(node).marginBottom) || 0;
    node.style.gridRowEnd = `span ${Math.max(1, Math.ceil((node.offsetHeight + gap) / 2))}`;
  }

  #spanAll() {
    for (const node of this.grid.children) this.#span(node);
  }

  #head(block, index) {
    return el(
      "div",
      { class: "block-head" },
      el("span", {}, `${KIND_LABEL[block.kind] ?? "BLOCK"} `, el("span", { class: "slashes", text: "// " }), String(index + 1).padStart(2, "0")),
      el("span", { text: block.addedAt ? `ADDED ${ago(block.addedAt).toUpperCase()}` : "" }),
    );
  }

  #foot(block) {
    // One entry per site; further pages from the same site follow as numbers.
    const urls = (block.sources ?? []).map(safeUrl).filter(Boolean);
    const sites = new Map();
    for (const url of urls) sites.set(hostOf(url), [...(sites.get(hostOf(url)) ?? []), url]);
    const shown = [...sites].slice(0, 3).map(([host, pages]) =>
      el("span", {}, link(pages[0], host), pages.slice(1, 4).map((url, i) => [" ", link(url, String(i + 2))])),
    );
    if (sites.size > 3) shown.push(el("span", { text: `+${sites.size - 3}` }));
    return el("div", { class: "block-foot" }, el("span", { class: "block-srcs" }, shown.length ? shown : el("span", { text: this.unsourced })), el("span", { class: "block-id", text: block.id.toUpperCase() }));
  }

  #content(block, index) {
    switch (block.kind) {
      case "stat":
        return [el("div", { class: "stat-value", text: block.value }), el("h2", { class: "block-title", text: block.title }), block.body && el("p", { class: "block-body", text: block.body })];
      case "chart":
        return [el("h2", { class: "block-title", text: block.title }), this.#chart(block, index), block.body && el("p", { class: "block-body", text: block.body })];
      case "quote":
        return [el("p", { class: "quote-text", text: block.body }), el("div", { class: "quote-by", text: block.attribution || block.title })];
      default:
        return [el("h2", { class: "block-title", text: block.title }), block.body && el("p", { class: "block-body", text: block.body })];
    }
  }

  #block(block, index) {
    if (block.kind === "image") return this.#image(block, index);
    return el("article", { class: `block block-${block.kind}` }, this.#head(block, index), this.#content(block, index), this.#foot(block));
  }

  #image(block, index) {
    const frame = el("div", { class: "image-frame" }, el("span", { text: `IMAGE // ${block.wikipedia ?? block.title}` }));
    const mount = (image) => {
      if (!image?.src) return;
      const img = el("img", { alt: block.title, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
      img.addEventListener("load", () => img.classList.add("is-loaded"));
      img.addEventListener("error", () => img.remove());
      img.src = image.src;
      frame.append(img);
    };
    // A block may carry its own drawing for when the photograph can't be fetched.
    const drawn = block.fallback ? { src: block.fallback } : null;
    if (block.image) mount(block.image);
    else if (block.wikipedia) wikipediaImage(block.wikipedia).then((image) => mount(image ?? drawn));
    else mount(drawn);
    return el(
      "article",
      { class: "block block-image" },
      this.#head(block, index),
      el("figure", {}, frame, el("figcaption", { text: block.title })),
      this.#foot(block),
    );
  }

  #stack(group, report) {
    let page = 0;
    const pages = group.map((block) => {
      const index = report.blocks.indexOf(block);
      return el("div", { class: "stack-page" }, this.#head(block, index), this.#content(block, index), this.#foot(block));
    });
    const dots = group.map(() => el("i"));
    const turn = (to) => {
      page = (to + group.length) % group.length;
      pages.forEach((p, i) => (p.hidden = i !== page));
      dots.forEach((d, i) => d.classList.toggle("is-on", i === page));
    };
    const node = el(
      "article",
      { class: "block block-note block-stack" },
      pages,
      el(
        "div",
        { class: "stack-nav" },
        el("button", { type: "button", "aria-label": "Previous note", text: "◂", onclick: () => turn(page - 1) }),
        dots,
        el("button", { type: "button", "aria-label": "Next note", text: "▸", onclick: () => turn(page + 1) }),
      ),
    );
    node.turnTo = (blockId) => turn(Math.max(0, group.findIndex((b) => b.id === blockId)));
    turn(0);
    return node;
  }

  /** One series of columns: capped at 24px, rounded at the data end, value on the cap. */
  #chart(block, index) {
    const series = (block.series ?? []).filter((s) => Number.isFinite(s.value));
    const hi = Math.max(0, ...series.map((s) => s.value));
    const lo = Math.min(0, ...series.map((s) => s.value));
    const range = hi - lo || 1;
    const zero = (0 - lo) / range; // where the baseline sits, from the bottom
    const unit = block.unit ? ` ${block.unit}` : "";

    const columns = series.map((s, n) => {
      const size = `${(Math.abs(s.value) / range) * 100}%`;
      const negative = s.value < 0;
      const bar = el(
        "span",
        {
          class: `chart-bar${negative ? " is-negative" : ""}`,
          style: `--n:${n};--i:${index};position:absolute;left:0;right:0;margin-inline:auto;height:${size};${negative ? `top:${(1 - zero) * 100}%` : `bottom:${zero * 100}%`}`,
        },
        el("span", { class: "chart-val", style: negative ? "bottom:auto;top:calc(100% + 3px)" : "", text: figure(s.value) }),
      );
      const column = el("button", { class: "chart-col", type: "button", "aria-label": `${s.label}: ${figure(s.value)}${unit}` }, bar);
      const show = () => this.#showTip(bar, figure(s.value) + unit, s.label);
      column.addEventListener("pointerenter", show);
      column.addEventListener("focus", show);
      column.addEventListener("pointerleave", () => this.#hideTip());
      column.addEventListener("blur", () => this.#hideTip());
      return column;
    });

    return el(
      "div",
      { class: "chart" },
      block.unit && el("span", { class: "chart-unit", text: block.unit }),
      el("div", { class: "chart-plot" }, columns),
      el("div", { class: "chart-labels", "aria-hidden": "true" }, series.map((s) => el("span", { text: s.label }))),
      el(
        "table",
        { class: "sr-only" },
        el("caption", { text: block.title }),
        el("tbody", {}, series.map((s) => el("tr", {}, el("th", { scope: "row", text: s.label }), el("td", { text: figure(s.value) + unit })))),
      ),
    );
  }

  #showTip(anchor, value, label) {
    const tip = this.tip;
    tip.replaceChildren(el("b", { text: value }), el("span", { text: label }));
    tip.hidden = false;
    const box = anchor.getBoundingClientRect();
    const own = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - own.width - 8, Math.max(8, box.left + box.width / 2 - own.width / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, box.top - own.height - 22)}px`;
  }

  #hideTip() {
    this.tip.hidden = true;
  }

  #sources(report) {
    const sorted = [...report.sources].sort((a, b) => Number(Boolean(b.cited)) - Number(Boolean(a.cited)));
    const cited = sorted.filter((s) => s.cited).length;
    return el(
      "article",
      { class: "block block-sources" },
      el("div", { class: "block-head" }, el("span", {}, "SOURCES ", el("span", { class: "slashes", text: "// " }), String(sorted.length)), el("span", { text: `${cited} CITED` })),
      el(
        "ul",
        { class: "source-list" },
        sorted.map((source) => {
          const href = safeUrl(source.url);
          if (!href) return null;
          return el(
            "li",
            { "data-cited": String(Boolean(source.cited)) },
            el("a", { href, target: "_blank", rel: "noopener noreferrer", title: source.title || href }, el("b", { text: hostOf(href) }), source.title || ""),
          );
        }),
      ),
    );
  }
}

/* ------------------------------------------------------------------ panel */

export class Panel {
  constructor() {
    this.root = $("panel");
    this.body = $("panel-body");
    this.title = $("panel-title");
    this.which = null;
    $("panel-close").addEventListener("click", () => this.close());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.which) this.close();
    });
  }

  close() {
    this.root.hidden = true;
    this.which = null;
    for (const chip of [$("chip-history"), $("chip-voice")]) chip.setAttribute("aria-expanded", "false");
  }

  #open(which, title, chip, content) {
    this.which = which;
    this.title.textContent = title;
    this.body.replaceChildren(...content.filter(Boolean));
    this.root.hidden = false;
    for (const other of [$("chip-history"), $("chip-voice")]) other.setAttribute("aria-expanded", String(other === chip));
  }

  history({ reports, lines, onOpen }) {
    if (this.which === "history") return this.close();
    const rows = reports.map((r) => {
      const state = r.status === "done" ? `${r.blocks} blocks` : r.status;
      return el(
        "button",
        { class: "report-row", type: "button", disabled: r.status !== "done", onclick: () => onOpen(r.id) },
        el("strong", { text: r.headline || r.topic }),
        el("small", { text: state }),
        el("small", { text: `${r.id} · ${ago(r.createdAt)}` }),
      );
    });
    const talk = lines.slice(-40).map((line) => el("p", { class: "line", "data-who": line.who }, el("b", { text: line.who === "you" ? "YOU" : "BELLS" }), el("span", { text: line.text })));
    this.#open("history", "HISTORY", $("chip-history"), [
      el("div", { class: "panel-label", text: "Reports" }),
      ...(rows.length ? rows : [el("p", { class: "panel-empty", text: "Nothing researched yet. Ask her to look into something." })]),
      el("div", { class: "panel-label", text: "Conversation" }),
      ...(talk.length ? talk : [el("p", { class: "panel-empty", text: "Nothing said yet." })]),
    ]);
    this.body.scrollTop = 0;
  }

  /**
   * Draws the voice panel, or redraws it after a change.
   * @param {object} o
   * @param {"wake"|"tap"|"none"} o.listen  how this view can hear the user
   * @param {string} o.listenNote           what to tell them about it
   */
  async voice({ mouth, prefs, listen, listenNote, onChange, onTest, brain, onModel }) {
    const draw = (this.voiceDraw = (this.voiceDraw ?? 0) + 1);
    const groups = await mouth.catalog();
    if (draw !== this.voiceDraw) return; // a newer redraw is already on its way

    const how = mouth.resolve();
    const ids = groups.flatMap((group) => group.options.map((option) => option.id));
    const chosen = ids.includes(mouth.settings.choice) ? mouth.settings.choice : "";
    const select = el(
      "select",
      { id: "voice-select", onchange: (e) => onChange({ choice: e.target.value }) },
      el("option", { value: "", selected: chosen === "", text: "Automatic" }),
      groups.map((group) => el("optgroup", { label: group.label }, group.options.map((o) => el("option", { value: o.id, selected: o.id === chosen, text: o.name })))),
    );

    const slider = (name, key, min, max) => {
      const out = el("span", { text: Number(mouth.settings[key]).toFixed(2) });
      return el(
        "div",
        { class: "field" },
        el("label", { for: `voice-${key}` }, name, out),
        el("input", {
          id: `voice-${key}`,
          type: "range",
          min,
          max,
          step: 0.01,
          value: mouth.settings[key],
          oninput: (e) => {
            out.textContent = Number(e.target.value).toFixed(2);
            onChange({ [key]: Number(e.target.value) });
          },
        }),
      );
    };
    const toggle = (label, checked, change) => el("label", { class: "toggle" }, el("input", { type: "checkbox", checked, onchange: (e) => change(e.target.checked) }), label);
    const canSpeak = groups.length > 0 && !mouth.refused;

    // Model picker (server brain only)
    const modelSection = [];
    if (brain?.models?.length) {
      const current = brain.chosenModel || brain.model;
      const modelSelect = el(
        "select",
        { id: "model-select", onchange: (e) => onModel(e.target.value) },
        brain.models.map((m) =>
          el("option", { value: m.id, selected: m.id === current, text: `${m.name}  —  ${m.detail}` }),
        ),
      );
      modelSection.push(
        el("div", { class: "panel-label", text: "Model" }),
        el("div", { class: "field" }, el("label", { for: "model-select" }, "Claude model"), modelSelect),
      );
    }

    this.#open("voice", "VOICE", $("chip-voice"), [
      ...modelSection,

      el("div", { class: "panel-label", text: "Her voice" }),
      canSpeak && el("div", { class: "field" }, el("label", { for: "voice-select" }, "Voice", el("span", { text: `${ids.length} to choose from` })), select),
      el("p", { class: "panel-now" }, el("b", { text: canSpeak ? "NOW " : "" }), mouth.describe()),
      canSpeak && how.engine !== "studio" && how.engine !== "none" && slider("Rate", "rate", 0.7, 1.4),
      canSpeak && how.engine === "device" && slider("Pitch", "pitch", 0.6, 1.4),
      canSpeak && toggle("Captions only, no sound", mouth.settings.captionsOnly, (captionsOnly) => onChange({ captionsOnly })),
      canSpeak && el("button", { class: "chip", type: "button", text: "Test voice", onclick: onTest }),

      el("div", { class: "panel-label", text: "Your voice" }),
      listen === "wake" && toggle('Wake on "Hey Bells"', prefs.wake, (wake) => onChange({ wake })),
      listen === "wake" && toggle("Keep listening for a reply after she speaks", prefs.followUp, (followUp) => onChange({ followUp })),
      listen === "none" && toggle("Send what I dictate when I pause", prefs.autoSend, (autoSend) => onChange({ autoSend })),
      el("p", { class: "panel-note", text: listenNote }),
    ]);
  }
}

/* ----------------------------------------------------- captions and status */

export class Readout {
  constructor() {
    this.caption = $("caption");
    this.heard = $("heard");
    this.status = $("status-text");
    this.fill = $("meter-fill");
    this.peak = $("meter-peak");
    this.lvl = $("meter-lvl");
    this.pk = $("meter-pk");
    this.lastMeter = 0;
  }

  say(text) {
    this.caption.textContent = text;
    this.caption.classList.add("is-on");
    clearTimeout(this.captionTimer);
  }

  hush(after = 1600) {
    clearTimeout(this.captionTimer);
    this.captionTimer = setTimeout(() => this.caption.classList.remove("is-on"), after);
  }

  hear(text, { final = false } = {}) {
    this.heard.textContent = text;
    this.heard.classList.toggle("is-on", Boolean(text));
    clearTimeout(this.heardTimer);
    if (text) this.heardTimer = setTimeout(() => this.heard.classList.remove("is-on"), final ? 5000 : 2500);
  }

  setStatus(text) {
    if (this.status.textContent !== text) this.status.textContent = text;
  }

  meter(meter) {
    const dB = (v) => (Number.isFinite(v) ? Math.max(-99.9, v).toFixed(1) : "--.-");
    this.fill.style.transform = `scaleX(${meter.level.toFixed(3)})`;
    const peakLevel = Number.isFinite(meter.peak) ? Math.max(0, Math.min(1, (meter.peak + 58) / 46)) : 0;
    this.peak.style.left = `${(peakLevel * 100).toFixed(1)}%`;
    // The numbers are for reading, so they change a few times a second, not sixty.
    const now = performance.now();
    if (now - this.lastMeter < 180) return;
    this.lastMeter = now;
    this.lvl.textContent = meter.active ? dB(meter.db) : "--.-";
    this.pk.textContent = meter.active ? dB(meter.peak) : "--.-";
  }
}
