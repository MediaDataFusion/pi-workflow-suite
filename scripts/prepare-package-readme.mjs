#!/usr/bin/env node
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageMediaUrl, packageMediaUrls } from './package-media-config.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const readmePath = resolve(repoRoot, 'README.md');
const backupPath = resolve(repoRoot, '.package-readme.source.md');
const publishMarkerPath = resolve(repoRoot, '.package-readme.publish');
function buildPackageReadme(sourceReadme) {
  const headerBlock = `# Pi Workflow Suite\n\n${
    `![Pi Workflow Suite — structured workflow orchestration for Pi](${packageMediaUrls.header})`
  }\n\n${[
    `[![Install](${packageMediaUrls.readmeInstall})](#installation)`,
    `[![Quick Start](${packageMediaUrls.readmeQuickStart})](#quick-start)`,
    `[![Commands](${packageMediaUrls.readmeCommands})](#core-commands)`,
    `[![Settings](${packageMediaUrls.readmeSettings})](#settings-reference)`,
  ].join(' ')}\n\n**Workflow Suite Version:** `;

  let readme = sourceReadme.replace(
    /^# Pi Workflow Suite\n\n<p align="center">[\s\S]*?\*\*Workflow Suite Version:\*\* /,
    headerBlock,
  );

  const packageMediaBlock = `## Quick Demo\n\nSee Pi Workflow Suite in action: structured workflow modes, settings, runtime status, and guided execution inside Pi.\n\n[![Watch the Pi Workflow Suite quick demo](${packageMediaUrls.demoGif})](${packageMediaUrls.demoMp4})\n\n## Screenshots\n\n${[
    ['Pi Workflow Suite Mission Home with workflow graphs', 'docs/assets/screenshots/00-mission-home.png'],
    ['Pi Workflow Suite startup logo', 'docs/assets/screenshots/01-startup-Logo.png'],
    ['Workflow Suite theme settings', 'docs/assets/screenshots/02-theme-settings.png'],
    ['Workflow Suite global safety settings', 'docs/assets/screenshots/03-GlobalSafetySettings.png'],
    ['Workflow Suite shared sub-agent settings', 'docs/assets/screenshots/04-SharedSubAgentsSettings.png'],
    ['Mission Mode milestone progress', 'docs/assets/screenshots/05-mission-mode.png'],
    ['Workflow Suite Mermaid diagram output', 'docs/assets/screenshots/06-diagram-mermaid.png'],
  ].map(([alt, path]) => `![${alt}](${packageMediaUrl(path)})`).join('\n\n')}\n\n`;

  return readme.replace(/## Quick Demo[\s\S]*?## Contents\n/, `${packageMediaBlock}## Contents\n`);
}

function assertPackageReadme(readme) {
  const required = [
    packageMediaUrls.header,
    packageMediaUrls.demoGif,
    packageMediaUrls.demoMp4,
    packageMediaUrls.screenshots.missionHome,
    packageMediaUrls.screenshots.diagramMermaid,
    '[![Watch the Pi Workflow Suite quick demo]',
  ];
  for (const needle of required) {
    if (!readme.includes(needle)) throw new Error(`package README missing ${needle}`);
  }
  if (readme.includes('https://github.com/user-attachments/assets/9782fefc-5349-4cc9-b4ea-20b4c916a8b9')) {
    throw new Error('package README still contains raw GitHub demo attachment URL');
  }
  if (readme.includes('<table>') || readme.includes('<img src="docs/assets/screenshots/')) {
    throw new Error('package README still contains source screenshot table markup');
  }
  if (readme.includes('src="docs/assets/screenshots/') || readme.includes('](docs/assets/screenshots/')) {
    throw new Error('package README still contains source-relative screenshot paths');
  }
  if (readme.includes('@mediadatafusion/pi-workflow-suite@0.0.6/docs/assets')) {
    throw new Error('package README still contains old 0.0.6 package media URLs');
  }
  if (readme.includes('raw.githubusercontent.com/MediaDataFusion/pi-workflow-suite/v0.0.12/docs/assets')) {
    throw new Error('package README points at raw GitHub media instead of the established jsDelivr npm CDN');
  }
}

function looksPackageSafe(readme) {
  try {
    assertPackageReadme(readme);
    return true;
  } catch {
    return false;
  }
}

function apply() {
  const publishMode = process.argv.includes('--publish');
  const currentReadme = readFileSync(readmePath, 'utf8');

  if (looksPackageSafe(currentReadme)) {
    if (publishMode) writeFileSync(publishMarkerPath, 'publish\n');
    return;
  }

  if (existsSync(backupPath)) throw new Error('README backup already exists; run restore first');
  const packageReadme = buildPackageReadme(currentReadme);
  assertPackageReadme(packageReadme);
  writeFileSync(backupPath, currentReadme);
  writeFileSync(readmePath, packageReadme);
  if (publishMode) writeFileSync(publishMarkerPath, 'publish\n');
}

function restore() {
  const packMode = process.argv.includes('--pack');
  const publishMode = process.argv.includes('--publish');

  if (packMode && existsSync(publishMarkerPath)) return;

  if (existsSync(backupPath)) renameSync(backupPath, readmePath);
  if ((publishMode || !packMode) && existsSync(publishMarkerPath)) unlinkSync(publishMarkerPath);
}

function check() {
  assertPackageReadme(readFileSync(readmePath, 'utf8'));
}

const command = process.argv[2];
if (command === 'apply') apply();
else if (command === 'restore') restore();
else if (command === 'check') check();
else {
  console.error('Usage: prepare-package-readme.mjs apply|restore|check [--publish|--pack]');
  process.exit(1);
}
