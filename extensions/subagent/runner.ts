/**
 * Shared Workflow Suite sub-agent runner.
 *
 * Used by the subagent tool and by workflow modes that must satisfy forced
 * sub-agent policy before the main planner/executor/reviewer/validator turn.
 */

import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { Message } from "@earendil-works/pi-ai";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { loadWorkflowSettings } from "../workflow-model-router.js";
import { type AgentConfig, type AgentScope, type AgentSource, discoverAgents } from "./agents.js";

export interface WorkflowSubagentTask {
  agent: string;
  task: string;
  cwd?: string;
  schema?: Record<string, unknown>;
  background?: boolean;
  model?: string;
  skills?: string;
  output?: string;
  workflowPhase?: string;
}

export interface WorkflowSubagentUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export interface WorkflowSubagentResult {
  agent: string;
  agentSource: AgentSource | "unknown";
  agentTools?: string[];
  task: string;
  exitCode: number;
  output: string;
  stderr: string;
  usage: WorkflowSubagentUsage;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  parsedOutput?: unknown;
}

export interface WorkflowSubagentRunResult {
  agentScope: AgentScope;
  projectAgentsDir: string | null;
  results: WorkflowSubagentResult[];
}

export interface WorkflowSubagentRunOptions {
  cwd: string;
  tasks: WorkflowSubagentTask[];
  agentScope?: AgentScope;
  timeoutMinutes?: number;
  staleMinutes?: number;
  signal?: AbortSignal;
  onUpdate?: (results: WorkflowSubagentResult[]) => void;
  concurrency?: number;
  failFast?: boolean;
  background?: boolean;
}

const DEFAULT_CONCURRENCY = 8;

// ── Orphan process tracking (#8) ──────────────────────────────
const trackedPids = new Set<number>();

export function trackedOrphanPids(): ReadonlySet<number> {
  return trackedPids;
}

export function trackSubagentPid(pid: number): void {
  trackedPids.add(pid);
}

export function untrackSubagentPid(pid: number): void {
  trackedPids.delete(pid);
}

export function cleanupOrphanProcesses(): void {
  for (const pid of trackedPids) {
    try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
  }
  trackedPids.clear();
}

// Clean up on parent exit (unexpected death)
if (typeof process.on === "function") {
  process.on("exit", () => { for (const pid of trackedPids) { try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ } } });
}

// ── Result caching (#6) ─────────────────────────────────────
const resultCache = new Map<string, WorkflowSubagentResult>();

function cacheKey(agent: string, task: string, cwd: string): string {
  return crypto.createHash("sha256").update(`${agent}\n${task}\n${cwd}`).digest("hex");
}

export function clearSubagentResultCache(): void {
  resultCache.clear();
}
const REPOLOCK_GUARD_EXTENSION = path.join(path.dirname(new URL(import.meta.url).pathname), "repolock-guard.ts");

function safeRealpath(candidate: string): string {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return candidate;
  }
}

function pathInsideRoot(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function resolveSubagentCwd(candidate: string | undefined, defaultCwd: string): string {
  return safeRealpath(path.resolve(defaultCwd, candidate || "."));
}

function repoRootForCwd(cwd: string): string {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return safeRealpath(root || cwd);
  } catch {
    return safeRealpath(cwd);
  }
}

function repoLockRootForSubagent(defaultCwd: string): string | undefined {
  if (process.env.PI_WORKFLOW_REPO_LOCK_ENABLED === "1" && process.env.PI_WORKFLOW_REPO_LOCK_ROOT) return safeRealpath(process.env.PI_WORKFLOW_REPO_LOCK_ROOT);
  return loadWorkflowSettings(defaultCwd).safety.repoLockEnabled === true ? repoRootForCwd(defaultCwd) : undefined;
}

function finalOutput(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.content) {
      if (part.type === "text") return part.text;
    }
  }
  return "";
}

async function mapWithConcurrencyLimit<TIn, TOut>(items: TIn[], concurrency: number, fn: (item: TIn, index: number) => Promise<TOut>, failFast = false): Promise<TOut[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: TOut[] = new Array(items.length);
  let nextIndex = 0;
  let firstError: Error | undefined;
  const workers = new Array(limit).fill(null).map(async () => {
    while (true) {
      if (failFast && firstError) return;
      const current = nextIndex++;
      if (current >= items.length) return;
      try {
        results[current] = await fn(items[current], current);
      } catch (err) {
        if (failFast) {
          firstError = err instanceof Error ? err : new Error(String(err));
          return;
        }
        throw err;
      }
    }
  });
  await Promise.all(workers);
  if (failFast && firstError) throw firstError;
  return results;
}

async function writePromptToTempFile(agentName: string, prompt: string): Promise<{ dir: string; filePath: string }> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
  const safeName = agentName.replace(/[^\w.-]+/g, "_");
  const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
  await withFileMutationQueue(filePath, async () => {
    await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  });
  return { dir: tmpDir, filePath };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) return { command: process.execPath, args };
  return { command: "pi", args };
}

