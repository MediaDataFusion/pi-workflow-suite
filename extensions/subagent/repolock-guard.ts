import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PATH_SCOPED_TOOLS = new Set(["read", "grep", "find", "ls", "edit", "write"]);

function safeRealpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function resolveCandidatePath(pathValue: string, cwd: string): string {
  const expanded = pathValue === "~" || pathValue.startsWith("~/") ? resolve(process.env.HOME || cwd, pathValue.slice(2)) : pathValue;
  const resolved = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded || ".");
  if (existsSync(resolved)) return safeRealpath(resolved);
  const existingParent = safeRealpath(resolve(resolved, ".."));
  return resolve(existingParent, resolved.split(/[\\/]/).pop() || "");
}

function pathInsideRoot(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function protectedRepoPath(candidate: string, root: string): boolean {
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === ".pi" || rel.startsWith(".pi/");
}

function piRuntimeInstructionPath(candidate: string): boolean {
  const root = safeRealpath(getAgentDir());
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "skills" || rel.startsWith("skills/")
    || rel === "agents" || rel.startsWith("agents/")
    || rel === "config/prompts" || rel.startsWith("config/prompts/")
    || rel === "prompts" || rel.startsWith("prompts/")
    || rel === "themes" || rel.startsWith("themes/");
}

function repoLockPathBlock(pathValue: unknown, cwd: string, tool: string): string | undefined {
  if (process.env.PI_WORKFLOW_REPO_LOCK_ENABLED !== "1") return undefined;
  const root = safeRealpath(process.env.PI_WORKFLOW_REPO_LOCK_ROOT || cwd);
  const candidate = resolveCandidatePath(typeof pathValue === "string" && pathValue.trim() ? pathValue.trim() : ".", cwd);
  if (!pathInsideRoot(candidate, root)) {
    if ((tool === "read" || tool === "grep" || tool === "find" || tool === "ls") && piRuntimeInstructionPath(candidate)) return undefined;
    return `Repo Lock blocked sub-agent path outside current repository: ${candidate} (repo root: ${root})`;
  }
  if ((tool === "edit" || tool === "write") && protectedRepoPath(candidate, root)) return `Repo Lock blocked sub-agent ${tool} for protected project control path: ${candidate}`;
  return undefined;
}

function stripHereDocBodies(command: string): string {
  const lines = command.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    kept.push(line);
    const match = line.match(/<<[-]?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?/);
    if (!match) continue;
    const marker = match[1];
    i++;
    while (i < lines.length && lines[i].trim() !== marker) i++;
  }
  return kept.join("\n");
}

function stripUriTokens(command: string): string {
  return command.replace(/\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s'"`;&|)]*/g, " ");
}

function bashPathCandidates(command: string): string[] {
  const trimmed = stripUriTokens(stripHereDocBodies(command)).trim();
  if (!trimmed) return [];
  return Array.from(trimmed.matchAll(/(?:^|[\s=:'"`])((?:\.{1,2}|~|\/)[^\s'"`;&|)]*)/g)).map((match) => match[1]).filter(Boolean);
}

function repoLockBashBlock(command: string, cwd: string): string | undefined {
  if (process.env.PI_WORKFLOW_REPO_LOCK_ENABLED !== "1") return undefined;
  const root = safeRealpath(process.env.PI_WORKFLOW_REPO_LOCK_ROOT || cwd);
  const candidates = bashPathCandidates(command);
  for (const raw of candidates) {
    if (raw === "." || raw === "./" || raw === "/") continue;
    const cleaned = raw.replace(/[),]+$/, "");
    if (!cleaned || cleaned.startsWith("./node_modules/.bin")) continue;
    const candidate = resolveCandidatePath(cleaned, cwd);
    if (!pathInsideRoot(candidate, root)) return `Repo Lock blocked sub-agent bash path outside current repository: ${cleaned} -> ${candidate} (repo root: ${root})`;
  }
  return undefined;
}

export default function repoLockSubagentGuard(pi: ExtensionAPI): void {
  pi.on("tool_call", (event, ctx) => {
    if (PATH_SCOPED_TOOLS.has(event.toolName)) {
      const reason = repoLockPathBlock((event.input as { path?: unknown; file_path?: unknown }).path ?? (event.input as { file_path?: unknown }).file_path, ctx.cwd, event.toolName);
      if (reason) return { block: true, reason };
    }
    if (event.toolName === "bash") {
      const command = String((event.input as { command?: unknown }).command ?? "");
      const reason = repoLockBashBlock(command, ctx.cwd);
      if (reason) return { block: true, reason };
    }
  });

  pi.on("user_bash", (event, ctx) => {
    const reason = repoLockBashBlock(event.command, ctx.cwd);
    if (reason) return { result: { output: reason, exitCode: 1, cancelled: false, truncated: false } };
  });
}
