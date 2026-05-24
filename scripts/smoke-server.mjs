#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_HTML = '网约车物语-V3.html';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requestRaw(port, rawPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: rawPath,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, text, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function requestJson(port, rawPath, options = {}) {
  const res = await requestRaw(port, rawPath, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return {
    ...res,
    json: res.text ? JSON.parse(res.text) : null,
  };
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 6000;
  const htmlPath = `/${encodeURIComponent(DEFAULT_HTML)}`;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const res = await requestRaw(port, htmlPath);
      if (res.status === 200) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError || new Error('server_start_failed');
}

function makeEntry(id, overrides = {}) {
  return {
    clientRunId: id,
    profile: `测试经营者 ${id}`,
    resultType: 'win',
    endingName: '平台 IPO 接班人',
    endingTier: 4,
    days: 70,
    funds: 180000 + Number(id.replace(/\D/g, '') || 0),
    totalEarned: 620000,
    totalCompleted: 420,
    reputation: 88,
    crews: 8,
    drivers: 8,
    vehicles: 8,
    ...overrides,
  };
}

async function run() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'wycwy-smoke-'));
  const leaderboardFile = path.join(tmpDir, 'leaderboard.jsonl');
  const port = 19100 + Math.floor(Math.random() * 1000);
  const upstreamPort = 18100 + Math.floor(Math.random() * 1000);
  const slowUpstream = http.createServer(() => {});
  const child = spawn(process.execPath, ['scripts/ai-review-server.mjs'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      WYCWY_LEADERBOARD_FILE: leaderboardFile,
      WYCWY_AI_API_KEY: 'smoke-test-key',
      WYCWY_AI_MODEL: 'smoke-test-model',
      WYCWY_AI_BASE_URL: `http://127.0.0.1:${upstreamPort}/slow`,
      WYCWY_AI_REQUEST_TIMEOUT_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await new Promise((resolve) => slowUpstream.listen(upstreamPort, '127.0.0.1', resolve));
    await waitForServer(port, child);

    const main = await requestRaw(port, `/${encodeURIComponent(DEFAULT_HTML)}`);
    assert(main.status === 200, `主页面应返回 200,实际 ${main.status}`);

    const head = await requestRaw(port, `/${encodeURIComponent(DEFAULT_HTML)}`, { method: 'HEAD' });
    assert(head.status === 200 && head.text === '', `HEAD 应返回 200 且无 body,实际 ${head.status}/${head.text.length}`);

    const escaped = await requestRaw(port, '/%2e%2e/AGENTS.md');
    assert(escaped.status === 403, `路径逃逸应返回 403,实际 ${escaped.status}`);

    const malformed = await requestRaw(port, '/%E0%A4%A');
    assert(malformed.status === 403, `坏编码路径应返回 403,实际 ${malformed.status}`);

    const nearMiss = await requestRaw(port, '/api/leaderboard-extra');
    assert(nearMiss.status === 404, `近似 API 路径应返回 404,实际 ${nearMiss.status}`);

    const slowReview = await requestJson(port, '/api/run-analysis', {
      method: 'POST',
      body: JSON.stringify({
        payload: {
          gameResult: { type: 'lose', deathCause: 'bankruptcy' },
          summary: {
            day: 40,
            funds: 12000,
            reputation: 72,
            crews: 5,
            drivers: 5,
            vehicles: 5,
            totalCompleted: 180,
            totalEarned: 240000,
          },
        },
      }),
    });
    assert(
      slowReview.json?.source === 'local' && slowReview.json?.message === 'upstream_timeout',
      `上游超时应回退 local/upstream_timeout,实际 ${slowReview.text}`
    );

    const entries = Array.from({ length: 20 }, (_, idx) => makeEntry(`run-${idx}`));
    const submitted = await Promise.all(entries.map((entry) =>
      requestJson(port, '/api/leaderboard/submit', {
        method: 'POST',
        body: JSON.stringify({ entry }),
      })
    ));
    assert(submitted.every((res) => res.status === 200 && res.json?.ok), '并发提交应全部成功');

    const list = await requestJson(port, '/api/leaderboard?sort=score&limit=30');
    assert(list.status === 200 && list.json?.ok, '榜单读取应成功');
    assert(list.json.total === 20, `并发写入后应保留 20 条,实际 ${list.json?.total}`);
    assert(list.json.entries.length === 20, `limit=30 时应返回 20 条,实际 ${list.json.entries?.length}`);

    const xss = await requestJson(port, '/api/leaderboard/submit', {
      method: 'POST',
      body: JSON.stringify({
        entry: makeEntry('run-xss', {
          profile: '<img src=x onerror=alert(1)>',
          endingName: '<script>alert(2)</script>',
        }),
      }),
    });
    assert(xss.json?.ok, '含 HTML 的榜单文本也应能正常提交');

    const xssList = await requestJson(port, '/api/leaderboard?sort=recent&limit=1');
    const xssEntry = xssList.json?.entries?.[0] || {};
    assert(
      !String(xssEntry.profile || '').includes('<') && !String(xssEntry.resultLabel || '').includes('<'),
      `榜单返回文本不应包含尖括号,实际 ${JSON.stringify(xssEntry)}`
    );

    const duplicate = await requestJson(port, '/api/leaderboard/submit', {
      method: 'POST',
      body: JSON.stringify({ entry: makeEntry('run-0', { funds: 999999 }) }),
    });
    assert(duplicate.json?.ok && duplicate.json?.duplicate, '重复 clientRunId 应返回 duplicate=true');

    const suspicious = await requestJson(port, '/api/leaderboard/submit', {
      method: 'POST',
      body: JSON.stringify({ entry: makeEntry('run-cheater', { styleKey: 'cheater', suspicious: true }) }),
    });
    assert(suspicious.json?.skipped && suspicious.json?.suspicious, '异常局应跳过榜单写入');

    const finalList = await requestJson(port, '/api/leaderboard?sort=recent&limit=30');
    assert(finalList.json?.total === 21, `XSS 文本、重复和异常提交后应为 21 条,实际 ${finalList.json?.total}`);

    const stored = await readFile(leaderboardFile, 'utf8');
    assert(stored.trim().split(/\n+/).length === 21, 'JSONL 文件应只有 21 行有效记录');

    console.log('smoke-server ok: main=200 head=200 traversal=403 malformed=403 api-nearmiss=404 ai-timeout=local concurrent=20 xss-text=sanitized duplicate=ok suspicious=skipped');
  } finally {
    await new Promise((resolve) => slowUpstream.close(resolve));
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
    await rm(tmpDir, { recursive: true, force: true });
    if (child.exitCode && child.exitCode !== 0 && child.signalCode !== 'SIGTERM') {
      process.stderr.write(stdout);
      process.stderr.write(stderr);
    }
  }
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
