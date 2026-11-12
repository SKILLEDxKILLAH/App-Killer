// Ears, mouth and a level meter, all on browser APIs.
//
//   Ears   SpeechRecognition, kept running so she can hear her name
//   Mouth  speechSynthesis by default; the server's voice when one is configured
//   Meter  microphone loudness for the status bar and the comb

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ------------------------------------------------------------------ meter */

export class MicMeter {
  constructor() {
    this.level = 0;
    this.db = -Infinity;
    this.peak = -Infinity;
    this.active = false;
  }

  async start() {
    if (this.active) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      return false;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.active = true;
    return true;
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.ctx?.close().catch(() => {});
    this.active = false;
    this.level = 0;
    this.db = -Infinity;
    this.peak = -Infinity;
  }

  /** Call once a frame. */
  read() {
    if (!this.active) return 0;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    const rms = Math.sqrt(sum / this.buffer.length);
    this.db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    this.peak = Math.max(this.db, (Number.isFinite(this.peak) ? this.peak : -90) - 0.25);
    // -58 dB is a quiet room, -12 dB is someone talking close to the mic.
    this.level = clamp01((this.db + 58) / 46);
    return this.level;
  }
}

/* ------------------------------------------------------------------- ears */

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export class Ears {
  static supported = Boolean(Recognition);

  /**
   * @param {object} on
   * @param {(text: string) => void} on.interim  words so far, still changing
   * @param {(text: string) => void} on.final    a finished utterance
   * @param {(reason: "blocked"|"no-mic"|"network") => void} on.trouble
   */
  constructor(on) {
    this.on = on;
    this.wanted = false;
    this.paused = false;
    this.running = false;
    this.failures = 0;
    this.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
  }

  start() {
    this.wanted = true;
    this.#open();
  }

  stop() {
    this.wanted = false;
    this.#close(false);
  }

  /** Stops hearing while she talks, so she doesn't answer herself. */
  pause() {
    this.paused = true;
    this.#close(true);
  }

  resume() {
    this.paused = false;
    if (this.wanted) this.#open();
  }

  /** Ends the current utterance now and delivers what was heard. */
  finish() {
    try {
      this.rec?.stop();
    } catch {
      /* not started */
    }
  }

  #open() {
    if (!Recognition || this.running || this.paused || !this.wanted) return;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      this.failures = 0;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          if (text.trim()) this.on.final(text.trim());
        } else interim += text;
      }
      if (interim.trim()) this.on.interim(interim.trim());
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.wanted = false;
        this.on.trouble("blocked");
      } else if (event.error === "audio-capture") {
        this.wanted = false;
        this.on.trouble("no-mic");
      } else if (event.error === "network") {
        this.failures++;
        if (this.failures === 3) this.on.trouble("network");
      }
      // "no-speech" and "aborted" are routine; onend restarts.
    };

    rec.onend = () => {
      this.running = false;
      if (this.rec === rec) this.rec = null;
      if (!this.wanted || this.paused) return;
      // Chrome ends a session after a stretch of silence; pick it straight back up.
      const delay = Math.min(8000, 250 * 2 ** this.failures);
      this.retry = setTimeout(() => this.#open(), delay);
    };

    try {
      rec.start();
      this.rec = rec;
      this.running = true;
    } catch {
      this.running = false;
    }
  }

  #close(abort) {
    clearTimeout(this.retry);
    const rec = this.rec;
    if (!rec) return;
    try {
      if (abort) rec.abort();
      else rec.stop();
    } catch {
      /* already stopped */
    }
  }
}

/* ------------------------------------------------------------------ mouth */

// Bells is written as a dry, low-ish woman's voice with a British accent.
// These are tried in order against whatever voices the browser offers.
const PREFERRED = [
  /Sonia.*Natural/i,
  /Libby.*Natural/i,
  /Maisie.*Natural/i,
  /Google UK English Female/i,
  /^Serena/i,
  /^Kate/i,
  /^Stephanie/i,
  /^Martha/i,
  /Microsoft Hazel/i,
  /Microsoft Susan/i,
  /Microsoft Sonia/i,
  /Microsoft Libby/i,
];
const MALE = /\b(male|daniel|george|ryan|thomas|oliver|arthur|david|mark|james|guy|aaron|fred|gordon|malcolm|rishi|alex|tom)\b/i;
const FEMALE_US = [/Aria.*Natural/i, /Jenny.*Natural/i, /Ava/i, /^Samantha/i, /Allison/i, /Google US English/i, /Microsoft Zira/i];

