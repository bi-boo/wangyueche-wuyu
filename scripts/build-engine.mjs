#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const ENGINE_DIR = path.join(ROOT, 'src', 'engine');
const ENGINE_OUT = path.join(ROOT, 'wycwy-engine.js');

async function orderedFiles(dir) {
  const names = await readdir(dir);
  return names
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((name) => path.join(dir, name));
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

const engineFiles = await orderedFiles(ENGINE_DIR);
const chunks = [];

for (const file of engineFiles) {
  chunks.push(await readFile(file, 'utf8'));
}

const output = chunks.join('\n');
await writeFile(ENGINE_OUT, output, 'utf8');

const bytes = (await stat(ENGINE_OUT)).size;
console.log(`engine built: ${bytes}B js, sha256=${sha256(output).slice(0, 12)}`);
