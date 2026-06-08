#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageMediaBaseUrl, packageMediaUrls, packageMediaVersion } from './package-media-config.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));

const forbiddenNeedles = [
  '@mediadatafusion/pi-workflow-suite@0.0.6/docs/assets',
  'raw.githubusercontent.com/MediaDataFusion/pi-workflow-suite/v0.0.12/docs/assets',
];

const expectedPiManifest = {
  extensions: ['./extensions/workflow-modes.ts', './extensions/subagent/index.ts'],
  skills: ['./skills'],
  prompts: ['./config/prompts', '!*.md'],
  themes: ['./themes'],
};

const requiredPackageFiles = [
  'extensions/',
  'skills/',
  'config/',
  'themes/',
  'scripts/check-package-media.mjs',
  'scripts/package-media-config.mjs',
  'scripts/prepare-package-readme.mjs',
  'scripts/build-package-export.mjs',
  'README.md',
  'package-lock.json',
];

function assert(condition, message) {
  if (!condition) {
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  }
}

function assertArrayEquals(actual, expected, label) {
  assert(Array.isArray(actual), `package.json ${label} must be an array`);
  if (!Array.isArray(actual)) return;
  const sameLength = actual.length === expected.length;
  const sameEntries = expected.every((entry, index) => actual[index] === entry);
  assert(sameLength && sameEntries, `package.json ${label} changed from expected manifest surface`);
}

assertArrayEquals(packageJson.pi?.extensions, expectedPiManifest.extensions, 'pi.extensions');
assertArrayEquals(packageJson.pi?.skills, expectedPiManifest.skills, 'pi.skills');
assertArrayEquals(packageJson.pi?.prompts, expectedPiManifest.prompts, 'pi.prompts');
assertArrayEquals(packageJson.pi?.themes, expectedPiManifest.themes, 'pi.themes');
assert(packageJson.pi?.image === packageMediaUrls.header, 'package.json pi.image does not match package media config');
assert(packageJson.pi?.video === packageMediaUrls.demoMp4, 'package.json pi.video does not match package media config');
assert(packageJson.pi?.video?.endsWith('.mp4'), 'package.json pi.video must be an MP4 URL');
assert(packageJson.pi?.image?.match(/\.(png|jpg|jpeg|webp|gif)$/), 'package.json pi.image must be an image URL');
assert(
  packageMediaBaseUrl ===
    `https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@${packageMediaVersion}/docs/assets`,
  'package media must use the established jsDelivr npm CDN media base',
);

for (const requiredFile of requiredPackageFiles) {
  assert(packageJson.files?.includes(requiredFile), `package.json files must include ${requiredFile}`);
}
assert(!packageJson.files?.includes('docs/assets/'), 'package.json files must not include docs/assets/');

const packageJsonText = JSON.stringify(packageJson);
for (const needle of forbiddenNeedles) {
  assert(!packageJsonText.includes(needle), `package.json still contains forbidden media URL ${needle}`);
}

assert(packageJsonText.includes(packageMediaBaseUrl), 'package.json does not contain the package media base URL');

if (process.exitCode) process.exit(process.exitCode);
console.log(`OK: package media points to ${packageMediaBaseUrl}`);
