/**
 * Shared Workflow Suite sub-agent runner.
 *
 * Used by the subagent tool and by workflow modes that must satisfy forced
 * sub-agent policy before the main planner/executor/reviewer/validator turn.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Message } from "@earendil-works/pi-ai";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { type AgentConfig, type AgentScope, type AgentSource, discoverAgents } from "./agents.js";

export interface WorkflowSubagentTask {
  agent: string;
  task: string;
  cwd?: string;
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
}

const MAX_CONCURRENCY = 4;

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

async function mapWithConcurrencyLimit<TIn, TOut>(items: TIn[], concurrency: number, fn: (item: TIn, index: number) => Promise<TOut>): Promise<TOut[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: TOut[] = new Array(items.length);
  let nextIndex = 0;
  const workers = new Array(limit).fill(null).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
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

  const args: string[] = ["--no-extensions", "--mode", "json", "-p", "--no-session"];
  if (agent.model) args.push("--model", agent.model);
  if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

  let tmpPromptDir: string | null = null;
  let tmpPromptPath: string | null = null;
  const messages: Message[] = [];
  const usage: WorkflowSubagentUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
  let stderr = "";
  let model = agent.model;
  let stopReason: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (agent.systemPrompt.trim()) {
      const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
      tmpPromptDir = tmp.dir;
      tmpPromptPath = tmp.filePath;
      args.push("--append-system-prompt", tmpPromptPath);
    }
    args.push(`Task: ${task.task}`);

    let wasAborted = false;
    let timeoutReason = "";
    const timeoutMs = Math.max(1, Math.min(240, Number(limits.timeoutMinutes ?? 20))) * 60_000;
    const staleMs = Math.max(1, Math.min(240, Number(limits.staleMinutes ?? 8))) * 60_000;

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd: task.cwd ?? defaultCwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PI_SUBAGENT_WORKER: "1",
          PI_SUBAGENT_NAME: agent.name,
        },
      });
      let buffer = "";
      let lastOutputAt = Date.now();
      let settled = false;

      const stopProcess = (reason: string) => {
        if (settled) return;
        timeoutReason = reason;
        wasAborted = true;
        errorMessage = reason;
        proc.kill("SIGTERM");
        setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
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
        clearTimeout(timeoutTimer);
        clearInterval(staleTimer);
        if (buffer.trim()) processLine(buffer);
        resolve(code ?? 0);
      });
      proc.on("error", () => {
        settled = true;
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

    return {
      agent: agent.name,
      agentSource: agent.source,
      agentTools: agent.tools,
      task: task.task,
      exitCode: wasAborted ? 1 : exitCode,
      output: finalOutput(messages),
      stderr,
      usage,
      model,
      stopReason: wasAborted ? "aborted" : stopReason,
      errorMessage: wasAborted ? (timeoutReason || "Subagent was aborted") : errorMessage,
    };
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
  const results = await mapWithConcurrencyLimit(options.tasks, MAX_CONCURRENCY, async (task, index) => {
    const result = await runSingleWorkflowSubagent(options.cwd, discovery.agents, task, options.signal, { timeoutMinutes: options.timeoutMinutes, staleMinutes: options.staleMinutes });
    running[index] = result;
    options.onUpdate?.([...running]);
    return result;
  });
  return { agentScope, projectAgentsDir: discovery.projectAgentsDir, results };
}

export function workflowSubagentResultOutput(result: WorkflowSubagentResult): string {
  return result.output || result.errorMessage || result.stderr || "(no output)";
}
