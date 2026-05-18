#!/usr/bin/env node
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DIST_DIR = path.join(ROOT, 'dist');
const APP_DIR = path.join(ROOT, 'src', 'app');
const STYLE_DIR = path.join(ROOT, 'src', 'styles');
const ESBUILD_VERSION = '0.28.0';

async function orderedFiles(dir, ext) {
  const names = await readdir(dir);
  return names
    .filter((name) => name.endsWith(ext))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((name) => path.join(dir, name));
}

async function combine(files) {
  const chunks = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const content = await readFile(file, 'utf8');
    chunks.push(`\n/* ${rel} */\n${content}\n`);
  }
  return chunks.join('\n');
}

function runEsbuild(args) {
  const result = spawnSync('npx', ['--yes', `esbuild@${ESBUILD_VERSION}`, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
}

async function fileSize(file) {
  return (await stat(file)).size;
}

await mkdir(DIST_DIR, { recursive: true });

const styleFiles = await orderedFiles(STYLE_DIR, '.css');
const appFiles = await orderedFiles(APP_DIR, '.jsx');

const cssInput = await combine(styleFiles);
const appInput = await combine(appFiles);
const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'wycwy-entry-assets-'));
const cssSource = path.join(tmpDir, 'entry.css');
const appSource = path.join(tmpDir, 'entry.jsx');
await writeFile(cssSource, cssInput, 'utf8');
await writeFile(appSource, appInput, 'utf8');

runEsbuild([
  cssSource,
  '--minify',
  '--legal-comments=none',
  '--outfile=dist/wycwy-styles.bundle.css',
]);

runEsbuild([
  appSource,
  '--loader:.jsx=jsx',
  '--jsx=transform',
  '--jsx-factory=React.createElement',
  '--jsx-fragment=React.Fragment',
  '--format=iife',
  '--target=es2017',
  '--minify',
  '--legal-comments=none',
  '--outfile=dist/wycwy-app.bundle.js',
]);

await rm(tmpDir, { recursive: true, force: true });

const manifest = {
  builtAt: new Date().toISOString(),
  esbuildVersion: ESBUILD_VERSION,
  inputs: {
    styles: styleFiles.map((file) => path.relative(ROOT, file)),
    app: appFiles.map((file) => path.relative(ROOT, file)),
  },
  outputs: {
    styles: {
      file: 'dist/wycwy-styles.bundle.css',
      bytes: await fileSize(path.join(DIST_DIR, 'wycwy-styles.bundle.css')),
    },
    app: {
      file: 'dist/wycwy-app.bundle.js',
      bytes: await fileSize(path.join(DIST_DIR, 'wycwy-app.bundle.js')),
    },
  },
};

await writeFile(
  path.join(DIST_DIR, 'entry-assets-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`entry assets built: ${manifest.outputs.styles.bytes}B css, ${manifest.outputs.app.bytes}B js`);
