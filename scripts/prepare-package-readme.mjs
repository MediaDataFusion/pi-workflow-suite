#!/usr/bin/env node
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const readmePath = resolve(repoRoot, 'README.md');
const backupPath = resolve(repoRoot, '.package-readme.source.md');
const mediaVersion = '0.0.6';

function mediaCdn(assetPath) {
  return `https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@${mediaVersion}/${assetPath}`;
}

function buildPackageReadme(sourceReadme) {
  const headerBlock = `# Pi Workflow Suite\n\n${
    `![Pi Workflow Suite — structured workflow orchestration for Pi](${mediaCdn('docs/assets/pi-workflow-suite-header.png')})`
  }\n\n${[
    `[![Install](${mediaCdn('docs/assets/readme-link-install.svg')})](#installation)`,
    `[![Quick Start](${mediaCdn('docs/assets/readme-link-quick-start.svg')})](#quick-start)`,
    `[![Commands](${mediaCdn('docs/assets/readme-link-commands.svg')})](#core-commands)`,
    `[![Settings](${mediaCdn('docs/assets/readme-link-settings.svg')})](#settings-reference)`,
  ].join(' ')}\n\n**Workflow Suite Version:** `;

  let readme = sourceReadme.replace(
    /^# Pi Workflow Suite\n\n<p align="center">[\s\S]*?\*\*Workflow Suite Version:\*\* /,
    headerBlock,
  );

  const packageMediaBlock = `## Quick Demo\n\nSee Pi Workflow Suite in action: structured workflow modes, settings, runtime status, and guided execution inside Pi.\n\n[![Watch the Pi Workflow Suite quick demo](${mediaCdn('docs/assets/pi-workflow-suite-demo.gif')})](${mediaCdn('docs/assets/pi-workflow-suite-demo.mp4')})\n\n## Screenshots\n\n${[
    ['Pi Workflow Suite Mission Home with workflow graphs', 'docs/assets/screenshots/00-mission-home.png'],
    ['Pi Workflow Suite startup logo', 'docs/assets/screenshots/01-startup-Logo.png'],
    ['Workflow Suite theme settings', 'docs/assets/screenshots/02-theme-settings.png'],
    ['Workflow Suite global safety settings', 'docs/assets/screenshots/03-GlobalSafetySettings.png'],
    ['Workflow Suite shared sub-agent settings', 'docs/assets/screenshots/04-SharedSubAgentsSettings.png'],
    ['Mission Mode milestone progress', 'docs/assets/screenshots/05-mission-mode.png'],
    ['Workflow Suite Mermaid diagram output', 'docs/assets/screenshots/06-diagram-mermaid.png'],
  ].map(([alt, path]) => `![${alt}](${mediaCdn(path)})`).join('\n\n')}\n\n`;

  return readme.replace(/## Quick Demo[\s\S]*?## Contents\n/, `${packageMediaBlock}## Contents\n`);
}

function assertPackageReadme(readme) {
  const required = [
    mediaCdn('docs/assets/pi-workflow-suite-header.png'),
    mediaCdn('docs/assets/pi-workflow-suite-demo.gif'),
    mediaCdn('docs/assets/pi-workflow-suite-demo.mp4'),
    mediaCdn('docs/assets/screenshots/00-mission-home.png'),
    mediaCdn('docs/assets/screenshots/06-diagram-mermaid.png'),
    '[![Watch the Pi Workflow Suite quick demo]',
  ];
  for (const needle of required) {
    if (!readme.includes(needle)) throw new Error(`package README missing ${needle}`);
  }
  if (readme.includes('https://github.com/user-attachments/assets/9782fefc-5349-4cc9-b4ea-20b4c916a8b9')) {
    throw new Error('package README still contains raw GitHub demo attachment URL');
  }
  if (readme.includes('src="docs/assets/screenshots/') || readme.includes('](docs/assets/screenshots/')) {
    throw new Error('package README still contains source-relative screenshot paths');
  }
}

function apply() {
  if (existsSync(backupPath)) throw new Error('README backup already exists; run restore first');
  const sourceReadme = readFileSync(readmePath, 'utf8');
  const packageReadme = buildPackageReadme(sourceReadme);
  assertPackageReadme(packageReadme);
  writeFileSync(backupPath, sourceReadme);
  writeFileSync(readmePath, packageReadme);
}

function restore() {
  if (!existsSync(backupPath)) return;
  renameSync(backupPath, readmePath);
}

function check() {
  assertPackageReadme(readFileSync(readmePath, 'utf8'));
}

const command = process.argv[2];
if (command === 'apply') apply();
else if (command === 'restore') restore();
else if (command === 'check') check();
else {
  console.error('Usage: prepare-package-readme.mjs apply|restore|check');
  process.exit(1);
}
