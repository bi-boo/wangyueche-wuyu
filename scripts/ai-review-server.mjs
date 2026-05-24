#!/usr/bin/env node
import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');
const PORT = Number(process.env.PORT || process.env.WYCWY_PORT || 8765);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_HTML = '网约车物语-V3.html';
const LEADERBOARD_FILE = process.env.WYCWY_LEADERBOARD_FILE
  || path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'wycwy', 'leaderboard.jsonl');
const MAX_LEADERBOARD_ROWS = Number(process.env.WYCWY_LEADERBOARD_MAX_ROWS || 5000);
const DEFAULT_LEADERBOARD_LIMIT = 100;
let leaderboardWriteQueue = Promise.resolve();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
};

const DEFAULT_ARK_MODEL = 'doubao-seed-2-0-lite-260428';
const DEFAULT_ARK_RESPONSES_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';
const CHEATER_REVIEW = {
  headline: '控制台炼金术士',
  verdict: '你的经营数据已经突破正常运营边界,不像是车队跑出来的,更像是浏览器控制台直接改出来的。系统不会把这局放进正常榜单,但会承认你在技术路线上的野心很直接。',
  evidence: [],
  advice: '下一局可以继续钻研技术,但想上正常榜单就按游戏规则经营。真正有意思的不是把数字改大,而是在现金流、司机关系和扩张节奏之间做取舍。',
};
const CHEAT_RULES = {
  maxDays: 2000,
  maxFunds: 3000000,
  minFunds: -1000000,
  maxReputation: 20000,
  maxCrews: 80,
  maxDrivers: 120,
  maxVehicles: 120,
  maxOrders: 120000,
  maxEarned: 20000000,
  maxOrdersPerDayPerCrew: 36,
  maxEarnedPerDayPerCrew: 16000,
  maxFundsPerDay: 120000,
  minWinDays: 12,
};

const REVIEW_SYSTEM_PROMPT = `你是网页游戏《网约车物语》的结局复盘官。
你的任务是根据玩家的完整经营记录,客观但犀利地评价玩家在游戏中的经营风格。
不要安慰玩家,不要写鸡汤,不要虚构记录中没有发生的选择。
必须引用具体选择作为证据,重点判断玩家更偏向利润、司机关系、合规、冒险、长期主义还是短期止血。
只输出一个 JSON 对象,不要 Markdown,不要代码块,不要在 JSON 外添加解释文字。JSON 结构如下:
{
  "headline": "一句经营人格标题",
  "verdict": "一段 80-140 字的犀利评价",
  "evidence": ["证据 1", "证据 2", "证据 3"],
  "advice": "一段下一局建议"
}
字段约束:
- headline 必须是纯标题文本,不要包含 headline、JSON、冒号、引号或大括号。
- verdict 必须是纯评价段落,不要包含 verdict、evidence、advice 这些字段名。
- evidence 必须是 2-4 条字符串数组,每条只写一条具体选择证据,不要包含数组括号。
- advice 必须是纯建议段落,不要包含 advice 字段名。`;

const REVIEW_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'verdict', 'evidence', 'advice'],
  properties: {
    headline: {
      type: 'string',
      minLength: 4,
      maxLength: 32,
      description: '一句经营人格标题,不要包含 JSON 字段名',
    },
    verdict: {
      type: 'string',
      minLength: 40,
      maxLength: 220,
      description: '80-140 字左右的犀利经营评价',
    },
    evidence: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 8,
        maxLength: 120,
      },
    },
    advice: {
      type: 'string',
      minLength: 20,
      maxLength: 180,
      description: '下一局建议',
    },
  },
};

