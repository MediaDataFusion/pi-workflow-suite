/**
 * Persistent worker registry for sub-agent processes.
 *
 * Extracted from runner.ts (pass 6, 2026-11-18) so lifecycle controls have a
 * dependency-free, testable core. Owner rulings driving this module:
 *  - background workers must be killable at any moment (/bg kill) and must
 *    die the moment the consuming work ends (completion kills, in-session
 *    sweeps); the per-worker timeout clock is only a wedged-worker backstop;
 *  - the registry must never lie: untrack removes entries from the exact
 *    file they were tracked in (the old single last-writer-wins dir variable
 *    left ghost pids in two project registries live 2026-11-18 — pids
 *    56909/58197/58200 + 58198/58201 outlived every worker by an hour).
 */

import * as fs from "node:fs";
import * as path from "node:path";

export type SubagentWorkerKind = "bg" | "fg";

export interface SubagentWorkerRegistryEntry {
  pid: number;
  startedAt: number;
  kind: SubagentWorkerKind;
}

// Backstop sweep age: hard-timeout ceiling (20 min default) plus grace. Callers
// that know the configured timeout pass a derived maxAgeMs instead.
export const SUBAGENT_WORKER_SWEEP_AGE_MS = 25 * 60_000;

// In-memory truth: every tracked pid remembers the exact registry dir it was
// recorded in and whether it is a background worker. Untrack always resolves
// through this map (with a scan of every known dir as restart fallback), so
// overlapping workers with different cwds can never orphan each other's
// entries again.
const trackedWorkers = new Map<number, { dir?: string; kind: SubagentWorkerKind }>();
const trackedDirs = new Set<string>();

export function subagentWorkerRegistryPath(dir: string): string {
  return path.join(dir, ".pi", "workflow-suite-bg-workers.json");
}

function readSubagentWorkerRegistry(dir: string): SubagentWorkerRegistryEntry[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(subagentWorkerRegistryPath(dir), "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SubagentWorkerRegistryEntry =>
      typeof entry === "object" && entry !== null && typeof (entry as { pid?: unknown }).pid === "number" && typeof (entry as { startedAt?: unknown }).startedAt === "number");
  } catch {
    return [];
  }
}

function writeSubagentWorkerRegistry(dir: string, entries: SubagentWorkerRegistryEntry[]): void {
  try {
    fs.mkdirSync(path.join(dir, ".pi"), { recursive: true });
    fs.writeFileSync(subagentWorkerRegistryPath(dir), JSON.stringify(entries));
  } catch {
    // Registry persistence is best-effort; in-memory tracking still applies.
  }
}

// Group-kill one worker: workers spawn detached (process-group leader), so
// kill(-pid) reaches grandchildren started with nohup … &.
function killWorkerGroup(pid: number): void {
  try { process.kill(-pid, "SIGTERM"); } catch { try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ } }
  setTimeout(() => {
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch { /* exited */ }
    if (alive) { try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch { /* exited */ } } }
  }, 5000);
}

export function sweepStaleSubagentWorkers(dir: string, maxAgeMs: number = SUBAGENT_WORKER_SWEEP_AGE_MS): void {
  const entries = readSubagentWorkerRegistry(dir);
  if (!entries.length) return;
  const now = Date.now();
  const remaining: SubagentWorkerRegistryEntry[] = [];
  for (const entry of entries) {
    if (now - entry.startedAt <= maxAgeMs) {
      remaining.push(entry);
      continue;
    }
    killWorkerGroup(entry.pid);
    trackedWorkers.delete(entry.pid);
  }
  // Only rewrite when something actually changed; no-op writes made ghost
  // files look freshly maintained (live 2026-11-18: registry mtime 20:07 on
  // entries from 18:55).
  if (remaining.length !== entries.length) writeSubagentWorkerRegistry(dir, remaining);
}

export function trackedOrphanPids(): ReadonlySet<number> {
  return new Set(trackedWorkers.keys());
}

export function trackSubagentPid(pid: number, cwd?: string, kind: SubagentWorkerKind = "fg"): void {
  trackedWorkers.set(pid, { dir: cwd, kind });
  if (!cwd) return;
  trackedDirs.add(cwd);
  const entries = readSubagentWorkerRegistry(cwd).filter((entry) => entry.pid !== pid);
  entries.push({ pid, startedAt: Date.now(), kind });
  writeSubagentWorkerRegistry(cwd, entries);
}

export function untrackSubagentPid(pid: number): void {
  const record = trackedWorkers.get(pid);
  trackedWorkers.delete(pid);
  const dirs = record?.dir ? [record.dir] : [...trackedDirs];
  for (const dir of dirs) {
    const entries = readSubagentWorkerRegistry(dir);
    if (!entries.some((entry) => entry.pid === pid)) continue;
    writeSubagentWorkerRegistry(dir, entries.filter((entry) => entry.pid !== pid));
    return;
  }
}

// /bg status: live snapshot of background workers for the given project dir
// plus any in-memory bg workers spawned under another dir this process owns.
export function backgroundWorkerSnapshot(dir: string): Array<{ pid: number; ageMs: number; kind: SubagentWorkerKind }> {
  const now = Date.now();
  const snapshot = new Map<number, { pid: number; ageMs: number; kind: SubagentWorkerKind }>();
  for (const entry of readSubagentWorkerRegistry(dir)) {
    if (entry.kind === "bg") snapshot.set(entry.pid, { pid: entry.pid, ageMs: now - entry.startedAt, kind: "bg" });
  }
  for (const [pid, record] of trackedWorkers) {
    if (record.kind === "bg" && !snapshot.has(pid)) snapshot.set(pid, { pid, ageMs: -1, kind: "bg" });
  }
  return [...snapshot.values()];
}

// /bg kill + completion kills: group-kill every background worker (registry
// entries marked kind:"bg" in the project dir plus any in-memory bg workers
// regardless of dir). Foreground workers are never touched. Returns the pids
// it acted on so callers can report and flip rows.
export function killBackgroundSubagentWorkers(dir: string): number[] {
  const killed: number[] = [];
  const registryEntries = readSubagentWorkerRegistry(dir);
  const survivors: SubagentWorkerRegistryEntry[] = [];
  for (const entry of registryEntries) {
    if (entry.kind !== "bg") {
      survivors.push(entry);
      continue;
    }
    killWorkerGroup(entry.pid);
    killed.push(entry.pid);
  }
  if (killed.length) writeSubagentWorkerRegistry(dir, survivors);
  for (const [pid, record] of trackedWorkers) {
    if (record.kind !== "bg" || killed.includes(pid)) continue;
    killWorkerGroup(pid);
    killed.push(pid);
    if (record.dir && record.dir !== dir) {
      const otherEntries = readSubagentWorkerRegistry(record.dir).filter((entry) => entry.pid !== pid);
      writeSubagentWorkerRegistry(record.dir, otherEntries);
    }
    trackedWorkers.delete(pid);
  }
  return killed;
}

export function cleanupOrphanProcesses(cwd?: string): void {
  for (const [pid] of trackedWorkers) {
    try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
  }
  trackedWorkers.clear();
  const sweepDirs = new Set<string>(trackedDirs);
  if (cwd) sweepDirs.add(cwd);
  for (const dir of sweepDirs) sweepStaleSubagentWorkers(dir);
}

// Clean up on parent exit (unexpected death)
if (typeof process.on === "function") {
  process.on("exit", () => {
    for (const [pid] of trackedWorkers) { try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ } }
    for (const dir of trackedDirs) sweepStaleSubagentWorkers(dir);
  });
}
