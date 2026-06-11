import type { KeyId } from "@earendil-works/pi-tui";

export type WorkflowShortcutPlatform = "darwin" | "win32" | "linux";
export type WorkflowShortcutActionId =
  | "workflow.widget.top.toggle"
  | "workflow.widget.bottom.toggle"
  | "workflow.presets.cycle"
  | "workflow.standard.toggle"
  | "workflow.plan.toggle"
  | "workflow.mission.toggle";

export interface WorkflowShortcutDefinition {
  id: WorkflowShortcutActionId;
  description: string;
  fallbackCommand: string;
  keys: Record<WorkflowShortcutPlatform, KeyId>;
}

export const WORKFLOW_SHORTCUTS: WorkflowShortcutDefinition[] = [
  {
    id: "workflow.widget.top.toggle",
    description: "Toggle active Plan/Mission/Standard top workflow widget",
    fallbackCommand: "/workflow widgets toggle top",
    keys: { darwin: "ctrl+shift+t", win32: "f2", linux: "f2" },
  },
  {
    id: "workflow.widget.bottom.toggle",
    description: "Toggle active Plan/Mission/Standard bottom workflow widget",
    fallbackCommand: "/workflow widgets toggle bottom",
    keys: { darwin: "ctrl+shift+b", win32: "f3", linux: "f3" },
  },
  {
    id: "workflow.presets.cycle",
    description: "Cycle workflow presets during Plan/Mission/Standard Mode",
    fallbackCommand: "/workflow presets next",
    keys: { darwin: "ctrl+shift+u", win32: "f4", linux: "f4" },
  },
  {
    id: "workflow.standard.toggle",
    description: "Toggle Standard Mode",
    fallbackCommand: "/standard",
    keys: { darwin: "ctrl+shift+s", win32: "f6", linux: "f6" },
  },
  {
    id: "workflow.plan.toggle",
    description: "Enter Plan Mode",
    fallbackCommand: "/plan",
    keys: { darwin: "ctrl+shift+l", win32: "f7", linux: "f7" },
  },
  {
    id: "workflow.mission.toggle",
    description: "Toggle Mission Mode",
    fallbackCommand: "/mission",
    keys: { darwin: "ctrl+shift+m", win32: "f8", linux: "f8" },
  },
];

const SHORTCUT_BY_ID = new Map(WORKFLOW_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export function workflowShortcutPlatform(platform = process.platform): WorkflowShortcutPlatform {
  if (platform === "darwin" || platform === "win32" || platform === "linux") return platform;
  return "linux";
}

export function workflowShortcutKey(id: WorkflowShortcutActionId, platform = process.platform): KeyId {
  return workflowShortcutDefinition(id).keys[workflowShortcutPlatform(platform)];
}

export function workflowShortcutDefinition(id: WorkflowShortcutActionId): WorkflowShortcutDefinition {
  const shortcut = SHORTCUT_BY_ID.get(id);
  if (!shortcut) throw new Error(`Unknown Workflow Suite shortcut: ${id}`);
  return shortcut;
}

export function workflowShortcutLabel(id: WorkflowShortcutActionId, platform = process.platform): string {
  return workflowShortcutKeyLabel(workflowShortcutKey(id, platform));
}

export function workflowShortcutKeyLabel(key: KeyId): string {
  return key.split("+").map((part) => {
    if (/^f\d+$/i.test(part)) return part.toUpperCase();
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join("+");
}

export function workflowEntryShortcutLabel(mode: "standard" | "plan" | "mission", platform = process.platform): string {
  if (mode === "standard") return `Standard:${workflowShortcutLabel("workflow.standard.toggle", platform)}`;
  if (mode === "plan") return `Plan:${workflowShortcutLabel("workflow.plan.toggle", platform)}`;
  return `Mission:${workflowShortcutLabel("workflow.mission.toggle", platform)}`;
}

export function workflowWidgetShortcutLabel(includeBottom: boolean, platform = process.platform): string {
  const prefix = includeBottom ? "Widgets" : "Widget";
  if (!includeBottom) return `${prefix}:${workflowShortcutLabel("workflow.widget.top.toggle", platform)}`;
  const activePlatform = workflowShortcutPlatform(platform);
  if (activePlatform === "darwin") return `${prefix}:Ctrl+Shift+T/B`;
  return `${prefix}:${workflowShortcutLabel("workflow.widget.top.toggle", platform)}/${workflowShortcutLabel("workflow.widget.bottom.toggle", platform)}`;
}

export function workflowPresetCycleShortcutLabel(platform = process.platform): string {
  return workflowShortcutLabel("workflow.presets.cycle", platform);
}

export function workflowSettingsShortcutLines(platform = process.platform): string[] {
  return [
    `Standard Shortcut: ${workflowShortcutLabel("workflow.standard.toggle", platform)} toggles Standard Mode`,
    `Plan Shortcut: ${workflowShortcutLabel("workflow.plan.toggle", platform)} enters Plan Mode`,
    `Mission Shortcut: ${workflowShortcutLabel("workflow.mission.toggle", platform)} enters Mission Mode`,
    `Widget Shortcuts: ${workflowWidgetShortcutLabel(true, platform).replace(/^Widgets:/, "")} while Plan/Mission/Standard Mode is active`,
    `Preset Cycle Shortcut: ${workflowPresetCycleShortcutLabel(platform)} while Plan/Mission/Standard Mode is active`,
  ];
}

export default function workflowShortcutsNoopExtension(): void {}