async function runSingleWorkflowSubagent(
  defaultCwd: string,
  agents: AgentConfig[],
  task: WorkflowSubagentTask,
  signal: AbortSignal | undefined,
  limits: { timeoutMinutes?: number; staleMinutes?: number },
): Promise<WorkflowSubagentResult> {
  const agent = agents.find((a) => a.name === task.agent);
  if (!agent) {
    const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
    return {
      agent: task.agent,
      agentSource: "unknown",
      task: task.task,
      exitCode: 1,
      output: "",
      stderr: `Unknown agent: "${task.agent}". Available agents: ${available}.`,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
    };
  }

  const lockRoot = repoLockRootForSubagent(defaultCwd);
  const effectiveCwd = resolveSubagentCwd(task.cwd, defaultCwd);

  // ── Result caching (#6): check cache before spawning ──
  const key = cacheKey(agent.name, task.task, effectiveCwd);
  const cached = signal?.aborted ? undefined : resultCache.get(key);
  if (cached) return { ...cached, output: `${cached.output}\n\n[cached]` };

  if (lockRoot && !pathInsideRoot(effectiveCwd, lockRoot)) {
    return {
      agent: task.agent,
      agentSource: agent.source,
      agentTools: agent.tools,
      task: task.task,
      exitCode: 1,
      output: "",
      stderr: `Repo Lock blocked sub-agent cwd outside current repository: ${effectiveCwd} (repo root: ${lockRoot})`,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
    };
  }

  const args: string[] = ["--no-extensions", "--extension", REPOLOCK_GUARD_EXTENSION, "--mode", "json", "-p", "--no-session"];
  if (agent.model) args.push("--model", agent.model);
  if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

  let tmpPromptDir: string | null = null;
  let tmpPromptPath: string | null = null;
  const messages: Message[] = [];
  const usage: WorkflowSubagentUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
  let stderr = "";
  let model = task.model || agent.model;
  let stopReason: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (agent.systemPrompt.trim()) {
      const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
      tmpPromptDir = tmp.dir;
      tmpPromptPath = tmp.filePath;
      args.push("--append-system-prompt", tmpPromptPath);
    }
    // ── Structured output (#5): inject schema if present ──
    const schemaInstruction = task.schema
      ? `\n\nReturn your final result as a single valid JSON object matching this schema:\n${JSON.stringify(task.schema, null, 2)}\n\nWrap ONLY the JSON object in a \`\`\`json code block at the end of your response.`
      : "";
    args.push(`Task: ${task.task}${schemaInstruction}`);

    let wasAborted = false;
    let timeoutReason = "";
    const timeoutMs = Math.max(1, Math.min(240, Number(limits.timeoutMinutes ?? 20))) * 60_000;
    const staleMs = Math.max(1, Math.min(240, Number(limits.staleMinutes ?? 8))) * 60_000;

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd: effectiveCwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PI_SUBAGENT_WORKER: "1",
          PI_SUBAGENT_NAME: agent.name,
          ...(task.workflowPhase ? { PI_WORKFLOW_SUBAGENT_PHASE: task.workflowPhase } : {}),
          ...(lockRoot ? { PI_WORKFLOW_REPO_LOCK_ENABLED: "1", PI_WORKFLOW_REPO_LOCK_ROOT: lockRoot } : {}),
          ...(task.skills ? { PI_SUBAGENT_SKILLS: task.skills } : {}),
          ...(task.output ? { PI_SUBAGENT_OUTPUT: task.output } : {}),
        },
      });
      trackedPids.add(proc.pid!);
      let buffer = "";
      let lastOutputAt = Date.now();
      let settled = false;

      const stopProcess = (reason: string) => {
        if (settled) return;
        timeoutReason = reason;
        wasAborted = true;
        errorMessage = reason;
        try { process.kill(-proc.pid!, "SIGTERM"); } catch { proc.kill("SIGTERM"); }
        setTimeout(() => { if (!proc.killed) { try { process.kill(-proc.pid!, "SIGKILL"); } catch { proc.kill("SIGKILL"); } } }, 5000);
      };
      const timeoutTimer = setTimeout(() => stopProcess(`Sub-agent timed out after ${Math.round(timeoutMs / 60000)} minute(s).`), timeoutMs);
      const staleTimer = setInterval(() => {
        if (Date.now() - lastOutputAt >= staleMs) stopProcess(`Sub-agent stale watchdog stopped worker after ${Math.round(staleMs / 60000)} minute(s) without parsed progress.`);
      }, Math.min(staleMs, 60_000));

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try { event = JSON.parse(line); } catch { return; }
        if (event.type === "message_end" && event.message) {
          lastOutputAt = Date.now();
          const msg = event.message as Message;
          messages.push(msg);
          if (msg.role === "assistant") {
            usage.turns++;
            const msgUsage = msg.usage;
            if (msgUsage) {
              usage.input += msgUsage.input || 0;
              usage.output += msgUsage.output || 0;
              usage.cacheRead += msgUsage.cacheRead || 0;
              usage.cacheWrite += msgUsage.cacheWrite || 0;
              usage.cost += msgUsage.cost?.total || 0;
              usage.contextTokens = msgUsage.totalTokens || 0;
            }
            if (!model && msg.model) model = msg.model;
            if (msg.stopReason) stopReason = msg.stopReason;
            if (msg.errorMessage) errorMessage = msg.errorMessage;
          }
        }
        if (event.type === "tool_result_end" && event.message) {
          lastOutputAt = Date.now();
          messages.push(event.message as Message);
        }
      };

      proc.stdout.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });
      proc.on("close", (code) => {
        settled = true;
        trackedPids.delete(proc.pid!);
        clearTimeout(timeoutTimer);
        clearInterval(staleTimer);
        if (buffer.trim()) processLine(buffer);
        // Kill process group to clean up background child processes
        // (dev servers, static servers, tools — any program the sub-agent started).
        // process.kill(-pid) signals the entire process group; works on all Unix.
        try { if (proc.pid) process.kill(-proc.pid, "SIGTERM"); } catch { /* group empty */ }
        resolve(code ?? 0);
      });
      proc.on("error", () => {
        settled = true;
        trackedPids.delete(proc.pid!);
        clearTimeout(timeoutTimer);
        clearInterval(staleTimer);
        resolve(1);
      });
      if (signal) {
        const killProc = () => stopProcess("Subagent was aborted");
        if (signal.aborted) killProc();
        else signal.addEventListener("abort", killProc, { once: true });
      }
    });

    const rawOutput = finalOutput(messages);
    // ── Structured output (#5): try JSON parse against schema ──
    let parsedOutput: unknown;
    if (task.schema && rawOutput) {
      const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/);
      const candidate = jsonMatch ? jsonMatch[1].trim() : rawOutput.trim();
      try { parsedOutput = JSON.parse(candidate); } catch { /* free-form output, not JSON */ }
    }

    const result: WorkflowSubagentResult = {
      agent: agent.name,
      agentSource: agent.source,
      agentTools: agent.tools,
      task: task.task,
      exitCode: wasAborted ? 1 : exitCode,
      output: rawOutput,
      stderr,
      usage,
      model,
      stopReason: wasAborted ? "aborted" : stopReason,
      errorMessage: wasAborted ? (timeoutReason || "Subagent was aborted") : errorMessage,
      parsedOutput,
    };

    // ── Result caching (#6): store successful results ──
    if (!wasAborted && exitCode === 0 && !signal?.aborted) {
      resultCache.set(key, result);
    }

    // ── Retry-on-timeout (#3): retry once on timeout/stale ──
    if (wasAborted && timeoutReason && !signal?.aborted) {
      return result; // single attempt; retry is handled at the runWorkflowSubagents level
    }

    return result;
  } finally {
    if (tmpPromptPath) try { fs.unlinkSync(tmpPromptPath); } catch { /* ignore */ }
    if (tmpPromptDir) try { fs.rmdirSync(tmpPromptDir); } catch { /* ignore */ }
  }
}

