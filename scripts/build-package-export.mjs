#!/usr/bin/env node
import { mkdtempSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { packageMediaUrl, packageMediaUrls } from './package-media-config.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'inherit'],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
  return result.stdout ?? '';
}

function parseArgs(argv) {
  const args = { out: undefined, keepPack: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      args.out = resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (arg === '--keep-pack') {
      args.keepPack = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function buildPackageReadme(sourceReadme, version) {
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

  readme = readme.replace(/## Quick Demo[\s\S]*?## Contents\n/, `${packageMediaBlock}## Contents\n`);
  return readme;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workDir = mkdtempSync(join(tmpdir(), 'pi-workflow-suite-export-'));
  const packDir = join(workDir, 'pack');
  await mkdir(packDir, { recursive: true });

  const packOutput = run('npm', ['pack', '--pack-destination', packDir]);
  const tarballName = packOutput.trim().split('\n').filter(Boolean).at(-1);
  if (!tarballName) {
    throw new Error('npm pack did not report a tarball name');
  }

  run('tar', ['-xzf', join(packDir, tarballName), '-C', workDir]);
  const extractedDir = join(workDir, 'package');
  const packageJson = JSON.parse(await readFile(join(extractedDir, 'package.json'), 'utf8'));
  const sourceReadme = await readFile(join(repoRoot, 'README.md'), 'utf8');
  await writeFile(join(extractedDir, 'README.md'), buildPackageReadme(sourceReadme, packageJson.version));

  const outputDir = args.out ?? join(workDir, 'export');
  rmSync(outputDir, { recursive: true, force: true });
  await mkdir(dirname(outputDir), { recursive: true });
  await rename(extractedDir, outputDir);

  if (args.keepPack) {
    await mkdir(join(outputDir, '.pack-source'), { recursive: true });
    await copyFile(join(packDir, tarballName), join(outputDir, '.pack-source', tarballName));
  }

  console.log(outputDir);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
