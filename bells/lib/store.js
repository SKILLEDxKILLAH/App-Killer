import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

const dir = path.join(config.dataDir, "reports");
const reports = new Map();

function load() {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const report = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      if (!report?.id) continue;
      // A job that was running when the server stopped is not coming back.
      if (report.status === "running") {
        report.status = "failed";
        report.error = "Interrupted when the server stopped.";
        report.phase = "INTERRUPTED";
        report.announced = true;
      }
      reports.set(report.id, report);
    } catch (err) {
      console.warn(`[bells] skipping unreadable report ${name}: ${err.message}`);
    }
  }
}
load();

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

export function saveReport(report) {
  reports.set(report.id, report);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${report.id}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(report, null, 2));
  fs.renameSync(`${file}.tmp`, file);
  return report;
}

export function getReport(id) {
  return reports.get(id) ?? null;
}

/** Newest first. */
export function listReports() {
  return [...reports.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function latestReport(status = "done") {
  return listReports().find((r) => r.status === status) ?? null;
}

/** The short form used in listings and progress events. */
export function summarize(report) {
  return {
    id: report.id,
    topic: report.topic,
    headline: report.headline || "",
    status: report.status,
    phase: report.phase,
    blocks: report.blocks.length,
    sources: report.sources.length,
    createdAt: report.createdAt,
    finishedAt: report.finishedAt ?? null,
    announced: Boolean(report.announced),
    error: report.error ?? null,
    demo: Boolean(report.demo),
  };
}
