// Optional studio voices from ElevenLabs. The key stays on the server: the
// HUD asks this module for the list of voices and for one sentence of audio
// at a time.

import { config } from "./config.js";

const LIST_TTL = 10 * 60_000;
const VOICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
let listed = { at: 0, voices: [] };

function upstream(path, init = {}) {
  return fetch(`${config.elevenLabsBase}${path}`, {
    ...init,
    headers: { "xi-api-key": config.elevenLabsKey, ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
}

/** The account's voices, the configured default first. Empty when no key is set. */
export async function studioVoices() {
  if (!config.elevenLabsKey) return [];
  if (listed.voices.length && Date.now() - listed.at < LIST_TTL) return listed.voices;

  const res = await upstream("/v2/voices?page_size=100&include_total_count=false");
  if (!res.ok) throw Object.assign(new Error(`Voice service returned ${res.status} for the voice list.`), { upstream: res.status });
  const body = await res.json();
  const voices = (Array.isArray(body?.voices) ? body.voices : [])
    .filter((v) => VOICE_ID.test(String(v?.voice_id ?? "")) && v.name)
    .map((v) => ({
      id: v.voice_id,
      name: String(v.name).slice(0, 80),
      // "British, female, middle aged" reads better in a picker than a category.
      detail: [v.labels?.accent, v.labels?.gender, v.labels?.age]
        .filter((part) => typeof part === "string" && part)
        .join(", ")
        .replace(/_/g, " ")
        .slice(0, 80),
    }))
    .sort((a, b) => Number(b.id === config.elevenLabsVoice) - Number(a.id === config.elevenLabsVoice) || a.name.localeCompare(b.name));
  listed = { at: Date.now(), voices };
  return voices;
}

async function defaultVoice() {
  if (VOICE_ID.test(config.elevenLabsVoice)) return config.elevenLabsVoice;
  return (await studioVoices())[0]?.id ?? null;
}

/** One line of speech as MP3 bytes, in the asked-for voice or the default. */
export async function synthesize(text, wanted) {
  const voice = VOICE_ID.test(String(wanted ?? "")) ? wanted : await defaultVoice();
  if (!voice) throw Object.assign(new Error("No studio voice is available on this account."), { upstream: 404 });
  const res = await upstream(`/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: config.elevenLabsModel }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw Object.assign(new Error(`Voice service returned ${res.status}: ${detail}`), { upstream: res.status });
  }
  return Buffer.from(await res.arrayBuffer());
}