export async function runWorkflowSubagents(options: WorkflowSubagentRunOptions): Promise<WorkflowSubagentRunResult> {
  const agentScope = options.agentScope ?? "user";
  const discovery = discoverAgents(options.cwd, agentScope);
  const running: WorkflowSubagentResult[] = options.tasks.map((task) => ({
    agent: task.agent,
    agentSource: "unknown",
    task: task.task,
    exitCode: -1,
    output: "",
    stderr: "",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
  }));
  options.onUpdate?.([...running]);

  const executeTask = async (task: WorkflowSubagentTask, index: number): Promise<WorkflowSubagentResult> => {
    const limits = { timeoutMinutes: options.timeoutMinutes, staleMinutes: options.staleMinutes };
    let result = await runSingleWorkflowSubagent(options.cwd, discovery.agents, task, options.signal, limits);
    // ── Retry-on-timeout (#3): retry once on timeout/stale ──
    if (result.exitCode !== 0 && result.stopReason === "aborted" && result.errorMessage?.includes("timed out") && !options.signal?.aborted) {
      const retryResult = await runSingleWorkflowSubagent(options.cwd, discovery.agents, task, options.signal, limits);
      retryResult.output = `[retry after timeout]\n${retryResult.output}`;
      result = retryResult;
    }
    running[index] = result;
    options.onUpdate?.([...running]);
    return result;
  };

  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  if (options.background) {
    // Fire-and-forget: start execution, don't await, deliver results via onUpdate
    mapWithConcurrencyLimit(options.tasks, concurrency, executeTask, options.failFast).then((results) => {
      // Results delivered via onUpdate during execution; final result available for next turn
    }).catch(() => {
      // Background failures are non-fatal; onUpdate already reported individual failures
    });
    return { agentScope, projectAgentsDir: discovery.projectAgentsDir, results: running };
  }

  const results = await mapWithConcurrencyLimit(options.tasks, concurrency, executeTask, options.failFast);
  return { agentScope, projectAgentsDir: discovery.projectAgentsDir, results };
}

export function workflowSubagentResultOutput(result: WorkflowSubagentResult): string {
  return result.output || result.errorMessage || result.stderr || "(no output)";
}
