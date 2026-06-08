import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadWorkflowSettings } from "../workflow-model-router.js";

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

function packageInstructionPath(candidate: string): boolean {
  const root = safeRealpath(join(dirname(fileURLToPath(import.meta.url)), ".."));
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "skills" || rel.startsWith("skills/")
    || rel === "agents" || rel.startsWith("agents/")
    || rel === "config/prompts" || rel.startsWith("config/prompts/")
    || rel === "prompts" || rel.startsWith("prompts/")
    || rel === "themes" || rel.startsWith("themes/");
}

function piClipboardImageTempFile(candidate: string): boolean {
  const base = candidate.split(/[\\/]/).pop() ?? "";
  return /^pi-clipboard-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|jpeg|gif|webp|bmp|tiff|heic)$/i.test(base);
}

function piCodingAgentPackageRoot(): string | undefined {
  try {
    const resolver = (import.meta as ImportMeta & { resolve?: (specifier: string) => string }).resolve;
    if (!resolver) return undefined;
    const entry = fileURLToPath(resolver("@earendil-works/pi-coding-agent"));
    return safeRealpath(resolve(dirname(entry), ".."));
  } catch {
    return undefined;
  }
}

function piCodingAgentDocsPath(candidate: string): boolean {
  const root = piCodingAgentPackageRoot();
  if (!root || !pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "docs" || rel.startsWith("docs/");
}

function userInstalledSkillPath(candidate: string): boolean {
  const home = process.env.HOME;
  if (!home) return false;
  const root = safeRealpath(join(home, ".agents", "skills"));
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  const skillName = rel.split(/[\\/]/)[0];
  return Boolean(skillName && skillName !== "." && skillName !== ".." && !skillName.startsWith("."));
}

function workflowStateReadPath(candidate: string): boolean {
  const root = safeRealpath(getAgentDir());
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "workflows/active.json"
    || rel === "workflows/plans/latest.json"
    || rel === "workflows/missions/latest.json";
}

const BLOCKED_EXECUTE_BASH: RegExp[] = [
  /\brm\s+-[^\n;|&]*r[^\n;|&]*f\b/i,
  /\bsudo\b/i,
  /\bchmod\s+-R\b/i,
  /\bchown\s+-R\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+checkout\b/i,
  /\bgit\s+switch\b/i,
  /\bnpm\s+install\b/i,
  /\bpnpm\s+add\b/i,
  /\byarn\s+add\b/i,
  /\bpip\s+install\b/i,
  /\bpip3?\s+install\b/i,
  /\bbundle\s+install\b/i,
  /\bgem\s+install\b/i,
  /\bcargo\s+install\b/i,
  /\bgo\s+(?:get|install)\b/i,
  /\bdeno\s+(?:install|add|cache)\b/i,
  /\bcomposer\s+(?:install|require|update)\b/i,
  /\bmix\s+(?:deps\.get|deps\.compile)\b/i,
  /\bbrew\s+install\b/i,
  /\bapt\s+(?:install|get\s+install)\b/i,
  /\byum\s+install\b/i,
  /\bdnf\s+install\b/i,
  /\bapk\s+add\b/i,
  /\bnuget\s+install\b/i,
  /\bdotnet\s+(?:add\s+package|tool\s+install|restore)\b/i,
  /\bcabal\s+(?:install|update)\b/i,
  /\bstack\s+(?:install|update)\b/i,
  /\bconan\s+install\b/i,
  /\bvcpkg\s+install\b/i,
  /\bcoursier\s+(?:install|fetch)\b/i,
  /\bcurl\b[^\n]*\|\s*sh\b/i,
  /\bwget\b[^\n]*\|\s*sh\b/i,
  /\bvercel\s+deploy\b/i,
  /\bdeploy\b/i,
  /\bsupabase\s+db\s+push\b/i,
  /\bsupabase\s+migration\s+up\b/i,
  /\bmigration\b[^\n]*(run|up|execute)/i,
];

const PACKAGE_INSTALL_RE = /\b(?:npm\s+install|pnpm\s+add|yarn\s+add|pip3?\s+install|bundle\s+install|gem\s+install|cargo\s+install|go\s+(?:get|install)|deno\s+(?:install|add|cache)|composer\s+(?:install|require|update)|mix\s+deps\.(?:get|compile)|brew\s+install|apt(?:-get)?\s+install|yum\s+install|dnf\s+install|apk\s+add|nuget\s+install|dotnet\s+(?:add\s+package|tool\s+install|restore)|cabal\s+(?:install|update)|stack\s+(?:install|update)|conan\s+install|vcpkg\s+install|coursier\s+(?:install|fetch))\b/i;

function isBlockedExecuteCommand(command: string): boolean {
  return BLOCKED_EXECUTE_BASH.some((pattern) => pattern.test(command));
}

function isPackageInstallCommand(command: string): boolean {
  return PACKAGE_INSTALL_RE.test(command);
}

function commandBlocked(command: string, cwd?: string): boolean {
  const settings = loadWorkflowSettings(cwd);
  if (settings.safety.blockDestructiveCommands === false) return false;
  if (isPackageInstallCommand(command) && settings.safety.allowPackageInstallInExecution !== false) return false;
  return isBlockedExecuteCommand(command);
}

function repoLockPathBlock(pathValue: unknown, cwd: string, tool: string): string | undefined {
  if (process.env.PI_WORKFLOW_REPO_LOCK_ENABLED !== "1") return undefined;
  const root = safeRealpath(process.env.PI_WORKFLOW_REPO_LOCK_ROOT || cwd);
  const candidate = resolveCandidatePath(typeof pathValue === "string" && pathValue.trim() ? pathValue.trim() : ".", cwd);
  if (!pathInsideRoot(candidate, root)) {
    if ((tool === "read" || tool === "grep" || tool === "find" || tool === "ls") && (piRuntimeInstructionPath(candidate) || packageInstructionPath(candidate) || piCodingAgentDocsPath(candidate) || userInstalledSkillPath(candidate) || workflowStateReadPath(candidate) || piClipboardImageTempFile(candidate))) return undefined;
    if (candidate.startsWith("/private/tmp/") || candidate.startsWith("/tmp/") || candidate.startsWith("/var/tmp/")) return undefined;
    return `Repo Lock blocked sub-agent path outside current repository: ${candidate} (repo root: ${root})`;
  }
  if ((tool === "edit" || tool === "write") && protectedRepoPath(candidate, root)) return `Repo Lock blocked sub-agent ${tool} for protected project control path: ${candidate}`;
  return undefined;
}

function stripQuotedSlashes(command: string): string {
  return command
    .replace(/'([^']*)'/g, (_full, content: string) => {
      // If content starts with /regex/ or /regex/flags (awk/sed address pattern), mask slashes
      if (/^\/[^/]+\/(?:[gimp]*$|\s)/.test(content)) return "'" + content.replace(/\//g, " ") + "'";
      // If content starts with /, it's a quoted absolute path — preserve
      if (content.startsWith('/')) return _full;
      // Content contains / but is not a path — mask (sed expression, prose, etc.)
      if (content.includes('/')) return "'" + content.replace(/\//g, " ") + "'";
      return _full;
    })
    .replace(/"([^"]*)"/g, (_full, content: string) => {
      if (/^\/[^/]+\/(?:[gimp]*$|\s)/.test(content)) return '"' + content.replace(/\//g, " ") + '"';
      if (content.startsWith('/')) return _full;
      if (content.includes('/')) return '"' + content.replace(/\//g, " ") + '"';
      return _full;
    });
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
  const trimmed = stripUriTokens(stripHereDocBodies(stripQuotedSlashes(command))).trim();
  if (!trimmed) return [];
  return Array.from(trimmed.matchAll(/(?:^|[\s=:'"`])((?:\.{1,2}|~|\/)[^\s'"`;&|)]*)/g)).map((match) => match[1]).filter(Boolean);
}

function hasShellControlOperator(command: string): boolean {
  let quote: "'" | '"' | undefined;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (char === "\\") { i += 1; continue; }
    if (quote) {
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === ";" || char === "|" || char === "&" || char === "<" || char === ">" || char === "\n") return true;
  }
  return quote !== undefined;
}

function shellWords(command: string): string[] | undefined {
  const words: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (char === "\\") {
      i += 1;
      current += command[i] ?? "";
      continue;
    }
    if (quote) {
      if (char === quote) quote = undefined;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (/\s/.test(char)) {
      if (current) { words.push(current); current = ""; }
      continue;
    }
    current += char;
  }
  if (quote) return undefined;
  if (current) words.push(current);
  return words;
}

function simpleCpSourceOperands(command: string): Set<string> | undefined {
  if (hasShellControlOperator(command)) return undefined;
  const words = shellWords(command);
  if (!words || words.length < 3) return undefined;
  const commandName = words[0].split(/[\\/]/).pop();
  if (commandName !== "cp") return undefined;
  const operands: string[] = [];
  let endOfOptions = false;
  for (const word of words.slice(1)) {
    if (!endOfOptions && word === "--") { endOfOptions = true; continue; }
    if (!endOfOptions && word.startsWith("-")) continue;
    operands.push(word);
  }
  if (operands.length < 2) return undefined;
  return new Set(operands.slice(0, -1));
}

function simpleReadOnlyBashAllowed(command: string): boolean {
  if (hasShellControlOperator(command)) return false;
  const words = shellWords(command);
  if (!words?.length) return false;
  const commandName = words[0].split(/[\\/]/).pop();
  if (commandName === "cat" || commandName === "ls" || commandName === "grep" || commandName === "rg") return true;
  if (commandName !== "find") return false;
  return !words.some((word) => word === "-delete" || word === "-exec" || word === "-execdir" || word === "-ok" || word === "-okdir" || word === "-fprint" || word === "-fprintf");
}

function piCodingAgentDocsBashReadAllowed(command: string): boolean {
  return simpleReadOnlyBashAllowed(command);
}

function repoLockBashBlock(command: string, cwd: string): string | undefined {
  if (process.env.PI_WORKFLOW_REPO_LOCK_ENABLED !== "1") return undefined;
  const root = safeRealpath(process.env.PI_WORKFLOW_REPO_LOCK_ROOT || cwd);
  const candidates = bashPathCandidates(command);
  const cpSourceOperands = simpleCpSourceOperands(command);
  for (const raw of candidates) {
    if (raw === "." || raw === "./" || raw === "/") continue;
    const cleaned = raw.replace(/[),]+$/, "");
    if (!cleaned || cleaned.startsWith("./node_modules/.bin")) continue;
    if (cleaned.startsWith("/dev/")) continue;
    if (cleaned.startsWith("/tmp/") || cleaned.startsWith("/private/tmp/") || cleaned.startsWith("/var/tmp/")) continue;
    const candidate = resolveCandidatePath(cleaned, cwd);
    if (!pathInsideRoot(candidate, root)) {
      if (piCodingAgentDocsPath(candidate) && piCodingAgentDocsBashReadAllowed(command)) continue;
      if (userInstalledSkillPath(candidate) && simpleReadOnlyBashAllowed(command)) continue;
      if (workflowStateReadPath(candidate) && simpleReadOnlyBashAllowed(command)) continue;
      if (piClipboardImageTempFile(candidate) && cpSourceOperands?.has(cleaned)) continue;
      return `Repo Lock blocked sub-agent bash path outside current repository: ${cleaned} -> ${candidate} (repo root: ${root})`;
    }
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
      if (commandBlocked(command, ctx.cwd)) return { block: true, reason: "Destructive or out-of-scope command blocked" };
    }
  });

  pi.on("user_bash", (event, ctx) => {
    const reason = repoLockBashBlock(event.command, ctx.cwd);
    if (reason) return { result: { output: reason, exitCode: 1, cancelled: false, truncated: false } };
    if (commandBlocked(event.command, ctx.cwd)) return { result: { output: "Destructive command blocked", exitCode: 1, cancelled: false, truncated: false } };
  });
}
