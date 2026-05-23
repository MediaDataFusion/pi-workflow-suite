#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const maxTarballBytes = 1_000_000;
const forbiddenPrefix = 'docs/assets/';

const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const [pack] = JSON.parse(result.stdout);
const forbidden = pack.files.filter((file) => file.path.startsWith(forbiddenPrefix));

if (forbidden.length > 0) {
  console.error(`ERROR: package includes promotional assets under ${forbiddenPrefix}`);
  for (const file of forbidden) console.error(`- ${file.path}`);
  process.exit(1);
}

if (pack.size > maxTarballBytes) {
  console.error(`ERROR: package tarball is ${pack.size} bytes, above ${maxTarballBytes} bytes`);
  process.exit(1);
}

console.log(`OK: package tarball ${pack.size} bytes, ${pack.files.length} files, no ${forbiddenPrefix} entries`);
