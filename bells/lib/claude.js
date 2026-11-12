import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "node:events";
import { config } from "./config.js";

let shared;

/** One client for the process. Credentials come from the environment. */
export function claude() {
  shared ??= new Anthropic();
  return shared;
}

/**
 * Server-side refusal fallbacks: if a safety classifier declines a request,
 * the API re-runs it on the model Anthropic recommends for that category
 * instead of leaving Bells with nothing to say.
 */
export function fallbackParams() {
  return config.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
}

/** Turns an SDK error into something Bells can say out loud. */
export function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return "My API key is being rejected. Check ANTHROPIC_API_KEY and restart me.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "That key isn't allowed to use this model. Check the account, or set BELLS_MODEL to one it can use.";
  }
  if (err instanceof Anthropic.NotFoundError) {
    return `The API doesn't know the model ${config.model}. Set BELLS_MODEL to one your account has.`;
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "I'm being rate limited. Give it a minute and ask again.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return "The API refused that request as malformed. The details are in the server log.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "I can't reach the API. Check the network connection.";
  }
  if (err instanceof Anthropic.APIError) {
    return `The API returned an error, status ${err.status ?? "unknown"}. Try again in a moment.`;
  }
  return "Something broke on my side. The details are in the server log.";
}

/** Process-wide event bus: research progress fans out to every open HUD. */
export const hub = new EventEmitter();
hub.setMaxListeners(100);