function sendJson(res, statusCode, body) {
  const text = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function getRequestPathname(req) {
  try {
    return new URL(req.url || '/', `http://localhost:${PORT}`).pathname;
  } catch (e) {
    return '';
  }
}

function clampText(value, maxLength = 80) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeInt(value, fallback = 0) {
  return Math.round(toFiniteNumber(value, fallback));
}

function getResultLabel(entry) {
  if (entry.resultType === 'win') return entry.endingName ? `达成 ${entry.endingName}` : '达成结局';
  if (entry.resultType === 'lose') {
    if (entry.deathCause === 'bankruptcy') return '资金破产';
    if (entry.deathCause === 'crew_collapsed') return '车队崩溃';
    if (entry.deathCause === 'kicked_out') return '投资人撤资';
    return '经营失败';
  }
  return '主动收尾';
}

function computeLeaderboardScore(entry) {
  const resultBonus = entry.resultType === 'win' ? 1000000 : entry.resultType === 'end' ? 500000 : 0;
  const endingBonus = normalizeInt(entry.endingTier) * 120000;
  const fundsScore = Math.max(-200000, normalizeInt(entry.funds));
  const reputationScore = normalizeInt(entry.reputation) * 500;
  const crewScore = normalizeInt(entry.crews) * 15000;
  const orderScore = normalizeInt(entry.totalCompleted) * 120;
  const dayScore = normalizeInt(entry.days) * 80;
  return resultBonus + endingBonus + fundsScore + reputationScore + crewScore + orderScore + dayScore;
}

function getPayloadSummary(payload = {}) {
  return payload.summary || {};
}

function detectSuspiciousRun(payload = {}) {
  const summary = getPayloadSummary(payload);
  const result = payload.gameResult || {};
  const day = Math.max(1, normalizeInt(summary.day ?? summary.days ?? payload.days ?? 1, 1));
  const funds = normalizeInt(summary.funds ?? payload.funds ?? 0);
  const reputation = normalizeInt(summary.reputation ?? payload.reputation ?? 0);
  const crews = Math.max(0, normalizeInt(summary.crews ?? payload.crews ?? 0));
  const drivers = Math.max(0, normalizeInt(summary.drivers ?? payload.drivers ?? 0));
  const vehicles = Math.max(0, normalizeInt(summary.vehicles ?? payload.vehicles ?? 0));
  const totalCompleted = Math.max(0, normalizeInt(summary.totalCompleted ?? payload.totalCompleted ?? 0));
  const totalEarned = Math.max(0, normalizeInt(summary.totalEarned ?? payload.totalEarned ?? 0));
  const effectiveCrews = Math.max(1, Math.min(Math.max(crews, 1), Math.max(drivers, vehicles, 1)));
  const reasons = [];
  const add = (code, message) => reasons.push({ code, message });

  if (day > CHEAT_RULES.maxDays) add('days_too_high', `运营天数 ${day} 超过正常上限`);
  if (funds > CHEAT_RULES.maxFunds || funds < CHEAT_RULES.minFunds) add('funds_out_of_range', `最终资金 ${funds} 超出正常范围`);
  if (reputation > CHEAT_RULES.maxReputation) add('reputation_too_high', `口碑 ${reputation} 超过正常上限`);
  if (crews > CHEAT_RULES.maxCrews) add('crews_too_high', `车组 ${crews} 超过正常上限`);
  if (drivers > CHEAT_RULES.maxDrivers || vehicles > CHEAT_RULES.maxVehicles) add('fleet_size_too_high', `司机/车辆数量 ${drivers}/${vehicles} 超过正常上限`);
  if (crews > drivers || crews > vehicles) add('crew_entity_mismatch', `车组 ${crews} 超过司机或车辆数量`);
  if (totalCompleted > CHEAT_RULES.maxOrders) add('orders_too_high', `完成订单 ${totalCompleted} 超过正常上限`);
  if (totalEarned > CHEAT_RULES.maxEarned) add('earned_too_high', `总流水 ${totalEarned} 超过正常上限`);
  if (totalCompleted / day / effectiveCrews > CHEAT_RULES.maxOrdersPerDayPerCrew) {
    add('orders_per_crew_day_too_high', `单车组日均订单 ${(totalCompleted / day / effectiveCrews).toFixed(1)} 过高`);
  }
  if (totalEarned / day / effectiveCrews > CHEAT_RULES.maxEarnedPerDayPerCrew) {
    add('earned_per_crew_day_too_high', `单车组日均流水 ${(totalEarned / day / effectiveCrews).toFixed(0)} 过高`);
  }
  if (funds > day * CHEAT_RULES.maxFundsPerDay + 30000) {
    add('funds_growth_too_fast', `资金增长速度超出正常经营范围`);
  }
  if ((result.type === 'win' || result.endingId) && day < CHEAT_RULES.minWinDays) {
    add('win_too_fast', `第 ${day} 天达成结局过快`);
  }
  if (totalCompleted > 0 && totalEarned > 0 && totalEarned / totalCompleted > 25000) {
    add('fare_per_order_too_high', `单均流水 ${(totalEarned / totalCompleted).toFixed(0)} 过高`);
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

function buildCheaterReview(report) {
  const evidence = (report?.reasons || [])
    .slice(0, 4)
    .map((item) => item.message);
  return {
    ...CHEATER_REVIEW,
    evidence: evidence.length ? evidence : ['这局数据超过正常经营边界'],
  };
}

function normalizeLeaderboardEntry(input = {}) {
  const summary = input.summary || {};
  const gameResult = input.gameResult || {};
  const profile = input.profile || input.reviewHeadline || input.headline || '';
  const styleTag = clampText(input.styleTag || input.style || '', 32) || '均衡经营型';
  const styleKey = clampText(input.styleKey || '', 32) || normalizeStyleKey(styleTag);
  const now = new Date().toISOString();
  const entry = {
    id: clampText(input.id || randomUUID(), 80),
    clientRunId: clampText(input.clientRunId || '', 140),
    submittedAt: now,
    profile: clampText(profile, 40) || '未命名经营者',
    styleTag,
    styleKey,
    resultType: clampText(gameResult.type || input.resultType || 'unknown', 16),
    deathCause: clampText(gameResult.deathCause || input.deathCause || '', 32) || null,
    endingId: clampText(gameResult.endingId || input.endingId || '', 40) || null,
    endingName: clampText(gameResult.endingName || input.endingName || '', 40) || null,
    endingTier: normalizeInt(input.endingTier ?? gameResult.endingTier ?? 0),
    days: Math.max(0, normalizeInt(input.days ?? summary.day ?? summary.days ?? 0)),
    funds: normalizeInt(input.funds ?? summary.funds ?? 0),
    totalEarned: Math.max(0, normalizeInt(input.totalEarned ?? summary.totalEarned ?? 0)),
    totalCompleted: Math.max(0, normalizeInt(input.totalCompleted ?? summary.totalCompleted ?? 0)),
    reputation: Math.max(0, normalizeInt(input.reputation ?? summary.reputation ?? 0)),
    crews: Math.max(0, normalizeInt(input.crews ?? summary.crews ?? 0)),
    drivers: Math.max(0, normalizeInt(input.drivers ?? summary.drivers ?? 0)),
    vehicles: Math.max(0, normalizeInt(input.vehicles ?? summary.vehicles ?? 0)),
    reviewSource: clampText(input.reviewSource || 'unknown', 20),
    suspicious: !!input.suspicious,
    cheatReasons: Array.isArray(input.cheatReasons) ? input.cheatReasons.slice(0, 6) : [],
  };
  entry.resultLabel = getResultLabel(entry);
  entry.score = computeLeaderboardScore(entry);
  return entry;
}

function normalizeStyleKey(styleTag) {
  const text = String(styleTag || '');
  if (text.includes('司机')) return 'driver_friendly';
  if (text.includes('利润')) return 'profit_first';
  if (text.includes('冒险') || text.includes('扩张')) return 'risk_growth';
  if (text.includes('合规') || text.includes('稳健')) return 'steady_compliance';
  if (text.includes('口碑')) return 'reputation_first';
  if (text.includes('现金')) return 'cashflow_broken';
  return 'balanced';
}

function inferStyleTagFromText(text) {
  const value = String(text || '');
  if (/现金流|破产|粉碎机|烧钱|散财/.test(value)) return { styleTag: '现金流失控型', styleKey: 'cashflow_broken' };
  if (/司机|情义|重情|人情|服务/.test(value)) return { styleTag: '司机友好型', styleKey: 'driver_friendly' };
  if (/利润|冷面|成本|现金/.test(value)) return { styleTag: '利润优先型', styleKey: 'profit_first' };
  if (/冒险|扩张|激进|盲目|赌/.test(value)) return { styleTag: '冒险扩张型', styleKey: 'risk_growth' };
  if (/合规|稳健|风控|规则/.test(value)) return { styleTag: '稳健合规型', styleKey: 'steady_compliance' };
  if (/口碑|声誉/.test(value)) return { styleTag: '口碑优先型', styleKey: 'reputation_first' };
  return { styleTag: '均衡经营型', styleKey: 'balanced' };
}

function enrichLeaderboardEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  if (entry.styleTag && entry.styleKey) return entry;
  const inferred = inferStyleTagFromText(entry.styleTag || entry.profile || entry.resultLabel || '');
  return {
    ...entry,
    styleTag: entry.styleTag || inferred.styleTag,
    styleKey: entry.styleKey || inferred.styleKey,
  };
}

async function readLeaderboardEntries() {
  try {
    const text = await fs.readFile(LEADERBOARD_FILE, 'utf8');
    return text.split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .map(enrichLeaderboardEntry);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function sortLeaderboardEntries(entries, sort = 'score') {
  const sortKey = String(sort || 'score');
  const numericSorts = {
    score: (entry) => entry.score,
    funds: (entry) => entry.funds,
    reputation: (entry) => entry.reputation,
    crews: (entry) => entry.crews,
    days: (entry) => entry.days,
    orders: (entry) => entry.totalCompleted,
    earned: (entry) => entry.totalEarned,
  };
  if (sortKey === 'recent') {
    return [...entries].sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
  }
  const getter = numericSorts[sortKey] || numericSorts.score;
  return [...entries].sort((a, b) => {
    const diff = getter(b) - getter(a);
    if (diff) return diff;
    return String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
  });
}

function attachRanks(entries, sort = 'score') {
  return sortLeaderboardEntries(entries, sort).map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

function buildProfileStats(entries) {
  const buckets = new Map();
  entries.forEach((entry) => {
    const key = entry.styleTag || '均衡经营型';
    const bucket = buckets.get(key) || {
      styleTag: key,
      styleKey: entry.styleKey || normalizeStyleKey(key),
      count: 0,
      bestScore: -Infinity,
      bestFunds: -Infinity,
      bestReputation: 0,
      bestCrews: 0,
      avgDays: 0,
    };
    bucket.count += 1;
    bucket.bestScore = Math.max(bucket.bestScore, entry.score || 0);
    bucket.bestFunds = Math.max(bucket.bestFunds, entry.funds || 0);
    bucket.bestReputation = Math.max(bucket.bestReputation, entry.reputation || 0);
    bucket.bestCrews = Math.max(bucket.bestCrews, entry.crews || 0);
    bucket.avgDays += entry.days || 0;
    buckets.set(key, bucket);
  });
  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      avgDays: bucket.count ? Number((bucket.avgDays / bucket.count).toFixed(1)) : 0,
      bestScore: Math.max(0, bucket.bestScore),
      bestFunds: bucket.bestFunds === -Infinity ? 0 : bucket.bestFunds,
    }))
    .sort((a, b) => b.count - a.count || b.bestScore - a.bestScore)
    .slice(0, 30);
}

async function writeLeaderboardEntries(entries) {
  const normalized = entries.slice(-MAX_LEADERBOARD_ROWS);
  await fs.mkdir(path.dirname(LEADERBOARD_FILE), { recursive: true });
  const text = normalized.map((entry) => JSON.stringify(entry)).join('\n');
  const tmpFile = `${LEADERBOARD_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, text ? `${text}\n` : '', 'utf8');
  await fs.rename(tmpFile, LEADERBOARD_FILE);
}

function withLeaderboardWriteLock(task) {
  const run = leaderboardWriteQueue.then(task, task);
  leaderboardWriteQueue = run.catch(() => {});
  return run;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJsonObject(text) {
  if (!text) return null;
  const cleaned = String(text)
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (inner) {
      return null;
    }
  }
}

function cleanReviewText(value, maxLength = 220) {
  return String(value || '')
    .replace(/```(?:json)?|```/gi, '')
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, '')
    .replace(/^\s*(headline|verdict|evidence|advice|summary|nextRunAdvice)\s*[:：]\s*/i, '')
    .replace(/[{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeReviewObject(value) {
  const raw = value?.review && typeof value.review === 'object' ? value.review : value;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const headline = cleanReviewText(raw.headline || raw.archetype || raw.title, 40);
  const verdict = cleanReviewText(raw.verdict || raw.summary || raw.analysis, 260);
  const rawEvidence = Array.isArray(raw.evidence)
    ? raw.evidence
    : typeof raw.evidence === 'string'
      ? raw.evidence.split(/\n+|；|;/)
      : [];
  const evidence = rawEvidence
    .map((item) => cleanReviewText(item, 140))
    .filter((item) => item && !/^(evidence|advice)$/i.test(item))
    .slice(0, 4);
  const advice = cleanReviewText(raw.advice || raw.nextRunAdvice || raw.suggestion, 220);

  if (!headline || !verdict || !advice) return null;
  return {
    headline,
    verdict,
    evidence,
    advice,
  };
}

function extractStringField(text, field, nextFields = []) {
  const nextPattern = nextFields.length
    ? `(?=\\s*,?\\s*["“]?(${nextFields.join('|')})["”]?\\s*[:：])`
    : '';
  const patterns = [
    new RegExp(`["“]?${field}["”]?\\s*[:：]\\s*["“]([\\s\\S]*?)[\\"”]${nextPattern}`, 'i'),
    new RegExp(`["“]?${field}["”]?\\s*[:：]\\s*([\\s\\S]*?)${nextPattern || '$'}`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function repairReviewFromText(text) {
  const raw = String(text || '')
    .replace(/```(?:json)?|```/gi, '')
    .replace(/\r/g, '')
    .trim();
  if (!raw) return null;
  const headline = extractStringField(raw, 'headline', ['verdict', 'evidence', 'advice']);
  const verdict = extractStringField(raw, 'verdict', ['evidence', 'advice']);
  const advice = extractStringField(raw, 'advice', []);
  const evidenceBlockMatch = raw.match(/["“]?evidence["”]?\s*[:：]\s*\[([\s\S]*?)(?:\]\s*,?\s*["“]?advice["”]?|["“]?advice["”]?\s*[:：]|$)/i);
  const evidenceBlock = evidenceBlockMatch?.[1] || '';
  const evidence = [];
  let quoteMatch;
  const quotePattern = /["“]([^"“”\n]{6,180})["”]/g;
  while ((quoteMatch = quotePattern.exec(evidenceBlock)) && evidence.length < 4) {
    evidence.push(quoteMatch[1]);
  }
  if (!evidence.length) {
    evidence.push(...evidenceBlock
      .split(/\n+|,\s*|，\s*|；|;/)
      .map((item) => item.replace(/^[-*]\s*/, ''))
      .filter((item) => item.trim().length >= 6)
      .slice(0, 4));
  }
  return normalizeReviewObject({ headline, verdict, evidence, advice });
}

function getAiProvider(baseUrl) {
  const explicit = (process.env.WYCWY_AI_PROVIDER || '').trim().toLowerCase();
  if (explicit) return explicit;
  return baseUrl.includes('/responses') ? 'responses' : 'chat';
}

function buildModelRequest({ provider, model, payload }) {
  const userText = `请按系统规则复盘以下《网约车物语》单局记录,只返回 JSON。\n\n${JSON.stringify(payload)}`;
  if (provider === 'chat' || provider === 'chat-completions') {
    return {
      model,
      temperature: Number(process.env.WYCWY_AI_TEMPERATURE || 0.75),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'wycwy_run_review',
          strict: true,
          schema: REVIEW_JSON_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: REVIEW_SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
    };
  }
  return {
    model,
    instructions: REVIEW_SYSTEM_PROMPT,
    stream: false,
    store: false,
    temperature: Number(process.env.WYCWY_AI_TEMPERATURE || 0.75),
    max_output_tokens: Number(process.env.WYCWY_AI_MAX_OUTPUT_TOKENS || 900),
    text: {
      format: {
        type: 'json_schema',
        name: 'wycwy_run_review',
        strict: true,
        schema: REVIEW_JSON_SCHEMA,
      },
    },
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: userText,
          },
        ],
      },
    ],
  };
}

function extractModelText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  if (Array.isArray(data?.output)) {
    const parts = [];
    data.output.forEach((item) => {
      if (typeof item?.text === 'string') parts.push(item.text);
      (item?.content || []).forEach((content) => {
        if (typeof content?.text === 'string') parts.push(content.text);
        if (typeof content?.output_text === 'string') parts.push(content.output_text);
      });
    });
    if (parts.length) return parts.join('\n');
  }
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
}

async function handleRunAnalysis(req, res) {
  const baseUrl = process.env.WYCWY_AI_BASE_URL || DEFAULT_ARK_RESPONSES_URL;
  const provider = getAiProvider(baseUrl);
  const apiKey = process.env.WYCWY_AI_API_KEY || process.env.ARK_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.WYCWY_AI_MODEL || process.env.ARK_MODEL || process.env.OPENAI_MODEL || DEFAULT_ARK_MODEL;
  const requestTimeoutMs = Math.max(1000, Number(process.env.WYCWY_AI_REQUEST_TIMEOUT_MS || 45000));

  let body;
  try {
    body = JSON.parse(await readBody(req) || '{}');
  } catch (e) {
    sendJson(res, e.message === 'body_too_large' ? 413 : 400, { error: e.message || 'invalid_json' });
    return;
  }
  const payload = body.payload || body;
  if (!payload || typeof payload !== 'object') {
    sendJson(res, 400, { error: 'missing_payload' });
    return;
  }

  const suspiciousReport = detectSuspiciousRun(payload);
  if (suspiciousReport.suspicious) {
    sendJson(res, 200, {
      source: 'guardrail',
      suspicious: true,
      cheatReasons: suspiciousReport.reasons,
      review: buildCheaterReview(suspiciousReport),
    });
    return;
  }
  if (!apiKey || !model) {
    sendJson(res, 200, {
      source: 'local',
      error: 'ai_not_configured',
      message: 'Set WYCWY_AI_API_KEY to enable model review.',
    });
    return;
  }

  let timer = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    const upstream = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildModelRequest({ provider, model, payload })),
      signal: controller.signal,
    });
    clearTimeout(timer);
    timer = null;
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      sendJson(res, 200, {
        source: 'local',
        error: 'llm_request_failed',
        status: upstream.status,
        message: data?.error?.message || data?.message || 'upstream_error',
      });
      return;
    }
    const text = extractModelText(data);
    const parsed = normalizeReviewObject(parseJsonObject(text)) || repairReviewFromText(text);
    if (!parsed) {
      sendJson(res, 200, {
        source: 'local',
        error: 'invalid_ai_json',
        message: 'Model response was not renderable JSON.',
      });
      return;
    }
    sendJson(res, 200, { source: 'ai', review: parsed });
  } catch (e) {
    if (timer) clearTimeout(timer);
    sendJson(res, 200, {
      source: 'local',
      error: 'llm_request_error',
      message: e.name === 'AbortError' ? 'upstream_timeout' : (e.message || 'request_failed'),
    });
  }
}

async function handleLeaderboardSubmit(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req) || '{}');
  } catch (e) {
    sendJson(res, e.message === 'body_too_large' ? 413 : 400, { error: e.message || 'invalid_json' });
    return;
  }

  const entry = normalizeLeaderboardEntry(body.entry || body);
  if (!entry.clientRunId) {
    sendJson(res, 400, { error: 'missing_client_run_id' });
    return;
  }
  if (entry.suspicious || entry.styleKey === 'cheater') {
    sendJson(res, 200, {
      ok: false,
      suspicious: true,
      skipped: true,
      reason: 'suspicious_run_not_ranked',
    });
    return;
  }

  try {
    const result = await withLeaderboardWriteLock(async () => {
      const entries = await readLeaderboardEntries();
      const existing = entries.find((item) => item.clientRunId === entry.clientRunId);
      let saved = existing;
      if (!saved) {
        entries.push(entry);
        await writeLeaderboardEntries(entries);
        saved = entry;
      }
      const ranked = attachRanks(entries, 'score');
      const rankedEntry = ranked.find((item) => item.clientRunId === saved.clientRunId) || saved;
      return {
        existing,
        entries,
        rankedEntry,
      };
    });

    sendJson(res, 200, {
      ok: true,
      duplicate: !!result.existing,
      entry: result.rankedEntry,
      rank: result.rankedEntry.rank || null,
      total: result.entries.length,
    });
  } catch (e) {
    sendJson(res, 200, {
      ok: false,
      source: 'local',
      error: 'leaderboard_write_failed',
      message: e.message || 'write_failed',
    });
  }
}

async function handleLeaderboardList(req, res) {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sort = url.searchParams.get('sort') || 'score';
    const limit = Math.max(1, Math.min(300, Number(url.searchParams.get('limit') || DEFAULT_LEADERBOARD_LIMIT)));
    const entries = await readLeaderboardEntries();
    const ranked = attachRanks(entries, sort);
    sendJson(res, 200, {
      ok: true,
      sort,
      total: entries.length,
      entries: ranked.slice(0, limit),
      profiles: buildProfileStats(entries),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    sendJson(res, 200, {
      ok: false,
      error: 'leaderboard_read_failed',
      message: e.message || 'read_failed',
      entries: [],
      profiles: [],
    });
  }
}

function resolveStaticPath(requestUrl) {
  let pathname;
  try {
    const rawPathname = String(requestUrl || '').split(/[?#]/, 1)[0];
    const decodedRawPathname = decodeURIComponent(rawPathname);
    if (decodedRawPathname.split(/[\\/]+/).includes('..')) return null;
    const url = new URL(requestUrl, `http://localhost:${PORT}`);
    pathname = decodeURIComponent(url.pathname);
  } catch (e) {
    return null;
  }
  if (pathname === '/') pathname = `/${DEFAULT_HTML}`;
  const target = path.normalize(path.join(PROJECT_ROOT, pathname));
  const rel = path.relative(PROJECT_ROOT, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return target;
}

async function handleStatic(req, res) {
  const target = resolveStaticPath(req.url);
  if (!target) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new Error('not_file');
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(target).pipe(res);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  const pathname = getRequestPathname(req);
  if (req.method === 'POST' && pathname === '/api/run-analysis') {
    handleRunAnalysis(req, res);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/leaderboard/submit') {
    handleLeaderboardSubmit(req, res);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    handleLeaderboardList(req, res);
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    handleStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`WYCWY server listening on http://localhost:${PORT}/${encodeURIComponent(DEFAULT_HTML)}`);
  if (!process.env.WYCWY_AI_API_KEY && !process.env.ARK_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log('AI review endpoint is available but not configured; client will use local fallback.');
  }
});
