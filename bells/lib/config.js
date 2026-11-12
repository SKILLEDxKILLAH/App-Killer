import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Optional .env next to package.json. Real environment variables win.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn(`[bells] could not read .env: ${err.message}`);
  }
}

const env = process.env;

function flag(name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  return !/^(0|off|false|no)$/i.test(raw.trim());
}

function int(name, fallback) {
  const n = Number.parseInt(env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** True when the Anthropic SDK has something to authenticate with. */
function hasAnthropicCredentials() {
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) return true;
  // `ant auth login` stores a profile the SDK picks up by itself.
  return fs.existsSync(path.join(os.homedir(), ".config", "anthropic"));
}

export const config = {
  host: env.HOST || "127.0.0.1",
  port: int("PORT", 4317),

  /** What Bells calls you. */
  owner: (env.BELLS_OWNER || "boss").trim(),

  model: env.BELLS_MODEL || "claude-opus-5-5",
  researchModel: env.BELLS_RESEARCH_MODEL || env.BELLS_MODEL || "claude-opus-5-5",
  chatEffort: env.BELLS_EFFORT || "low",
  researchEffort: env.BELLS_RESEARCH_EFFORT || "high",

  /** Let Bells run a quick web search inside a normal reply. */
  quickSearch: flag("BELLS_QUICK_SEARCH", true),
  /** Server-side refusal fallbacks (beta). Turn off if a gateway rejects the field. */
  fallbacks: flag("BELLS_FALLBACKS", true),

  maxResearchJobs: int("BELLS_MAX_JOBS", 3),
  researchMinutes: int("BELLS_RESEARCH_MINUTES", 15),

  hasBrain: hasAnthropicCredentials(),

  elevenLabsKey: env.ELEVENLABS_API_KEY || "",
  elevenLabsVoice: env.ELEVENLABS_VOICE_ID || "",
  elevenLabsModel: env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
  elevenLabsBase: (env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, ""),

  dataDir: path.resolve(ROOT, env.BELLS_DATA_DIR || "data"),
  publicDir: path.join(ROOT, "public"),
};

// A key is enough: the voice can be chosen in the HUD. ELEVENLABS_VOICE_ID only sets the default.
config.hasServerVoice = Boolean(config.elevenLabsKey);