function rank(voice) {
  const name = voice.name;
  const preferred = PREFERRED.findIndex((p) => p.test(name));
  if (preferred >= 0) return preferred;
  const british = /^en[-_]GB/i.test(voice.lang);
  if (british && !MALE.test(name)) return 20;
  const american = FEMALE_US.findIndex((p) => p.test(name));
  if (american >= 0) return 30 + american;
  if (british) return 50;
  if (/^en/i.test(voice.lang) && !MALE.test(name)) return 60;
  if (/^en/i.test(voice.lang)) return 70;
  return 100;
}

/** Makes model text safe to hand to a speech engine. */
export function speakable(text) {
  return String(text)
    .replace(/https?:\/\/\S+/g, " a link ")
    .replace(/[*_`#>|~]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/≈\s*/g, "about ")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits long text into lines the platform voice accepts (2,000 characters each). */
function paragraphs(text) {
  const lines = [];
  let current = "";
  for (const sentence of text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]) {
    if (current && current.length + sentence.length > 1600) {
      lines.push({ text: current.trim() });
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) lines.push({ text: current.trim().slice(0, 2000) });
  return lines;
}

const CLAUDE_VOICES = ["buttery", "airy", "glassy", "rounded"];

/**
 * Bells' voice. Three kinds of voice can be on offer, depending on where the
 * page runs, and `settings.choice` picks among them:
 *
 *   "claude:<name>"   the Artifact viewer's voices, when the page is hosted there
 *   "studio:<id>"     ElevenLabs voices, when the local server has a key
 *   "device:<uri>"    the browser's own speech synthesis
 *   ""                automatic: the best of whatever is available
 */
export class Mouth {
  #waitedForVoices = false;

  constructor() {
    this.synth = window.speechSynthesis ?? null;
    this.settings = { choice: "", rate: 0.98, pitch: 0.9, captionsOnly: false };
    this.serverVoice = false; // the local server has studio voices
    this.tts = null; // the Artifact viewer's voice
    this.refused = false; // the viewer turned reading aloud off for this page
    this.platformDown = false; // the viewer's voice isn't available in this view
    this.studioFailures = 0;
    this.speaking = false;
    this.pulse = 0;
    this.boundaryAt = 0;
    this.startedAt = 0;
    this.prepared = new Map();
    /** Called when the set of usable voices changes. */
    this.onchange = null;
    this.synth?.addEventListener?.("voiceschanged", () => this.onchange?.());
  }

  /** English device voices, best match for Bells first. */
  voices() {
    const all = this.synth?.getVoices() ?? [];
    return all
      .filter((v) => /^en/i.test(v.lang))
      .map((voice) => ({ voice, score: rank(voice) }))
      .sort((a, b) => a.score - b.score || a.voice.name.localeCompare(b.voice.name))
      .map((entry) => entry.voice);
  }

  /** Hands speech to the Artifact viewer, which plays it in a Claude voice. */
  attach(tts) {
    this.tts = tts;
  }

  /** Which engine and voice will say the next line. */
  resolve() {
    // A viewer who switched reading aloud off gets silence, not another voice.
    if (this.settings.captionsOnly || this.refused) return { engine: "none" };
    const choice = String(this.settings.choice || "");
    const cut = choice.indexOf(":");
    const kind = cut > 0 ? choice.slice(0, cut) : "";
    const id = cut > 0 ? choice.slice(cut + 1) : "";
    const platform = Boolean(this.tts) && !this.platformDown;
    const studio = this.serverVoice && this.studioFailures < 2;
    const device = this.voices();

    if (kind === "claude" && platform) return { engine: "platform", voice: id };
    if (kind === "studio" && studio) return { engine: "studio", voice: id };
    if (kind === "device") {
      const voice = device.find((v) => v.voiceURI === id);
      if (voice) return { engine: "device", voice };
    }
    if (platform) return { engine: "platform", voice: "" };
    if (studio) return { engine: "studio", voice: "" };
    if (this.synth?.getVoices().length) return { engine: "device", voice: device[0] ?? null };
    return { engine: "none" };
  }

  /** The platform voice wants a paragraph per hand-over, not a sentence. */
  get paragraphs() {
    return this.resolve().engine === "platform";
  }

  /** Every voice on offer here, grouped by where it comes from. */
  async catalog() {
    const groups = [];
    if (this.tts && !this.refused && !this.platformDown) {
      this.claudeVoices ??= (await Promise.resolve(this.tts.voices?.()).catch(() => null)) ?? CLAUDE_VOICES;
      groups.push({
        label: "Claude voices",
        options: this.claudeVoices.map((name) => ({ id: `claude:${name}`, name: name[0].toUpperCase() + name.slice(1) })),
      });
    }
    if (this.serverVoice) {
      if (!this.studioVoices?.length) {
        this.studioVoices = await fetch("api/voices")
          .then((res) => (res.ok ? res.json() : null))
          .then((body) => body?.voices ?? [])
          .catch(() => []);
      }
      if (this.studioVoices.length) {
        groups.push({
          label: "Studio voices",
          options: this.studioVoices.map((v) => ({ id: `studio:${v.id}`, name: v.detail ? `${v.name} (${v.detail})` : v.name })),
        });
      }
    }
    const device = this.voices();
    if (device.length) {
      groups.push({ label: "This device", options: device.map((v) => ({ id: `device:${v.voiceURI}`, name: `${v.name} (${v.lang})` })) });
    }
    return groups;
  }

  /** What is speaking right now, in words, for the panel. */
  describe() {
    const how = this.resolve();
    if (how.engine === "platform") return how.voice ? `Claude voice, ${how.voice}` : "Claude voice";
    // Automatic means the service's default, which the list puts first.
    if (how.engine === "studio") return (this.studioVoices?.find((v) => v.id === how.voice) ?? this.studioVoices?.[0])?.name ?? "Studio voice";
    if (how.engine === "device") return how.voice ? how.voice.name : "This device's default voice";
    if (this.refused) return "Reading aloud is switched off for this page";
    if (this.settings.captionsOnly) return "Captions only";
    return "No voice is available in this view, so replies appear as captions";
  }

  /** Must be called from a click: browsers only allow speech after one. */
  unlock() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx && !this.audio) {
      this.audio = new Ctx();
      this.analyser = this.audio.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(this.audio.destination);
      this.samples = new Float32Array(this.analyser.fftSize);
    }
    this.audio?.resume?.().catch(() => {});
    if (this.synth) {
      this.synth.cancel();
      const hush = new SpeechSynthesisUtterance("");
      hush.volume = 0;
      this.synth.speak(hush);
    }
  }

  /** A short two-note chime: "I heard my name." */
  chime() {
    if (!this.audio) return;
    const now = this.audio.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = this.audio.createOscillator();
      const gain = this.audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.09 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.22);
      osc.connect(gain).connect(this.audio.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.25);
    });
  }

  /** Starts fetching studio audio for a line that is queued but not yet due. */
  prepare(raw) {
    const how = this.resolve();
    const text = speakable(raw);
    if (how.engine !== "studio" || !text || !this.audio) return null;
    const key = `${how.voice}|${text}`;
    if (!this.prepared.has(key)) {
      const audio = fetch("api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voice: how.voice }),
      })
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`voice ${res.status}`))))
        .then((bytes) => this.audio.decodeAudioData(bytes));
      audio.catch(() => {}); // handled where it is awaited
      this.prepared.set(key, audio);
      if (this.prepared.size > 12) this.prepared.delete(this.prepared.keys().next().value);
    }
    return key;
  }

  /** Speaks one line. Resolves when it has finished or been stopped. */
  async say(raw) {
    const text = speakable(raw);
    if (!text) return;
    this.speaking = true;
    this.startedAt = performance.now();
    this.boundaryAt = 0;
    try {
      const first = this.resolve();
      if (first.engine === "platform") return await this.#platform(text, null, first.voice);
      if (first.engine === "studio") {
        const key = this.prepare(text);
        try {
          await this.#play(await this.prepared.get(key));
          this.studioFailures = 0;
          return;
        } catch {
          // Fall through to a device voice for this line; after two misses in
          // a row the studio voice is dropped until it is chosen again.
          if (++this.studioFailures >= 2) this.onchange?.();
        } finally {
          this.prepared.delete(key);
        }
      }
      // Chrome hands over its voice list a moment after the page loads.
      await this.#voicesReady();
      const how = this.resolve();
      if (how.engine === "none" || !this.synth?.getVoices().length) await this.#mime(text);
      else await this.#utter(text, how.engine === "device" ? how.voice : this.voices()[0] ?? null);
    } finally {
      this.speaking = false;
    }
  }

  /**
   * Speaks several lines back to back. `onLine(i)` fires as line i starts;
   * `alive()` turning false ends it between lines.
   */
  async recite(lines, onLine, alive = () => true) {
    const texts = lines.map(speakable);
    const how = this.resolve();
    if (how.engine === "platform") {
      this.speaking = true;
      this.startedAt = performance.now();
      try {
        // One reading, so the platform can have each next line ready before it is due.
        await this.#platform(
          texts.map((text, i) => ({ text: text.slice(0, 2000), id: String(i) })),
          onLine,
          how.voice,
        );
      } finally {
        this.speaking = false;
      }
      return;
    }
    for (const [i, text] of texts.entries()) {
      if (!alive()) return;
      if (texts[i + 1]) this.prepare(texts[i + 1]);
      onLine(i);
      await this.say(text);
    }
  }

  stop() {
    this.cancelled?.();
    if (this.tts && this.speaking) Promise.resolve(this.tts.stop?.()).catch(() => {});
    this.synth?.cancel();
    try {
      this.playing?.stop();
    } catch {
      /* not playing */
    }
  }

  async #voicesReady() {
    if (!this.synth || this.#waitedForVoices || this.synth.getVoices().length) return;
    this.#waitedForVoices = true;
    await new Promise((resolve) => {
      const done = () => {
        this.synth.removeEventListener?.("voiceschanged", done);
        resolve();
      };
      this.synth.addEventListener?.("voiceschanged", done);
      setTimeout(done, 1200);
    });
  }

  async #platform(what, onLine, voice) {
    const lines = typeof what === "string" ? paragraphs(what) : what;
    const unsubscribe = onLine ? this.tts.onLine?.((event) => onLine(Number(event.id ?? event.line))) : null;
    const options = { rate: this.settings.rate };
    if (voice) options.voice = voice;
    try {
      await this.tts.speak(lines, options);
    } catch (err) {
      if (err?.code === "stopped") {
        // The viewer pressed the platform's own Stop: that ends the whole reply.
        if (err.reason === "viewer_stopped") this.onViewerStop?.();
        return;
      }
      if (err?.code === "not_granted") this.refused = true;
      if (err?.code === "unavailable") this.platformDown = true;
      if (this.refused || this.platformDown) this.onchange?.();
      // This reply still gets its time on screen as captions.
      for (const [i, line] of lines.entries()) {
        if (onLine) onLine(i);
        await this.#mime(line.text);
      }
    } finally {
      unsubscribe?.();
    }
  }

  #play(buffer) {
    return new Promise((resolve) => {
      const source = this.audio.createBufferSource();
      source.buffer = buffer;
      source.connect(this.analyser);
      source.onended = () => {
        if (this.playing === source) this.playing = null;
        resolve();
      };
      this.playing = source;
      source.start();
    });
  }

  #utter(text, voice) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      // With no English voice installed, the system default still speaks.
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-GB";
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        this.cancelled = null;
        resolve();
      };
      // Some engines never report the end of an utterance; don't hang on them.
      const watchdog = setTimeout(done, 3500 + (text.length * 95) / Math.max(0.5, this.settings.rate));
      utterance.onboundary = () => {
        this.boundaryAt = performance.now();
        this.pulse = 1;
      };
      utterance.onend = done;
      utterance.onerror = done;
      this.cancelled = done;
      this.synth.speak(utterance);
    });
  }

  /** No voice available: hold the caption for as long as the line would take to say. */
  #mime(text) {
    return new Promise((resolve) => {
      const words = text.split(/\s+/).length;
      const timer = setTimeout(done, Math.max(700, (words / 2.9) * 1000));
      const self = this;
      function done() {
        clearTimeout(timer);
        self.cancelled = null;
        resolve();
      }
      this.cancelled = done;
    });
  }

  /** Loudness of her voice right now, 0 to 1, for the comb. */
  get level() {
    if (!this.speaking) return 0;
    if (this.playing) {
      this.analyser.getFloatTimeDomainData(this.samples);
      let sum = 0;
      for (let i = 0; i < this.samples.length; i++) sum += this.samples[i] * this.samples[i];
      return clamp01(Math.sqrt(sum / this.samples.length) * 4.2);
    }
    const now = performance.now();
    // Engines that report word boundaries drive a pulse per word...
    if (now - this.boundaryAt < 600) {
      this.pulse = Math.max(0.25, this.pulse * 0.9);
      return this.pulse;
    }
    // ...the rest get a speech-like rhythm of syllables and short pauses.
    const t = (now - this.startedAt) / 1000;
    const syllable = Math.abs(Math.sin(t * 13.5));
    const phrase = 0.55 + 0.45 * Math.sin(t * 2.7 + 1.2);
    return clamp01(0.2 + 0.8 * syllable * phrase);
  }
}
