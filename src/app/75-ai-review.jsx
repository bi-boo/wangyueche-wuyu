const AI_REVIEW_ENDPOINT_KEY = 'wycwy-ai-review-endpoint';
const AI_REVIEW_DEFAULT_ENDPOINT = 'api/run-analysis';
const LEADERBOARD_ENDPOINT_KEY = 'wycwy-leaderboard-endpoint';
const LEADERBOARD_DEFAULT_ENDPOINT = 'api/leaderboard';
const LEADERBOARD_CLIENT_KEY = 'wycwy-leaderboard-client-id';

function getAiReviewEndpoint() {
  return window.WYCWY_AI_REVIEW_ENDPOINT
    || localStorage.getItem(AI_REVIEW_ENDPOINT_KEY)
    || AI_REVIEW_DEFAULT_ENDPOINT;
}

function getLeaderboardEndpoint() {
  return window.WYCWY_LEADERBOARD_ENDPOINT
    || localStorage.getItem(LEADERBOARD_ENDPOINT_KEY)
    || LEADERBOARD_DEFAULT_ENDPOINT;
}

function getLeaderboardClientId() {
  try {
    const saved = localStorage.getItem(LEADERBOARD_CLIENT_KEY);
    if (saved) return saved;
    const next = (crypto?.randomUUID && crypto.randomUUID())
      || `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LEADERBOARD_CLIENT_KEY, next);
    return next;
  } catch (e) {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getProfileScore(profile, key) {
  const row = (profile?.axes || []).find((item) => item.key === key);
  return row ? row.score : 0;
}

function formatDecisionDiff(diff = {}) {
  const parts = [];
  if (diff.funds) parts.push(`资金 ${diff.funds.before} → ${diff.funds.after}`);
  if (diff.reputation) parts.push(`口碑 ${diff.reputation.before} → ${diff.reputation.after}`);
  if (diff.crews) parts.push(`车组 ${diff.crews.before} → ${diff.crews.after}`);
  if (diff.drivers) parts.push(`司机 ${diff.drivers.before} → ${diff.drivers.after}`);
  return parts.slice(0, 2).join('；');
}

function pickEvidenceDecisions(payload, keys = []) {
  const keySet = new Set(keys);
  const decisions = payload?.keyDecisions || [];
  const matched = decisions.filter((decision) =>
    Object.keys(decision.tags || {}).some((key) => keySet.has(key))
  );
  return (matched.length ? matched : decisions).slice(0, 3);
}

function buildLocalRunReview(payload) {
  const profile = payload.valueProfile || {};
  const driverScore = getProfileScore(profile, 'driverCare') + getProfileScore(profile, 'trustBuilding');
  const profitScore = getProfileScore(profile, 'profit') + getProfileScore(profile, 'costControl');
  const riskScore = getProfileScore(profile, 'riskTaking') + getProfileScore(profile, 'shortTermism');
  const complianceScore = getProfileScore(profile, 'compliance') + getProfileScore(profile, 'riskControl');
  const growthScore = getProfileScore(profile, 'growth') + getProfileScore(profile, 'ambition');
  const isLose = payload.gameResult?.type === 'lose';
  let headline = '任务型车队老板';
  let verdict = '你的经营风格不极端，更多是在任务、现金和事件压力之间来回补洞。优点是能推进，缺点是缺少一条稳定原则。';
  let evidenceKeys = ['growth', 'profit', 'driverCare'];
  let advice = '下一局先给自己定一条底线：资金低于安全线时只做扩张和现金流动作，资金安全后再处理关系账。';

  if (driverScore >= Math.max(profitScore, riskScore, growthScore) && driverScore >= 4) {
    headline = '关系型车队老板';
    verdict = isLose
      ? '你明显愿意为司机忠诚付钱，但现金流纪律不够硬。你不是输在没有人情味，而是输在没有给人情味设预算。'
      : '你把司机关系当成长期资产在经营，不是只看眼前利润。这种打法能养出稳定车队，但对资金缓冲要求很高。';
    evidenceKeys = ['driverCare', 'trustBuilding'];
    advice = '下一局保留照顾司机的风格，但设一条硬规则：低于 30 天工资储备时，所有补贴、借钱和加薪都延后。';
  } else if (profitScore >= Math.max(driverScore, riskScore, growthScore) && profitScore >= 4) {
    headline = '现金流优先的冷面老板';
    verdict = '你倾向于先保资金和效率，再处理司机感受。这个打法短期抗压强，但如果连续透支忠诚，后面会用更贵的方式还账。';
    evidenceKeys = ['profit', 'costControl', 'driverCare'];
    advice = '下一局可以继续重视现金流，但要盯住司机忠诚下限。忠诚被你当成成本项时，它最后会变成经营风险。';
  } else if (riskScore >= Math.max(driverScore, profitScore, complianceScore) && riskScore >= 4) {
    headline = '激进扩张型老板';
    verdict = '你愿意用贷款、窗口期和高风险选择换增长。这个打法有爆发力，但一旦节奏错位，债务和监管会同时反噬。';
    evidenceKeys = ['riskTaking', 'shortTermism', 'growth'];
    advice = '下一局每次借钱或冒险前先问一个问题：这笔风险能不能在一个月报周期内变成稳定车组，而不只是把死亡线往后推。';
  } else if (complianceScore >= Math.max(driverScore, profitScore, riskScore) && complianceScore >= 3) {
    headline = '稳健合规型老板';
    verdict = '你对规则、证据和外部风险比较敏感，宁可慢一点也不太愿意踩灰线。弱点是机会窗口来了时可能不够果断。';
    evidenceKeys = ['compliance', 'riskControl', 'reputationFirst'];
    advice = '下一局可以把合规当护城河，但别把稳健做成保守。该买车、招人、训练时要让钱变成产能。';
  } else if (growthScore >= 4) {
    headline = '扩张推进型老板';
    verdict = '你的主要动作围绕买车、招人、训练和冲更高阶段展开。你有推进欲，但需要确认扩张速度没有超过现金流承受力。';
    evidenceKeys = ['growth', 'ambition', 'profit'];
    advice = '下一局继续扩张，但每次新增车组后看一次月报，确认新增产能真的覆盖了工资和债务。';
  }

  const evidence = pickEvidenceDecisions(payload, evidenceKeys).map((decision) => {
    const diffText = formatDecisionDiff(decision.diff);
    return diffText
      ? `Day ${decision.day} ${decision.label}（${diffText}）`
      : `Day ${decision.day} ${decision.label}`;
  });

  return {
    source: 'local',
    headline,
    verdict,
    evidence,
    advice,
  };
}

function cleanAiReviewText(value, maxLength = 220) {
  return String(value || '')
    .replace(/```(?:json)?|```/gi, '')
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, '')
    .replace(/^\s*(headline|verdict|evidence|advice|summary|nextRunAdvice)\s*[:：]\s*/i, '')
    .replace(/[{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeReviewObject(raw, source = 'ai') {
  if (!raw || typeof raw !== 'object') return null;
  const headline = cleanAiReviewText(raw.headline || raw.archetype || raw.title || 'AI 运营复盘', 40);
  const verdict = cleanAiReviewText(raw.verdict || raw.summary || raw.analysis || '', 260);
  const evidenceRaw = Array.isArray(raw.evidence)
    ? raw.evidence
    : typeof raw.evidence === 'string'
      ? raw.evidence.split(/\n+|；|;/)
      : [];
  const evidence = evidenceRaw
    .map((item) => cleanAiReviewText(item, 140))
    .filter((item) => item && !/^(evidence|advice)$/i.test(item))
    .slice(0, 4);
  const advice = cleanAiReviewText(raw.advice || raw.nextRunAdvice || raw.suggestion || '', 220);
  if (!headline || !verdict || !advice) return null;
  return { source, headline, verdict, evidence, advice };
}

function parseAiReviewText(text, source = 'ai') {
  const raw = String(text || '')
    .replace(/```(?:json)?|```/gi, '')
    .trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return normalizeReviewObject(parsed.review || parsed, source);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return normalizeReviewObject(parsed.review || parsed, source);
      } catch (inner) {}
    }
  }
  const extractField = (field, nextFields = []) => {
    const nextPattern = nextFields.length
      ? `(?=\\s*,?\\s*["“]?(${nextFields.join('|')})["”]?\\s*[:：])`
      : '';
    const patterns = [
      new RegExp(`["“]?${field}["”]?\\s*[:：]\\s*["“]([\\s\\S]*?)[\\"”]${nextPattern}`, 'i'),
      new RegExp(`["“]?${field}["”]?\\s*[:：]\\s*([\\s\\S]*?)${nextPattern || '$'}`, 'i'),
    ];
    for (const pattern of patterns) {
      const matched = raw.match(pattern);
      if (matched?.[1]) return matched[1];
    }
    return '';
  };
  const evidenceBlock = raw.match(/["“]?evidence["”]?\s*[:：]\s*\[([\s\S]*?)(?:\]\s*,?\s*["“]?advice["”]?|["“]?advice["”]?\s*[:：]|$)/i)?.[1] || '';
  const evidence = [];
  let quoteMatch;
  const quotePattern = /["“]([^"“”\n]{6,180})["”]/g;
  while ((quoteMatch = quotePattern.exec(evidenceBlock)) && evidence.length < 4) {
    evidence.push(quoteMatch[1]);
  }
  if (!evidence.length) {
    evidence.push(...evidenceBlock.split(/\n+|,\s*|，\s*|；|;/).filter((item) => item.trim().length >= 6).slice(0, 4));
  }
  return normalizeReviewObject({
    headline: extractField('headline', ['verdict', 'evidence', 'advice']),
    verdict: extractField('verdict', ['evidence', 'advice']),
    evidence,
    advice: extractField('advice', []),
  }, source);
}

function normalizeAiReviewResponse(data, payload) {
  if (data?.review && typeof data.review === 'object') {
    const normalized = normalizeReviewObject(data.review, data.source || 'ai');
    if (normalized) {
      return {
        ...normalized,
        suspicious: !!data.suspicious,
        cheatReasons: data.cheatReasons || [],
      };
    }
  }
  if (typeof data?.text === 'string' && data.text.trim()) {
    const parsed = parseAiReviewText(data.text, data.source || 'ai');
    if (parsed) return parsed;
  }
  const fallback = buildLocalRunReview(payload);
  if (data?.suspicious) {
    return {
      ...fallback,
      source: data.source || 'guardrail',
      suspicious: true,
      cheatReasons: data.cheatReasons || [],
    };
  }
  return fallback;
}

async function requestRunAiReview(payload) {
  const endpoint = getAiReviewEndpoint();
  if (!endpoint || location.protocol === 'file:') return buildLocalRunReview(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return normalizeAiReviewResponse(data, payload);
  } catch (e) {
    clearTimeout(timer);
    return {
      ...buildLocalRunReview(payload),
      fallbackReason: e?.message || 'request_failed',
    };
  }
}

function buildLeaderboardEntry(payload, review) {
  const summary = payload.summary || {};
  const gameResult = payload.gameResult || {};
  const styleTag = deriveLeaderboardStyleTag(payload);
  const suspicious = !!review?.suspicious || review?.source === 'guardrail';
  const clientId = getLeaderboardClientId();
  const runSeed = [
    summary.realTime?.createdAt,
    payload.exportedAt?.slice(0, 10),
    gameResult.type,
    gameResult.deathCause,
    gameResult.endingId,
    summary.day,
    summary.totalCompleted,
    summary.totalEarned,
  ].filter(Boolean).join('|');
  return {
    clientRunId: `${clientId}:${runSeed}`,
    profile: review?.headline || '未命名经营者',
    styleTag: suspicious ? '作弊者' : styleTag.label,
    styleKey: suspicious ? 'cheater' : styleTag.key,
    reviewSource: review?.source || 'unknown',
    suspicious,
    cheatReasons: review?.cheatReasons || [],
    gameResult,
    summary: {
      day: summary.day,
      funds: summary.funds,
      reputation: summary.reputation,
      drivers: summary.drivers,
      vehicles: summary.vehicles,
      crews: summary.crews,
      totalCompleted: summary.totalCompleted,
      totalEarned: summary.totalEarned,
    },
  };
}

function deriveLeaderboardStyleTag(payload) {
  const profile = payload.valueProfile || {};
  const score = (key) => getProfileScore(profile, key);
  const rows = [
    {
      key: 'driver_friendly',
      label: '司机友好型',
      score: score('driverCare') + score('trustBuilding'),
    },
    {
      key: 'profit_first',
      label: '利润优先型',
      score: score('profit') + score('costControl'),
    },
    {
      key: 'risk_growth',
      label: '冒险扩张型',
      score: score('riskTaking') + score('growth') + score('ambition'),
    },
    {
      key: 'steady_compliance',
      label: '稳健合规型',
      score: score('compliance') + score('riskControl'),
    },
    {
      key: 'reputation_first',
      label: '口碑优先型',
      score: score('reputationFirst') + score('operations'),
    },
    {
      key: 'cashflow_broken',
      label: '现金流失控型',
      score: payload.summary?.funds < 0 ? 6 + score('shortTermism') + score('riskTaking') : score('shortTermism'),
    },
  ].sort((a, b) => b.score - a.score);
  const top = rows[0];
  if (!top || top.score <= 0) return { key: 'balanced', label: '均衡经营型' };
  return { key: top.key, label: top.label };
}

async function submitLeaderboardEntry(payload, review) {
  const endpoint = getLeaderboardEndpoint();
  if (!endpoint || location.protocol === 'file:' || payload.gameResult?.type === 'in_progress') {
    return { ok: false, skipped: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: buildLeaderboardEntry(payload, review) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e?.message || 'leaderboard_submit_failed' };
  }
}

function getLeaderboardHref() {
  return 'leaderboard.html';
}

function RunAiReviewPanel({ state }) {
  const [status, setStatus] = useState('idle');
  const [review, setReview] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);

  const handleGenerate = async () => {
    if (!state) return;
    setStatus('loading');
    setLeaderboard(null);
    const payload = buildRunAnalysisPayload(state);
    const result = await requestRunAiReview(payload);
    setReview(result);
    setStatus('ready');
    const leaderboardResult = await submitLeaderboardEntry(payload, result);
    setLeaderboard(leaderboardResult);
  };

  return (
    <div className="ai-review-panel">
      <div className="ai-review-head">
        <span>AI 运营复盘</span>
        {review?.source && <em>{review.source === 'ai' ? '模型生成' : '本地简评'}</em>}
      </div>
      {status === 'idle' && (
        <button className="btn btn-ghost btn-block ai-review-trigger" onClick={handleGenerate}>
          生成经营人格评价
        </button>
      )}
      {status === 'loading' && (
        <div className="ai-review-loading">正在读取本局选择...</div>
      )}
      {status === 'ready' && review && (
        <div className="ai-review-result">
          <div className="ai-review-title">{review.headline}</div>
          {review.verdict && <p>{review.verdict}</p>}
          {review.evidence?.length > 0 && (
            <div className="ai-review-evidence">
              {review.evidence.map((item, idx) => <span key={idx}>{item}</span>)}
            </div>
          )}
          {review.advice && <div className="ai-review-advice">{review.advice}</div>}
          <div className="ai-review-leaderboard">
            {leaderboard?.ok ? (
              <span>已匿名加入榜单 · 综合第 {leaderboard.rank}/{leaderboard.total}</span>
            ) : leaderboard?.suspicious ? (
              <span>这局数据异常，不进入正常榜单</span>
            ) : leaderboard?.skipped ? (
              <span>本地打开时不上传榜单</span>
            ) : leaderboard ? (
              <span>榜单暂不可用，复盘已保留</span>
            ) : (
              <span>正在匿名加入榜单...</span>
            )}
            <a href={getLeaderboardHref()} target="_blank" rel="noopener noreferrer">查看榜单</a>
          </div>
        </div>
      )}
    </div>
  );
}
